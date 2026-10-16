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
        'spendwise_advance_renewal_date',
        'renewal_reminders_within',
        'generate_recommendations'
      )
    UNION ALL
    SELECT 'view', c.relname
    FROM pg_class AS c
    WHERE c.relnamespace = 'public'::regnamespace
      AND c.relkind = 'v'
      AND c.relname IN (
        'active_subscription_commitments',
        'completed_payment_financials',
        'renewal_reminders',
        'monthly_spend_by_category'
      )
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
      AND c.relname IN ('idx_payment_history_completed_covering', 'idx_subscription_renewal_date')
    ORDER BY kind, name
  `);
  const trigger = await database.query(`
    SELECT tgname
    FROM pg_trigger
    WHERE tgname IN ('trg_subscription_audit_terms', 'trg_payment_history_update_renewal')
      AND NOT tgisinternal
    ORDER BY tgname
  `);
  const monthly = await database.query(`
    SELECT
      spendwise_monthly_equivalent(120, 'Monthly') AS monthly,
      spendwise_monthly_equivalent(120, 'Yearly') AS yearly
  `);

  if (objects.rowCount !== 13 || trigger.rowCount !== 2) {
    throw new Error('One or more spec database objects are missing.');
  }

  console.info(
    JSON.stringify(
      {
        database: databaseName,
        monthlyNormalization: monthly.rows[0],
        objects: objects.rows,
        status: 'verified',
        triggers: trigger.rows.map((row) => row.tgname),
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
