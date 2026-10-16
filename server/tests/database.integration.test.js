import assert from 'node:assert/strict';
import { copyFile, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, test } from 'node:test';

import { seedCatalog, categorySeeds, serviceSeeds } from '../db/seeds/catalog.js';
import { assertDemoSeedAllowed } from '../db/seeds/demo.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { defaultMigrationsDirectory, runMigrations } from '../src/db/migrationRunner.js';

const expectedTestDatabaseName = 'smart_subscription_test';
const allMigrations = [
  '001_initial_schema',
  '002_auth_sessions',
  '003_notification_target_dates',
  '004_ai_cost_optimization',
  '005_advanced_dbms',
  '006_spec_schema_alignment',
  '007_spec_db_objects',
  '008_drop_recommendation_subscriptions',
];

async function expectPostgresError(promise, expectedCode, expectedConstraint) {
  const expectedCodes = Array.isArray(expectedCode) ? expectedCode : [expectedCode];

  await assert.rejects(
    promise,
    (error) =>
      expectedCodes.includes(error.code) &&
      (expectedConstraint === undefined || error.constraint === expectedConstraint),
  );
}

async function insertUser(database, suffix) {
  const result = await database.query(
    `
      INSERT INTO users (name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING user_id
    `,
    [
      `Test User ${suffix}`,
      `user.${suffix}@example.invalid`,
      '$2b$12$integrationfixturehash000000000000000000000000000000',
    ],
  );

  return result.rows[0].user_id;
}

async function insertCategory(database, name = 'Test Category') {
  const result = await database.query(
    `INSERT INTO category (category_name) VALUES ($1) RETURNING category_id`,
    [name],
  );
  return result.rows[0].category_id;
}

async function insertSubscription(database, { categoryId, userId, serviceName = 'Service' }) {
  const result = await database.query(
    `
      INSERT INTO subscription (
        user_id, category_id, service_name, cost, currency_code, billing_cycle,
        start_date, renewal_date
      )
      VALUES ($1, $2, $3, 99.00, 'USD', 'Monthly', DATE '2026-01-01', DATE '2026-11-01')
      RETURNING subscription_id
    `,
    [userId, categoryId, serviceName],
  );
  return result.rows[0].subscription_id;
}

