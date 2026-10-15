import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it, test } from 'node:test';

import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';

async function insertFixture(database) {
  const user = await database.query(
    `
      INSERT INTO users (display_name, email, password_hash)
      VALUES ('Advanced DBMS', 'advanced-dbms@example.invalid', '$2b$12$integrationfixturehash000000000000000000000000000000')
      RETURNING id
    `,
  );
  const category = await database.query(
    `INSERT INTO categories (name) VALUES ('Advanced DBMS') RETURNING id`,
  );
  const subscription = await database.query(
    `
      INSERT INTO subscriptions (
        user_id, custom_service_name, category_id, price, currency_code,
        billing_cycle, status, start_date, next_renewal_date
      ) VALUES ($1, 'Advanced fixture', $2, 120, 'USD', 'yearly', 'active',
        DATE '2026-01-01', DATE '2027-01-01')
      RETURNING id
    `,
    [user.rows[0].id, category.rows[0].id],
  );
  return {
    categoryId: category.rows[0].id,
    subscriptionId: subscription.rows[0].id,
    userId: user.rows[0].id,
  };
}

if (!config.testDatabaseUrl) {
  test('advanced PostgreSQL tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated spendwise_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });

  describe('advanced PostgreSQL objects', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query('SELECT current_database() AS database_name');
      assert.equal(identity.rows[0].database_name, 'spendwise_test');
      await runMigrations({ database });
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE
          subscription_audit_events, auth_sessions, recommendation_subscriptions,
          recommendations, notifications, refunds, payments, subscriptions, services,
          categories, user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => database.close());

    it('normalizes supported billing cycles and rejects invalid input', async () => {
      const result = await database.query(`
        SELECT
          spendwise_monthly_equivalent(120, 'monthly') AS monthly,
          spendwise_monthly_equivalent(120, 'quarterly') AS quarterly,
          spendwise_monthly_equivalent(120, 'yearly') AS yearly,
          spendwise_monthly_equivalent(100, 'yearly') AS uneven,
          spendwise_monthly_equivalent(NULL, 'monthly') AS null_amount
      `);
      assert.deepEqual(result.rows[0], {
        monthly: '120.00',
        null_amount: null,
        quarterly: '40.00',
        uneven: '8.33',
        yearly: '10.00',
      });
      await assert.rejects(
        database.query(`SELECT spendwise_monthly_equivalent(10, 'weekly')`),
        (error) => error.code === '22023',
      );
    });

    it('audits meaningful subscription changes without logging unrelated edits', async () => {
      const fixture = await insertFixture(database);
      await database.query(`UPDATE subscriptions SET plan_name = 'Renamed' WHERE id = $1`, [
        fixture.subscriptionId,
      ]);
      await database.query(
        `UPDATE subscriptions SET price = 144, billing_cycle = 'monthly' WHERE id = $1`,
        [fixture.subscriptionId],
      );
      const audit = await database.query(
        `SELECT changed_fields, old_values, new_values FROM subscription_audit_events`,
      );
      assert.equal(audit.rowCount, 1);
      assert.deepEqual(audit.rows[0].changed_fields, ['price', 'billing_cycle']);
      assert.equal(audit.rows[0].old_values.price, 120);
      assert.equal(audit.rows[0].new_values.billingCycle, 'monthly');

      await database.query(
        `UPDATE subscriptions SET next_renewal_date = DATE '2027-02-01' WHERE id = $1`,
        [fixture.subscriptionId],
      );

      await assert.rejects(
        database.withTransaction(async (transaction) => {
          await transaction.query(`UPDATE subscriptions SET price = 200 WHERE id = $1`, [
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

    it('exposes reusable financial views and avoids refund multiplication', async () => {
      const fixture = await insertFixture(database);
      const payment = await database.query(
        `
          INSERT INTO payments (
            subscription_id, amount, currency_code, payment_date, payment_status
          ) VALUES ($1, 120, 'USD', DATE '2026-06-01', 'completed')
          RETURNING id
        `,
        [fixture.subscriptionId],
      );
      await database.query(
        `
          INSERT INTO refunds (payment_id, amount, refund_date, refund_status)
          VALUES ($1, 10, DATE '2026-06-02', 'completed'),
                 ($1, 5, DATE '2026-06-03', 'completed')
        `,
        [payment.rows[0].id],
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

      await database.query(
        `UPDATE subscriptions SET archived_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [fixture.subscriptionId],
      );
      const archived = await database.query(`
        SELECT
          (SELECT count(*)::INTEGER FROM active_subscription_commitments) AS commitments,
          (SELECT count(*)::INTEGER FROM completed_payment_financials) AS financial_rows
      `);
      assert.deepEqual(archived.rows[0], { commitments: 0, financial_rows: 1 });
    });

    it('retires only stale active recommendations for the requested user and rule', async () => {
      const fixture = await insertFixture(database);
      await database.query(
        `
          INSERT INTO recommendations (
            user_id, recommendation_type, title, explanation, rule_version, priority,
            confidence, suggested_action, recommendation_key, source_fingerprint
          ) VALUES
            ($1, 'price_outlier', 'Keep', 'Keep', 'stage10-v1', 'medium', 'high', 'Keep', 'keep', repeat('1', 64)),
            ($1, 'price_outlier', 'Retire', 'Retire', 'stage10-v1', 'medium', 'high', 'Retire', 'retire', repeat('2', 64))
        `,
        [fixture.userId],
      );
      const call = await database.query(
        `CALL spendwise_retire_stale_recommendations($1, 'stage10-v1', $2::varchar[], CURRENT_TIMESTAMP, 0)`,
        [fixture.userId, ['keep']],
      );
      const records = await database.query(
        `SELECT recommendation_key, status FROM recommendations ORDER BY recommendation_key`,
      );
      assert.equal(call.rows[0].p_retired_count, 1);
      assert.deepEqual(records.rows, [
        { recommendation_key: 'keep', status: 'active' },
        { recommendation_key: 'retire', status: 'inactive' },
      ]);
      await assert.rejects(
        database.query(
          `CALL spendwise_retire_stale_recommendations($1, NULL, $2::varchar[], CURRENT_TIMESTAMP, 0)`,
          [fixture.userId, []],
        ),
        (error) => error.code === '22004',
      );
    });

    it('installs the trigger, security-invoker views, and covering partial index', async () => {
      const result = await database.query(`
        SELECT
          to_regclass('public.idx_payments_completed_subscription_covering') IS NOT NULL AS has_index,
          EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'trg_subscriptions_audit_terms' AND NOT tgisinternal
          ) AS has_trigger,
          (SELECT reloptions @> ARRAY['security_invoker=true']
           FROM pg_class WHERE oid = 'active_subscription_commitments'::regclass) AS secure_view
      `);
      assert.deepEqual(result.rows[0], { has_index: true, has_trigger: true, secure_view: true });
    });
  });
}
