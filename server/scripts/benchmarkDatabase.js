import { runMigrations } from '../src/db/migrationRunner.js';

import {
  assertDedicatedTestDatabase,
  createTestDatabase,
  uniqueFixture,
} from './advancedDbSupport.js';

const database = createTestDatabase();
const fixture = uniqueFixture('benchmark');
const indexName = 'idx_payments_completed_subscription_covering';
let userId;
let categoryId;

const createIndexSql = `
  CREATE INDEX IF NOT EXISTS ${indexName}
  ON payments (subscription_id, payment_date DESC, currency_code)
  INCLUDE (id, amount)
  WHERE payment_status = 'completed'
`;

function flattenPlan(node, nodeTypes = []) {
  nodeTypes.push(node['Node Type']);
  for (const child of node.Plans ?? []) flattenPlan(child, nodeTypes);
  return nodeTypes;
}

async function measure(subscriptionId) {
  const explain = () =>
    database.query(
      `
        EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
        SELECT currency_code, COUNT(*) AS payment_count, SUM(amount) AS total
        FROM payments
        WHERE subscription_id = $1
          AND payment_status = 'completed'
          AND payment_date >= DATE '2024-01-01'
        GROUP BY currency_code
      `,
      [subscriptionId],
    );

  await explain();
  const samples = [];
  for (let attempt = 0; attempt < 7; attempt += 1) {
    const result = await explain();
    const report = result.rows[0]['QUERY PLAN'][0];
    samples.push(report['Execution Time']);
    if (attempt === 6) {
      return {
        averageExecutionMs: Number(
          (samples.reduce((total, value) => total + value, 0) / samples.length).toFixed(3),
        ),
        executionSamplesMs: samples,
        medianExecutionMs: [...samples].sort((left, right) => left - right)[3],
        nodeTypes: flattenPlan(report.Plan),
        planningMs: report['Planning Time'],
        sharedHitBlocks: report.Plan['Shared Hit Blocks'],
        sharedReadBlocks: report.Plan['Shared Read Blocks'],
      };
    }
  }
  throw new Error('Benchmark did not produce a result.');
}

try {
  const databaseName = await assertDedicatedTestDatabase(database);
  await runMigrations({ database });
  const user = await database.query(
    `
      INSERT INTO users (display_name, email, password_hash)
      VALUES ('Benchmark user', $1, '$2b$12$integrationfixturehash000000000000000000000000000000')
      RETURNING id
    `,
    [`${fixture}@example.invalid`],
  );
  userId = user.rows[0].id;
  const category = await database.query(`INSERT INTO categories (name) VALUES ($1) RETURNING id`, [
    fixture,
  ]);
  categoryId = category.rows[0].id;
  const subscriptions = await database.query(
    `
      INSERT INTO subscriptions (
        user_id, custom_service_name, category_id, price, currency_code,
        billing_cycle, status, start_date, next_renewal_date
      )
      SELECT
        $1, $2 || '-' || value, $3, 10, 'USD', 'monthly', 'active',
        DATE '2024-01-01', DATE '2027-01-01'
      FROM generate_series(1, 100) AS value
      RETURNING id
    `,
    [userId, fixture, categoryId],
  );
  const subscriptionIds = subscriptions.rows.map((row) => row.id);
  await database.query(
    `
      INSERT INTO payments (
        subscription_id, amount, currency_code, payment_date, payment_status, notes
      )
      SELECT
        subscription_id,
        10 + (payment_number % 40),
        'USD',
        DATE '2024-01-01' + (payment_number % 900),
        CASE WHEN payment_number % 10 = 0 THEN 'failed' ELSE 'completed' END,
        $2
      FROM unnest($1::bigint[]) AS subscription_id
      CROSS JOIN generate_series(1, 500) AS payment_number
    `,
    [subscriptionIds, fixture],
  );

  await database.query(`DROP INDEX IF EXISTS ${indexName}`);
  await database.query('VACUUM (ANALYZE) payments');
  const before = await measure(subscriptionIds[0]);
  await database.query(createIndexSql);
  await database.query('VACUUM (ANALYZE) payments');
  const after = await measure(subscriptionIds[0]);
  const improvementPercent = Number(
    (
      ((before.averageExecutionMs - after.averageExecutionMs) / before.averageExecutionMs) *
      100
    ).toFixed(1),
  );

  console.info(
    JSON.stringify(
      {
        after,
        before,
        database: databaseName,
        fixtureRows: 50000,
        improvementPercent,
        index: indexName,
        workload: 'completed payment aggregation for one subscription',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Database benchmark failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  try {
    await database.query(createIndexSql);
    if (userId) {
      await database.query(`DELETE FROM subscription_audit_events WHERE user_id = $1`, [userId]);
      await database.query(`DELETE FROM payments WHERE notes = $1`, [fixture]);
      await database.query(`DELETE FROM subscriptions WHERE user_id = $1`, [userId]);
      await database.query(`DELETE FROM users WHERE id = $1`, [userId]);
    }
    if (categoryId) await database.query(`DELETE FROM categories WHERE id = $1`, [categoryId]);
  } catch (error) {
    console.error(`Benchmark cleanup failed: ${error.message}`);
    process.exitCode = 1;
  }
  await database.close();
}
