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
      INSERT INTO users (name, email, password_hash)
      SELECT
        'DBMS demo ' || value,
        $1 || '-' || value || '@example.invalid',
        '$2b$12$integrationfixturehash000000000000000000000000000000'
      FROM generate_series(1, $2) AS value
      RETURNING user_id
    `,
    [fixture, count],
  );
  return result.rows.map((row) => row.user_id);
}

async function demonstrateReadCommitted(userId) {
  return database.withClient(async (client) => {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '10s'`);
    const first = await client.query('SELECT name FROM users WHERE user_id = $1', [userId]);
    await database.query('UPDATE users SET name = $1 WHERE user_id = $2', [
      'READ COMMITTED changed',
      userId,
    ]);
    const second = await client.query('SELECT name FROM users WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    return { first: first.rows[0].name, second: second.rows[0].name };
  });
}

async function demonstrateRepeatableRead(userId) {
  await database.query('UPDATE users SET name = $1 WHERE user_id = $2', [
    'REPEATABLE READ before',
    userId,
  ]);
  return database.withClient(async (client) => {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
    await client.query(`SET LOCAL lock_timeout = '5s'`);
    await client.query(`SET LOCAL statement_timeout = '10s'`);
    const first = await client.query('SELECT name FROM users WHERE user_id = $1', [userId]);
    await database.query('UPDATE users SET name = $1 WHERE user_id = $2', [
      'REPEATABLE READ after',
      userId,
    ]);
    const second = await client.query('SELECT name FROM users WHERE user_id = $1', [userId]);
    await client.query('COMMIT');
    const afterCommit = await database.query('SELECT name FROM users WHERE user_id = $1', [userId]);
    return {
      afterCommit: afterCommit.rows[0].name,
      first: first.rows[0].name,
      second: second.rows[0].name,
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
          await client.query('UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [
            firstId,
          ]);
        } else {
          await client.query(
            'SELECT user_id FROM users WHERE user_id = ANY($1::int[]) ORDER BY user_id',
            [userIds],
          );
        }
        arrivals += 1;
        if (arrivals === 2) release();
        await barrier;
        await client.query('UPDATE users SET name = $1 WHERE user_id = $2', [label, secondId]);
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
          INSERT INTO recommendation (
            user_id, rule, title, recommendation_text, priority, suggested_action
          ) VALUES ($1, 'unused_subscription', 'Atomic probe', 'Must roll back', 'low', 'No action')
        `,
        [userId],
      );
      // Points at a subscription that does not exist: the FK fails and both rows roll back.
      await transaction.query(
        `
          INSERT INTO recommendation (
            user_id, subscription_id, rule, title, recommendation_text, priority, suggested_action
          ) VALUES ($1, 999999999, 'duplicate_category', 'Atomic probe', 'Must roll back', 'low', 'No action')
        `,
        [userId],
      );
    });
  } catch (error) {
    consistencyError = error.code;
  }
  const rolledBack = await database.query(
    `SELECT count(*)::INTEGER AS count FROM recommendation WHERE user_id = $1 AND title = 'Atomic probe'`,
    [userId],
  );
  await database.withTransaction((transaction) =>
    transaction.query(`UPDATE users SET name = 'Durability committed' WHERE user_id = $1`, [
      userId,
    ]),
  );
  const durable = await database.query('SELECT name FROM users WHERE user_id = $1', [userId]);
  return {
    atomicRollbackRows: rolledBack.rows[0].count,
    consistencyError,
    durableValueAfterRelease: durable.rows[0].name,
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
