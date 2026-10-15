import assert from 'node:assert/strict';
import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, beforeEach, describe, it, test } from 'node:test';

import { seedCatalog, categorySeeds, serviceSeeds } from '../db/seeds/catalog.js';
import { assertDemoSeedAllowed } from '../db/seeds/demo.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { defaultMigrationsDirectory, runMigrations } from '../src/db/migrationRunner.js';

const expectedTestDatabaseName = 'spendwise_test';

async function expectPostgresError(promise, expectedCode) {
  await assert.rejects(promise, (error) => error.code === expectedCode);
}

async function insertUser(database, suffix) {
  const result = await database.query(
    `
      INSERT INTO users (display_name, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id
    `,
    [
      `Test User ${suffix}`,
      `user.${suffix}@example.invalid`,
      '$2b$12$integrationfixturehash000000000000000000000000000000',
    ],
  );

  return result.rows[0].id;
}

async function insertCategory(database, name = 'Test Category') {
  const result = await database.query(`INSERT INTO categories (name) VALUES ($1) RETURNING id`, [
    name,
  ]);
  return result.rows[0].id;
}

async function insertService(database, categoryId, name = 'Test Service') {
  const result = await database.query(
    `INSERT INTO services (name, default_category_id) VALUES ($1, $2) RETURNING id`,
    [name, categoryId],
  );
  return result.rows[0].id;
}

async function insertSubscription(database, { categoryId, serviceId, userId, planName = 'Plan' }) {
  const result = await database.query(
    `
      INSERT INTO subscriptions (
        user_id,
        service_id,
        category_id,
        plan_name,
        price,
        currency_code,
        billing_cycle,
        status,
        start_date,
        next_renewal_date
      )
      VALUES ($1, $2, $3, $4, 99.00, 'USD', 'monthly', 'active', DATE '2026-01-01', DATE '2026-11-01')
      RETURNING id
    `,
    [userId, serviceId, categoryId, planName],
  );
  return result.rows[0].id;
}

