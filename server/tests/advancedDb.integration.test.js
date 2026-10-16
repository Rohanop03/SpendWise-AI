import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, test } from 'node:test';

import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';

async function insertFixture(database, { billingCycle = 'Yearly', cost = 120 } = {}) {
  const user = await database.query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ('Advanced DBMS', 'advanced-dbms@example.invalid', '$2b$12$integrationfixturehash000000000000000000000000000000')
      RETURNING user_id
    `,
  );
  const category = await database.query(
    `INSERT INTO category (category_name) VALUES ('Advanced DBMS') RETURNING category_id`,
  );
  const subscription = await database.query(
    `
      INSERT INTO subscription (
        user_id, service_name, category_id, cost, currency_code,
        billing_cycle, start_date, renewal_date
      ) VALUES ($1, 'Advanced fixture', $2, $3, 'USD', $4, DATE '2026-01-01', DATE '2027-01-01')
      RETURNING subscription_id
    `,
    [user.rows[0].user_id, category.rows[0].category_id, cost, billingCycle],
  );
  return {
    categoryId: category.rows[0].category_id,
    subscriptionId: subscription.rows[0].subscription_id,
    userId: user.rows[0].user_id,
  };
}

if (!config.testDatabaseUrl) {
  test('advanced PostgreSQL tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });

  describe('advanced PostgreSQL objects', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query('SELECT current_database() AS database_name');
      assert.equal(identity.rows[0].database_name, 'smart_subscription_test');
      await runMigrations({ database });
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE
          subscription_audit_events, auth_sessions, recommendation, notifications, refunds,
          payment_history, subscription, services, category, user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => database.close());

    it('normalizes Monthly and Yearly costs in one function', async () => {
      const result = await database.query(`
        SELECT
          spendwise_monthly_equivalent(120, 'Monthly') AS monthly,
          spendwise_monthly_equivalent(120, 'Yearly') AS yearly,
          spendwise_monthly_equivalent(100, 'Yearly') AS uneven,
          spendwise_monthly_equivalent(NULL, 'Monthly') AS null_amount
      `);
      assert.deepEqual(result.rows[0], {
        monthly: '120.00',
        null_amount: null,
        uneven: '8.33',
        yearly: '10.00',
      });
      await assert.rejects(
        database.query(`SELECT spendwise_monthly_equivalent(10, 'Quarterly')`),
        (error) => error.code === '22P02',
      );
    });

    it('audits meaningful subscription changes without logging unrelated edits', async () => {
      const fixture = await insertFixture(database);
      await database.query(
        `UPDATE subscription SET plan_name = 'Renamed' WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );
      await database.query(
        `UPDATE subscription SET cost = 144, billing_cycle = 'Monthly' WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );
      const audit = await database.query(
        `SELECT changed_fields, old_values, new_values FROM subscription_audit_events`,
      );
      assert.equal(audit.rowCount, 1);
      assert.deepEqual(audit.rows[0].changed_fields, ['cost', 'billing_cycle']);
      assert.equal(audit.rows[0].old_values.cost, 120);
      assert.equal(audit.rows[0].new_values.billingCycle, 'Monthly');

      await database.query(
        `UPDATE subscription SET renewal_date = DATE '2027-02-01' WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );

      await assert.rejects(
        database.withTransaction(async (transaction) => {
          await transaction.query(`UPDATE subscription SET cost = 200 WHERE subscription_id = $1`, [
            fixture.subscriptionId,
          ]);
          throw new Error('force rollback');
        }),
      );
      const afterRollback = await database.query(
        `SELECT count(*)::INTEGER AS count FROM subscription_audit_events`,
      );
      assert.equal(afterRollback.rows[0].count, 2);
    });

    it('advances the renewal date after a completed payment (trigger)', async () => {
      const fixture = await insertFixture(database, { billingCycle: 'Monthly', cost: 10 });
      await database.query(
        `UPDATE subscription SET renewal_date = DATE '2027-01-31', start_date = DATE '2026-01-31' WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );
      await database.query(
        `INSERT INTO payment_history (subscription_id, amount, currency_code, payment_date, payment_status)
         VALUES ($1, 10, 'USD', DATE '2027-01-31', 'completed')`,
        [fixture.subscriptionId],
      );
      const renewed = await database.query(
        `SELECT renewal_date::text AS renewal_date FROM subscription WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );
      assert.equal(renewed.rows[0].renewal_date, '2027-02-28');
    });

    it('exposes reusable financial views and avoids refund multiplication', async () => {
      const fixture = await insertFixture(database);
      const payment = await database.query(
        `
          INSERT INTO payment_history (
            subscription_id, amount, currency_code, payment_date, payment_status
          ) VALUES ($1, 120, 'USD', DATE '2026-06-01', 'completed')
          RETURNING payment_id
        `,
        [fixture.subscriptionId],
      );
      await database.query(
        `
          INSERT INTO refunds (payment_id, amount, refund_date, refund_status)
          VALUES ($1, 10, DATE '2026-06-02', 'completed'),
                 ($1, 5, DATE '2026-06-03', 'completed')
        `,
        [payment.rows[0].payment_id],
      );
      const commitment = await database.query(
        `SELECT monthly_equivalent, yearly_equivalent FROM active_subscription_commitments`,
      );
      const financial = await database.query(
        `SELECT gross_payment, completed_refunds, net_cash_flow FROM completed_payment_financials`,
      );
      const summary = await database.query(
        `SELECT * FROM spendwise_user_financial_summary($1, DATE '2026-01-01', DATE '2026-12-31')`,
        [fixture.userId],
      );
      const monthly = await database.query(
        `SELECT month::text, total_amount FROM monthly_spend_by_category WHERE user_id = $1`,
        [fixture.userId],
      );
      assert.deepEqual(commitment.rows[0], {
        monthly_equivalent: '10.00',
        yearly_equivalent: '120.00',
      });
      assert.deepEqual(financial.rows[0], {
        completed_refunds: '15.00',
        gross_payment: '120.00',
        net_cash_flow: '105.00',
      });
      assert.equal(summary.rows[0].completed_payment_count, '1');
      assert.equal(summary.rows[0].net_cash_flow, '105.00');
      assert.deepEqual(monthly.rows, [{ month: '2026-06-01', total_amount: '120.00' }]);

      await database.query(
        `UPDATE subscription SET archived_at = CURRENT_TIMESTAMP WHERE subscription_id = $1`,
        [fixture.subscriptionId],
      );
      const archived = await database.query(`
        SELECT
          (SELECT count(*)::INTEGER FROM active_subscription_commitments) AS commitments,
          (SELECT count(*)::INTEGER FROM completed_payment_financials) AS financial_rows
      `);
      assert.deepEqual(archived.rows[0], { commitments: 0, financial_rows: 1 });
    });

    it('generate_recommendations is idempotent and removes only stale Pending rows', async () => {
      const fixture = await insertFixture(database, { billingCycle: 'Monthly', cost: 30 });
      const second = await database.query(
        `
          INSERT INTO subscription (
            user_id, service_name, category_id, cost, currency_code, billing_cycle,
            start_date, renewal_date
          ) VALUES ($1, 'Second', $2, 20, 'USD', 'Monthly', DATE '2026-01-01', DATE '2027-01-01')
          RETURNING subscription_id
        `,
        [fixture.userId, fixture.categoryId],
      );
      const first = await database.query('CALL generate_recommendations($1)', [fixture.userId]);
      const again = await database.query('CALL generate_recommendations($1)', [fixture.userId]);
      assert.deepEqual(first.rows[0], again.rows[0]);
      const rows = await database.query(
        `SELECT rule, subscription_id, status::text FROM recommendation ORDER BY rule, subscription_id`,
      );
      assert.deepEqual(
        rows.rows.map((row) => [row.rule, row.subscription_id, row.status]),
        [
          ['above_category_average', fixture.subscriptionId, 'Pending'],
          ['duplicate_category', second.rows[0].subscription_id, 'Pending'],
        ],
      );

      await database.query(
        `UPDATE recommendation SET status = 'Dismissed', resolved_at = now() WHERE rule = 'above_category_average'`,
      );
      await database.query(
        `UPDATE subscription SET status = 'Cancelled', cancelled_at = now() WHERE subscription_id = $1`,
        [second.rows[0].subscription_id],
      );
      const third = await database.query('CALL generate_recommendations($1)', [fixture.userId]);
      assert.equal(third.rows[0].p_removed_count, 1);
      const remaining = await database.query(`SELECT rule, status::text FROM recommendation`);
      assert.deepEqual(remaining.rows, [{ rule: 'above_category_average', status: 'Dismissed' }]);

      await assert.rejects(
        database.query('CALL generate_recommendations(NULL)'),
        (error) => error.code === '22004',
      );
    });

    it('installs the spec triggers, views, procedure, and indexes', async () => {
      const result = await database.query(`
        SELECT
          to_regclass('public.idx_payment_history_completed_covering') IS NOT NULL AS has_covering_index,
          to_regclass('public.idx_subscription_renewal_date') IS NOT NULL AS has_renewal_index,
          EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_subscription_audit_terms' AND NOT tgisinternal
          ) AS has_audit_trigger,
          EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_payment_history_update_renewal' AND NOT tgisinternal
          ) AS has_renewal_trigger,
          to_regclass('public.renewal_reminders') IS NOT NULL AS has_reminder_view,
          to_regclass('public.monthly_spend_by_category') IS NOT NULL AS has_spend_view,
          EXISTS (
            SELECT 1 FROM pg_proc WHERE proname = 'generate_recommendations' AND prokind = 'p'
          ) AS has_procedure,
          (SELECT reloptions @> ARRAY['security_invoker=true']
           FROM pg_class WHERE oid = 'monthly_spend_by_category'::regclass) AS secure_view
      `);
      assert.deepEqual(result.rows[0], {
        has_audit_trigger: true,
        has_covering_index: true,
        has_procedure: true,
        has_reminder_view: true,
        has_renewal_index: true,
        has_renewal_trigger: true,
        has_spend_view: true,
        secure_view: true,
      });
    });
  });
}
