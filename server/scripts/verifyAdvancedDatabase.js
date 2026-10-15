import { runMigrations } from '../src/db/migrationRunner.js';

import { assertDedicatedTestDatabase, createTestDatabase } from './advancedDbSupport.js';

const database = createTestDatabase();

try {
  const databaseName = await assertDedicatedTestDatabase(database);
  await runMigrations({ database });

  const objects = await database.query(`
    SELECT 'function' AS kind, p.proname AS name
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname IN (
        'spendwise_monthly_equivalent',
        'spendwise_user_financial_summary',
        'spendwise_audit_subscription_changes',
        'spendwise_retire_stale_recommendations'
      )
    UNION ALL
    SELECT 'view', c.relname
    FROM pg_class AS c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'v'
      AND c.relname IN ('active_subscription_commitments', 'completed_payment_financials')
    UNION ALL
    SELECT 'table', c.relname
    FROM pg_class AS c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'r'
      AND c.relname = 'subscription_audit_events'
    UNION ALL
    SELECT 'index', c.relname
    FROM pg_class AS c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'i'
      AND c.relname = 'idx_payments_completed_subscription_covering'
    ORDER BY kind, name
  `);
  const trigger = await database.query(`
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = 'public.subscriptions'::regclass
      AND tgname = 'trg_subscriptions_audit_terms'
      AND NOT tgisinternal
  `);
  const monthly = await database.query(`
    SELECT
      spendwise_monthly_equivalent(120, 'monthly') AS monthly,
      spendwise_monthly_equivalent(120, 'quarterly') AS quarterly,
      spendwise_monthly_equivalent(120, 'yearly') AS yearly
  `);

  if (objects.rowCount !== 8 || trigger.rowCount !== 1) {
    throw new Error('One or more Stage 11 database objects are missing.');
  }

  console.info(
    JSON.stringify(
      {
        database: databaseName,
        monthlyNormalization: monthly.rows[0],
        objects: objects.rows,
        status: 'verified',
        trigger: trigger.rows[0].tgname,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(`Advanced database verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