if (!config.testDatabaseUrl) {
  test('PostgreSQL integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated spendwise_test database.',
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
        'Destructive integration tests may run only against spendwise_test.',
      );

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      const migrationResult = await runMigrations({ database });
      assert.deepEqual(migrationResult.applied, [
        '001_initial_schema',
        '002_auth_sessions',
        '003_notification_target_dates',
      ]);
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE
          auth_sessions,
          recommendation_subscriptions,
          recommendations,
          notifications,
          refunds,
          payments,
          subscriptions,
          services,
          categories,
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
        'categories',
        'notifications',
        'payments',
        'recommendations',
        'recommendation_subscriptions',
        'refunds',
        'schema_migrations',
        'services',
        'subscriptions',
        'user_preferences',
        'users',
      ]) {
        assert.ok(tableNames.includes(requiredTable), `${requiredTable} should exist`);
      }

      const columns = await database.query(`
        SELECT table_name, column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name IN ('users', 'subscriptions', 'payments', 'refunds')
      `);
      const availableColumns = new Set(
        columns.rows.map((row) => `${row.table_name}.${row.column_name}`),
      );

      for (const requiredColumn of [
        'users.email',
        'users.password_hash',
        'subscriptions.user_id',
        'subscriptions.service_id',
        'subscriptions.custom_service_name',
        'subscriptions.archived_at',
        'payments.subscription_id',
        'payments.payment_status',
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
        'fk_payments_subscription',
        'fk_notifications_owned_subscription',
        'fk_recommendation_subscriptions_owned_subscription',
        'chk_subscriptions_service_source',
        'chk_payments_status',
      ]) {
        assert.ok(constraintNames.has(constraintName), `${constraintName} should exist`);
      }
    });

    it('enforces email uniqueness, subscription checks, references, and ownership', async () => {
      const firstUserId = await insertUser(database, 'integrity-one');
      const secondUserId = await insertUser(database, 'integrity-two');
      const categoryId = await insertCategory(database);
      const serviceId = await insertService(database, categoryId);
      const subscriptionId = await insertSubscription(database, {
        categoryId,
        serviceId,
        userId: firstUserId,
      });

      await expectPostgresError(
        database.query(
          `INSERT INTO users (display_name, email, password_hash) VALUES ($1, $2, $3)`,
          [
            'Duplicate Case',
            'USER.INTEGRITY-ONE@EXAMPLE.INVALID',
            '$2b$12$integrationfixturehash000000000000000000000000000000',
          ],
        ),
        '23505',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO subscriptions (
              user_id, service_id, category_id, price, currency_code, billing_cycle,
              status, start_date, next_renewal_date
            ) VALUES ($1, $2, $3, -1, 'USD', 'monthly', 'active', CURRENT_DATE, CURRENT_DATE)
          `,
          [firstUserId, serviceId, categoryId],
        ),
        '23514',
      );

      for (const [column, invalidValue] of [
        ['billing_cycle', 'weekly'],
        ['status', 'unknown'],
        ['currency_code', 'usd'],
      ]) {
        await expectPostgresError(
          database.query(`UPDATE subscriptions SET ${column} = $1 WHERE id = $2`, [
            invalidValue,
            subscriptionId,
          ]),
          '23514',
        );
      }

      await expectPostgresError(
        database.query(
          `
            INSERT INTO subscriptions (
              user_id, custom_service_name, category_id, price, currency_code,
              billing_cycle, status, start_date, next_renewal_date
            ) VALUES (999999, 'Missing Owner', $1, 1, 'USD', 'monthly', 'active', CURRENT_DATE, CURRENT_DATE)
          `,
          [categoryId],
        ),
        '23503',
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO payments (
              subscription_id, amount, currency_code, payment_date, payment_status
            ) VALUES (999999, 1, 'USD', CURRENT_DATE, 'completed')
          `,
        ),
        '23503',
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
      const recommendation = await database.query(
        `
          INSERT INTO recommendations (
            user_id, recommendation_type, explanation, rule_version
          ) VALUES ($1, 'price_outlier', 'Test explanation', 'test-v1')
          RETURNING id
        `,
        [secondUserId],
      );
      await expectPostgresError(
        database.query(
          `
            INSERT INTO recommendation_subscriptions (
              recommendation_id, subscription_id, user_id
            ) VALUES ($1, $2, $3)
          `,
          [recommendation.rows[0].id, subscriptionId, secondUserId],
        ),
        '23503',
      );
      await expectPostgresError(
        database.query(`DELETE FROM users WHERE id = $1`, [firstUserId]),
        '23001',
      );
    });

    it('supports required relationships and parameterized ownership queries', async () => {
      const userId = await insertUser(database, 'relationships');
      const secondUserId = await insertUser(database, 'relationships-two');
      const categoryId = await insertCategory(database, 'Relationship Category');
      const serviceId = await insertService(database, categoryId, 'Shared Relationship Service');
      const firstSubscriptionId = await insertSubscription(database, {
        categoryId,
        planName: 'First Plan',
        serviceId,
        userId,
      });
      await insertSubscription(database, {
        categoryId,
        planName: 'Second Plan',
        serviceId,
        userId,
      });
      await insertSubscription(database, {
        categoryId,
        planName: 'Other User Plan',
        serviceId,
        userId: secondUserId,
      });

      await database.query(
        `
          INSERT INTO payments (
            subscription_id, amount, currency_code, payment_date, payment_status
          ) VALUES
            ($1, 10, 'USD', DATE '2026-08-01', 'completed'),
            ($1, 10, 'USD', DATE '2026-09-01', 'completed')
        `,
        [firstSubscriptionId],
      );

      const subscriptions = await database.query(
        `
          SELECT sub.id, svc.name AS service_name, cat.name AS category_name
          FROM subscriptions AS sub
          LEFT JOIN services AS svc ON svc.id = sub.service_id
          INNER JOIN categories AS cat ON cat.id = sub.category_id
          WHERE sub.user_id = $1
          ORDER BY sub.id
        `,
        [userId],
      );
      const payments = await database.query(
        `SELECT id FROM payments WHERE subscription_id = $1 ORDER BY payment_date`,
        [firstSubscriptionId],
      );
      const activeCount = await database.query(
        `SELECT count(*)::INTEGER AS count FROM subscriptions WHERE user_id = $1 AND status = $2`,
        [userId, 'active'],
      );

      assert.equal(subscriptions.rowCount, 2);
      assert.equal(subscriptions.rows[0].service_name, 'Shared Relationship Service');
      assert.equal(subscriptions.rows[0].category_name, 'Relationship Category');
      assert.equal(payments.rowCount, 2);
      assert.equal(activeCount.rows[0].count, 2);
    });

    it('commits successful transactions and rolls back failed transactions', async () => {
      await database.withTransaction(async (transaction) => {
        await transaction.query(`INSERT INTO categories (name, description) VALUES ($1, $2)`, [
          'Committed Category',
          'Should persist.',
        ]);
      });

      const committed = await database.query(`SELECT count(*)::INTEGER AS count FROM categories`);
      assert.equal(committed.rows[0].count, 1);

      await assert.rejects(
        database.withTransaction(async (transaction) => {
          await transaction.query(`INSERT INTO categories (name) VALUES ($1)`, [
            'Rolled Back Category',
          ]);
          await transaction.query(`INSERT INTO categories (name) VALUES ($1)`, [
            'Rolled Back Category',
          ]);
        }),
      );

      const afterRollback = await database.query(
        `SELECT count(*)::INTEGER AS count FROM categories WHERE name = $1`,
        ['Rolled Back Category'],
      );
      assert.equal(afterRollback.rows[0].count, 0);
    });

    it('tracks migrations, skips reruns, and rolls back an invalid migration', async () => {
      const secondRun = await runMigrations({ database });
      assert.deepEqual(secondRun.applied, []);
      assert.deepEqual(secondRun.skipped, [
        '001_initial_schema',
        '002_auth_sessions',
        '003_notification_target_dates',
      ]);

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
        await copyFile(
          path.join(defaultMigrationsDirectory, '001_initial_schema.sql'),
          path.join(temporaryDirectory, '001_initial_schema.sql'),
        );
        await copyFile(
          path.join(defaultMigrationsDirectory, '002_auth_sessions.sql'),
          path.join(temporaryDirectory, '002_auth_sessions.sql'),
        );
        await copyFile(
          path.join(defaultMigrationsDirectory, '003_notification_target_dates.sql'),
          path.join(temporaryDirectory, '003_notification_target_dates.sql'),
        );
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

      const categoryCount = await database.query(
        `SELECT count(*)::INTEGER AS count FROM categories`,
      );
      const serviceCount = await database.query(`SELECT count(*)::INTEGER AS count FROM services`);

      assert.equal(categoryCount.rows[0].count, categorySeeds.length);
      assert.equal(serviceCount.rows[0].count, serviceSeeds.length);
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
