import { runMigrations } from '../src/db/migrationRunner.js';

import {
  assertDedicatedTestDatabase,
  createTestDatabase,
  uniqueFixture,
} from './advancedDbSupport.js';

const database = createTestDatabase();
const fixture = uniqueFixture('advanced-demo');

async function insertUsers(count) {
  const result = await database.query(
    `
      INSERT INTO users (display_name, email, password_hash)
      SELECT
        'DBMS demo ' || value,
        $1 || '-' || value || '@example.invalid',
        '$2b$12$integrationfixturehash000000000000000000000000000000'
      FROM generate_series(1, $2) AS value
      RETURNING id
    `,
    [fixture, count],
  );
  return result.rows.map((row) => row.id);
}

async function demonstrateReadCommitted(userId) {
  return database.withClient(async (client) => {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '10s'`);
    const first = await client.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    await database.query('UPDATE users SET display_name = $1 WHERE id = $2', [
      'READ COMMITTED changed',
      userId,
    ]);
    const second = await client.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    return { first: first.rows[0].display_name, second: second.rows[0].display_name };
  });
}

async function demonstrateRepeatableRead(userId) {
  await database.query('UPDATE users SET display_name = $1 WHERE id = $2', [
    'REPEATABLE READ before',
    userId,
  ]);
  return database.withClient(async (client) => {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '10s'`);
    const first = await client.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    await database.query('UPDATE users SET display_name = $1 WHERE id = $2', [
      'REPEATABLE READ after',
      userId,
    ]);
    const second = await client.query('SELECT display_name FROM users WHERE id = $1', [userId]);
    await client.query('COMMIT');
    const afterCommit = await database.query('SELECT display_name FROM users WHERE id = $1', [
      userId,
    ]);
    return {
      afterCommit: afterCommit.rows[0].display_name,
      first: first.rows[0].display_name,
      second: second.rows[0].display_name,
    };
  });
}

async function runPairedTransactions(userIds, { isolationLevel, deadlock = false }) {
  let arrivals = 0;
  let release;
  const barrier = new Promise((resolve) => {
    release = resolve;
  });

  const run = (firstId, secondId, label) =>
    database.withClient(async (client) => {
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      try {
        await client.query(`SET LOCAL lock_timeout = '5s'`);
        await client.query(`SET LOCAL statement_timeout = '10s'`);
        if (deadlock) {
          await client.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = $1', [
            firstId,
          ]);
        } else {
          await client.query('SELECT id FROM users WHERE id = ANY($1::bigint[]) ORDER BY id', [
            userIds,
          ]);
        }
        arrivals += 1;
        if (arrivals === 2) release();
        await barrier;
        await client.query('UPDATE users SET display_name = $1 WHERE id = $2', [label, secondId]);
        await client.query('COMMIT');
        return 'committed';
      } catch (error) {
        await client.query('ROLLBACK');
        return error.code;
      }
    });

  return Promise.all([
    run(userIds[0], deadlock ? userIds[1] : userIds[0], 'transaction-a'),
    run(userIds[1], deadlock ? userIds[0] : userIds[1], 'transaction-b'),
  ]);
}

async function demonstrateAcid(userId) {
  let consistencyError;
  try {
    await database.withTransaction(async (transaction) => {
      await transaction.query(
        `
          INSERT INTO recommendations (
            user_id, recommendation_type, title, explanation, rule_version, priority,
            confidence, suggested_action, recommendation_key, source_fingerprint
          ) VALUES ($1, 'price_outlier', 'Atomic probe', 'Must roll back', 'demo-v1',
            'low', 'high', 'No action', 'atomic-probe', repeat('a', 64))
        `,
        [userId],
      );
      await transaction.query(
        `
          INSERT INTO recommendation_subscriptions (recommendation_id, subscription_id, user_id)
          VALUES (currval(pg_get_serial_sequence('recommendations', 'id')), 999999999, $1)
        `,
        [userId],
      );
    });
  } catch (error) {
    consistencyError = error.code;
  }
  const rolledBack = await database.query(
    `SELECT count(*)::INTEGER AS count FROM recommendations WHERE user_id = $1 AND recommendation_key = 'atomic-probe'`,
    [userId],
  );
  await database.withTransaction((transaction) =>
    transaction.query(`UPDATE users SET display_name = 'Durability committed' WHERE id = $1`, [
      userId,
    ]),
  );
  const durable = await database.query('SELECT display_name FROM users WHERE id = $1', [userId]);
  return {
    atomicRollbackRows: rolledBack.rows[0].count,
    consistencyError,
    durableValueAfterRelease: durable.rows[0].display_name,
  };
}

try {
  const databaseName = await assertDedicatedTestDatabase(database);
  await runMigrations({ database });
  const userIds = await insertUsers(3);
  const acid = await demonstrateAcid(userIds[0]);
  const readCommitted = await demonstrateReadCommitted(userIds[0]);
  const repeatableRead = await demonstrateRepeatableRead(userIds[0]);
  const serializable = await runPairedTransactions(userIds.slice(1), {
    isolationLevel: 'SERIALIZABLE',
  });
  const deadlock = await runPairedTransactions(userIds.slice(1), {
    deadlock: true,
    isolationLevel: 'READ COMMITTED',
  });

  if (!serializable.includes('40001') || !deadlock.includes('40P01')) {
    throw new Error('Expected PostgreSQL serialization and deadlock errors were not observed.');
  }

  console.info(
    JSON.stringify(
      { acid, database: databaseName, deadlock, readCommitted, repeatableRead, serializable },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Advanced database demonstration failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    await database.query(`DELETE FROM users WHERE email LIKE $1`, [`${fixture}-%`]);
  } catch (error) {
    console.error(`Fixture cleanup failed: ${error.message}`);
    process.exitCode = 1;
  }
  await database.close();
}