if (!config.testDatabaseUrl) {
  test('PostgreSQL integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });

  describe('PostgreSQL schema integration', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query(
        `SELECT current_database() AS database_name, current_user AS database_user`,
      );

      assert.equal(
        identity.rows[0].database_name,
        expectedTestDatabaseName,
        'Destructive integration tests may run only against smart_subscription_test.',
      );

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      const migrationResult = await runMigrations({ database });
      assert.deepEqual(migrationResult.applied, allMigrations);
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE
          auth_sessions,
          recommendation,
          notifications,
          refunds,
          payment_history,
          subscription,
          services,
          category,
          user_preferences,
          users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => {
      await database.close();
    });

    it('creates every required table, primary key, and foreign key', async () => {
      const tables = await database.query(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
      `);
      const tableNames = tables.rows.map((row) => row.table_name);

      for (const requiredTable of [
        'auth_sessions',
        'category',
        'notifications',
        'payment_history',
        'recommendation',
        'refunds',
        'schema_migrations',
        'services',
        'subscription',
        'subscription_audit_events',
        'user_preferences',
        'users',
      ]) {
        assert.ok(tableNames.includes(requiredTable), `${requiredTable} should exist`);
      }
      assert.ok(!tableNames.includes('recommendation_subscriptions'), 'link table is dropped');

      const columns = await database.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('users', 'subscription', 'payment_history', 'refunds', 'recommendation')
      `);
      const availableColumns = new Set(
        columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
      );

      for (const requiredColumn of [
        'users.user_id',
        'users.name',
        'users.email',
        'users.password_hash',
        'subscription.user_id',
        'subscription.service_name',
        'subscription.cost',
        'subscription.renewal_date',
        'subscription.last_used_date',
        'subscription.archived_at',
        'payment_history.subscription_id',
        'payment_history.payment_status',
        'recommendation.subscription_id',
        'recommendation.recommendation_text',
        'recommendation.potential_savings',
        'recommendation.generated_date',
        'refunds.payment_id',
        'refunds.refund_status',
      ]) {
        assert.ok(availableColumns.has(requiredColumn), `${requiredColumn} should exist`);
      }

      const constraints = await database.query(`
        SELECT conname, contype
        FROM pg_constraint
        WHERE connamespace = 'public'::regnamespace
      `);
      const constraintNames = new Set(constraints.rows.map((row) => row.conname));
      const countByType = (type) =>
        constraints.rows.filter((constraint) => constraint.contype === type).length;

      assert.ok(countByType('p') >= 11, 'primary keys should exist');
      assert.ok(countByType('f') >= 13, 'foreign keys should exist');
      assert.ok(countByType('c') >= 20, 'check constraints should exist');
      for (const constraintName of [
        'fk_payment_history_subscription',
        'fk_payment_history_subscription_currency',
        'fk_notifications_owned_subscription',
        'fk_recommendation_owned_subscription',
        'chk_subscription_cost',
        'chk_payment_history_status',
      ]) {
        assert.ok(constraintNames.has(constraintName), `${constraintName} should exist`);
      }
    });

    it('enforces email uniqueness, subscription checks, references, and ownership', async () => {
      const firstUserId = await insertUser(database, 'integrity-one');
      const secondUserId = await insertUser(database, 'integrity-two');
      const categoryId = await insertCategory(database);
      const subscriptionId = await insertSubscription(database, {
        categoryId,
        userId: firstUserId,
      });

      await expectPostgresError(
        database.query(`INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3)`, [
          'Duplicate Case',
          'USER.INTEGRITY-ONE@EXAMPLE.INVALID',
          '$2b$12$integrationfixturehash000000000000000000000000000000',
        ]),
        '23505',
      );
      for (const cost of [-1, 0]) {
        await expectPostgresError(
          database.query(
            `
              INSERT INTO subscription (
                user_id, category_id, service_name, cost, currency_code, billing_cycle,
                start_date, renewal_date
              ) VALUES ($1, $2, 'Bad cost', $3, 'USD', 'Monthly', CURRENT_DATE, CURRENT_DATE)
            `,
            [firstUserId, categoryId, cost],
          ),
          '23514',
          'chk_subscription_cost',
        );
      }

      // Enum columns reject unknown labels (22P02); CHECK columns reject bad formats (23514).
      for (const [column, invalidValue, code] of [
        ['billing_cycle', 'weekly', '22P02'],
        ['billing_cycle', 'monthly', '22P02'],
        ['status', 'unknown', '22P02'],
        ['currency_code', 'usd', '23514'],
      ]) {
        await expectPostgresError(
          database.query(`UPDATE subscription SET ${column} = $1 WHERE subscription_id = $2`, [
            invalidValue,
            subscriptionId,
          ]),
          code,
        );
      }

      await expectPostgresError(
        database.query(
          `
            INSERT INTO subscription (
              user_id, service_name, category_id, cost, currency_code,
              billing_cycle, start_date, renewal_date
            ) VALUES (999999, 'Missing Owner', $1, 1, 'USD', 'Monthly', CURRENT_DATE, CURRENT_DATE)
          `,
          [categoryId],
        ),
        '23503',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO payment_history (
              subscription_id, amount, currency_code, payment_date, payment_status
            ) VALUES (999999, 1, 'USD', CURRENT_DATE, 'completed')
          `,
        ),
        '23503',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO payment_history (
              subscription_id, amount, currency_code, payment_date, payment_status
            ) VALUES ($1, 1, 'EUR', CURRENT_DATE, 'completed')
          `,
          [subscriptionId],
        ),
        '23503',
        'fk_payment_history_subscription_currency',
      );
      await expectPostgresError(
        database.query(
          `INSERT INTO user_preferences (user_id, renewal_reminder_days) VALUES ($1, 366)`,
          [secondUserId],
        ),
        '23514',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO notifications (
              user_id, subscription_id, notification_type, title, message,
              scheduled_for, target_event_date, deduplication_key
            ) VALUES ($1, $2, 'renewal', 'Wrong owner', 'Must fail', CURRENT_TIMESTAMP, CURRENT_DATE, 'wrong-owner')
          `,
          [secondUserId, subscriptionId],
        ),
        '23503',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO recommendation (
              user_id, subscription_id, rule, title, recommendation_text, priority, suggested_action
            ) VALUES ($1, $2, 'duplicate_category', 'Test', 'Wrong owner', 'medium', 'Review.')
          `,
          [secondUserId, subscriptionId],
        ),
        '23503',
        'fk_recommendation_owned_subscription',
      );
      await expectPostgresError(
        database.query(`DELETE FROM users WHERE user_id = $1`, [firstUserId]),
        ['23001', '23503'],
        'fk_subscription_user',
      );
    });

    it('supports required relationships and parameterized ownership queries', async () => {
      const userId = await insertUser(database, 'relationships');
      const secondUserId = await insertUser(database, 'relationships-two');
      const categoryId = await insertCategory(database, 'Relationship Category');
      const firstSubscriptionId = await insertSubscription(database, {
        categoryId,
        serviceName: 'Shared Relationship Service',
        userId,
      });
      await insertSubscription(database, { categoryId, serviceName: 'Second', userId });
      await insertSubscription(database, { categoryId, serviceName: 'Other', userId: secondUserId });

      await database.query(
        `
          INSERT INTO payment_history (
            subscription_id, amount, currency_code, payment_date, payment_status
          ) VALUES
            ($1, 10, 'USD', DATE '2026-08-01', 'completed'),
            ($1, 10, 'USD', DATE '2026-09-01', 'completed')
        `,
        [firstSubscriptionId],
      );

      const subscriptions = await database.query(
        `
          SELECT sub.subscription_id, sub.service_name, cat.category_name
          FROM subscription AS sub
          INNER JOIN category AS cat ON cat.category_id = sub.category_id
          WHERE sub.user_id = $1
          ORDER BY sub.subscription_id
        `,
        [userId],
      );
      const payments = await database.query(
        `SELECT payment_id FROM payment_history WHERE subscription_id = $1 ORDER BY payment_date`,
        [firstSubscriptionId],
      );
      const activeCount = await database.query(
        `SELECT count(*)::INTEGER AS count FROM subscription WHERE user_id = $1 AND status = $2`,
        [userId, 'Active'],
      );

      assert.equal(subscriptions.rowCount, 2);
      assert.equal(subscriptions.rows[0].service_name, 'Shared Relationship Service');
      assert.equal(subscriptions.rows[0].category_name, 'Relationship Category');
      assert.equal(payments.rowCount, 2);
      assert.equal(activeCount.rows[0].count, 2);
    });

    it('commits successful transactions and rolls back failed transactions', async () => {
      await database.withTransaction(async (transaction) => {
        await transaction.query(
          `INSERT INTO category (category_name, description) VALUES ($1, $2)`,
          ['Committed Category', 'Should persist.'],
        );
      });

      const committed = await database.query(`SELECT count(*)::INTEGER AS count FROM category`);
      assert.equal(committed.rows[0].count, 1);

      await assert.rejects(
        database.withTransaction(async (transaction) => {
          await transaction.query(`INSERT INTO category (category_name) VALUES ($1)`, [
            'Rolled Back Category',
          ]);
          await transaction.query(`INSERT INTO category (category_name) VALUES ($1)`, [
            'Rolled Back Category',
          ]);
        }),
      );

      const afterRollback = await database.query(
        `SELECT count(*)::INTEGER AS count FROM category WHERE category_name = $1`,
        ['Rolled Back Category'],
      );
      assert.equal(afterRollback.rows[0].count, 0);
    });

    it('tracks migrations, skips reruns, and rolls back an invalid migration', async () => {
      const secondRun = await runMigrations({ database });
      assert.deepEqual(secondRun.applied, []);
      assert.deepEqual(secondRun.skipped, allMigrations);

      const initialTracking = await database.query(
        `SELECT checksum FROM schema_migrations WHERE migration_id = $1`,
        ['001_initial_schema'],
      );
      assert.equal(initialTracking.rowCount, 1);
      assert.match(initialTracking.rows[0].checksum.trim(), /^[0-9a-f]{64}$/);

      const temporaryDirectory = await mkdtemp(
        path.join(os.tmpdir(), 'spendwise-live-migrations-'),
      );

      try {
        for (const file of await readdir(defaultMigrationsDirectory)) {
          if (file.endsWith('.sql')) {
            await copyFile(
              path.join(defaultMigrationsDirectory, file),
              path.join(temporaryDirectory, file),
            );
          }
        }
        await writeFile(
          path.join(temporaryDirectory, '900_valid_probe.sql'),
          'CREATE TABLE stage3_valid_migration_probe (id INTEGER PRIMARY KEY);',
        );
        await writeFile(
          path.join(temporaryDirectory, '901_invalid_probe.sql'),
          'CREATE TABLE stage3_failed_migration_probe (id INTEGER); INVALID SQL;',
        );

        await assert.rejects(runMigrations({ database, migrationsDirectory: temporaryDirectory }));

        const validTable = await database.query(
          `SELECT to_regclass('public.stage3_valid_migration_probe') AS table_name`,
        );
        const failedTable = await database.query(
          `SELECT to_regclass('public.stage3_failed_migration_probe') AS table_name`,
        );
        const failedTracking = await database.query(
          `SELECT count(*)::INTEGER AS count FROM schema_migrations WHERE migration_id = $1`,
          ['901_invalid_probe'],
        );

        assert.equal(validTable.rows[0].table_name, 'stage3_valid_migration_probe');
        assert.equal(failedTable.rows[0].table_name, null);
        assert.equal(failedTracking.rows[0].count, 0);
      } finally {
        await database.query('DROP TABLE IF EXISTS stage3_valid_migration_probe');
        await database.query(
          `DELETE FROM schema_migrations WHERE migration_id IN ('900_valid_probe', '901_invalid_probe')`,
        );
        await rm(temporaryDirectory, { force: true, recursive: true });
      }
    });

    it('seeds reference data idempotently and blocks unsafe demo seeding', async () => {
      await seedCatalog(database);
      await seedCatalog(database);

      const categoryCount = await database.query(`SELECT count(*)::INTEGER AS count FROM category`);
      const serviceCount = await database.query(`SELECT count(*)::INTEGER AS count FROM services`);
      const utilities = await database.query(
        `SELECT 1 FROM category WHERE category_name = 'Utilities'`,
      );

      assert.equal(categoryCount.rows[0].count, categorySeeds.length);
      assert.equal(serviceCount.rows[0].count, serviceSeeds.length);
      assert.equal(utilities.rowCount, 1);
      assert.throws(
        () =>
          assertDemoSeedAllowed({
            allowDemoSeed: false,
            databaseName: expectedTestDatabaseName,
            nodeEnv: 'test',
          }),
        /Demo seeding requires/,
      );
    });
  });
}
