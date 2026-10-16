import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import request from 'supertest';

import { seedCatalog } from '../db/seeds/catalog.js';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { createNotificationRepository } from '../src/repositories/notificationRepository.js';
import { createReminderService } from '../src/services/reminderService.js';
import { testAppConfig } from './helpers/testConfig.js';

const expectedTestDatabaseName = 'smart_subscription_test';
const origin = testAppConfig.corsOrigin;
const password = 'correct horse battery staple';

async function register(client, suffix) {
  const response = await client
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({ name: `Notify ${suffix}`, email: `notify.${suffix}@example.invalid`, password });
  assert.equal(response.status, 201);
  return response.body;
}

async function insertSubscription(database, userId, options = {}) {
  const category = await database.query(
    `SELECT category_id FROM category ORDER BY category_id LIMIT 1`,
  );
  const result = await database.query(
    `
      INSERT INTO subscription (
        user_id, service_name, category_id, cost, currency_code, billing_cycle,
        status, start_date, renewal_date, archived_at, cancelled_at
      ) VALUES ($1, $2, $3, 12.00, 'USD', 'Monthly', $4, DATE '2026-01-01', $5, $6, $7)
      RETURNING subscription_id
    `,
    [
      userId,
      options.name ?? 'Custom Service',
      category.rows[0].category_id,
      options.status ?? 'Active',
      options.renewalDate ?? '2026-11-20',
      options.archivedAt ?? null,
      options.status === 'Cancelled' ? new Date() : null,
    ],
  );
  return String(result.rows[0].subscription_id);
}

if (!config.testDatabaseUrl) {
  test('notification integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('notification worker and API integration', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query(`SELECT current_database() AS database_name`);
      assert.equal(identity.rows[0].database_name, expectedTestDatabaseName);
      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });
      await runMigrations({ database });
      await seedCatalog(database);
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE notifications, subscription, auth_sessions, user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => database.close());

    test('creates one reminder under repeated and concurrent runs without changing billing data', async () => {
      const client = request.agent(app);
      const account = await register(client, 'worker');
      await database.query(
        `UPDATE user_preferences SET renewal_reminder_days = 3, timezone = 'UTC' WHERE user_id = $1`,
        [account.user.id],
      );
      const subscriptionId = await insertSubscription(database, account.user.id, {
        name: 'Safe Stream',
      });
      await database.query(
        `INSERT INTO payment_history (subscription_id, amount, currency_code, payment_date, payment_status)
         VALUES ($1, 12, 'USD', DATE '2026-10-20', 'completed')`,
        [subscriptionId],
      );
      // The renewal trigger advanced the date; pin it so the worker's effect can be checked.
      await database.query(
        `UPDATE subscription SET renewal_date = DATE '2026-11-20' WHERE subscription_id = $1`,
        [subscriptionId],
      );

      const repository = createNotificationRepository(database);
      const options = { clock: () => new Date('2026-11-17T12:00:00.000Z') };
      const first = await createReminderService(repository, options).runOnce();
      const second = await createReminderService(repository, options).runOnce();
      await database.query(`DELETE FROM notifications`);
      const concurrent = await Promise.all([
        createReminderService(repository, options).runOnce(),
        createReminderService(repository, options).runOnce(),
      ]);
      assert.equal(first.created, 1);
      assert.equal(second.created, 0);
      assert.equal(concurrent[0].created + concurrent[1].created, 1);

      const stored = await database.query(
        `SELECT notification_type, target_event_date::text, title FROM notifications`,
      );
      assert.equal(stored.rowCount, 1);
      assert.equal(stored.rows[0].target_event_date, '2026-11-20');
      assert.match(stored.rows[0].title, /Safe Stream/);
      const unchanged = await database.query(
        `SELECT renewal_date::text, (SELECT count(*)::INTEGER FROM payment_history) AS payments FROM subscription WHERE subscription_id = $1`,
        [subscriptionId],
      );
      assert.equal(unchanged.rows[0].renewal_date, '2026-11-20');
      assert.equal(unchanged.rows[0].payments, 1);
    });

    test('supports new target dates and respects disabled, cancelled, and archived states', async () => {
      const account = await register(request.agent(app), 'rules');
      const subscriptionId = await insertSubscription(database, account.user.id);
      const repository = createNotificationRepository(database);
      await createReminderService(repository, {
        clock: () => new Date('2026-11-17T12:00:00Z'),
      }).runOnce();
      await database.query(
        `UPDATE subscription SET renewal_date = DATE '2026-11-25' WHERE subscription_id = $1`,
        [subscriptionId],
      );
      const changed = await createReminderService(repository, {
        clock: () => new Date('2026-11-23T12:00:00Z'),
      }).runOnce();
      assert.equal(changed.created, 1);

      await database.query(
        `UPDATE user_preferences SET renewal_reminders_enabled = FALSE WHERE user_id = $1`,
        [account.user.id],
      );
      await insertSubscription(database, account.user.id, { name: 'Disabled' });
      await insertSubscription(database, account.user.id, {
        name: 'Cancelled',
        status: 'Cancelled',
        renewalDate: '2026-11-20',
      });
      await insertSubscription(database, account.user.id, {
        name: 'Archived',
        archivedAt: new Date(),
        renewalDate: '2026-11-20',
      });
      const disabled = await createReminderService(repository, {
        clock: () => new Date('2026-11-17T12:00:00Z'),
      }).runOnce();
      assert.equal(disabled.created, 0);
      const count = await database.query(`SELECT count(*)::INTEGER AS count FROM notifications`);
      assert.equal(count.rows[0].count, 2);
    });

    test('uses each user’s local date for the reminder window', async () => {
      const india = await register(request.agent(app), 'india');
      const york = await register(request.agent(app), 'york');
      await database.query(
        `UPDATE user_preferences SET timezone = 'Asia/Kolkata', renewal_reminder_days = 0 WHERE user_id = $1`,
        [india.user.id],
      );
      await database.query(
        `UPDATE user_preferences SET timezone = 'America/New_York', renewal_reminder_days = 0 WHERE user_id = $1`,
        [york.user.id],
      );
      await insertSubscription(database, india.user.id, { name: 'India Plan', renewalDate: '2026-11-17' });
      await insertSubscription(database, york.user.id, { name: 'York Plan', renewalDate: '2026-11-17' });
      // 02:00 UTC is 17 Nov in Kolkata but still 16 Nov in New York.
      const summary = await createReminderService(createNotificationRepository(database), {
        clock: () => new Date('2026-11-17T02:00:00Z'),
      }).runOnce();
      assert.equal(summary.created, 1);
      const rows = await database.query(`SELECT user_id, notification_type FROM notifications`);
      assert.equal(String(rows.rows[0].user_id), india.user.id);
      assert.equal(rows.rows[0].notification_type, 'renewal');
    });

    test('keyset pagination visits every candidate exactly once', async () => {
      const account = await register(request.agent(app), 'pages');
      for (let index = 0; index < 5; index += 1) {
        await insertSubscription(database, account.user.id, { name: `Paged ${index}` });
      }
      const summary = await createReminderService(createNotificationRepository(database), {
        batchSize: 2,
        clock: () => new Date('2026-11-17T12:00:00Z'),
      }).runOnce();
      assert.equal(summary.examined, 5);
      assert.equal(summary.created, 5);
    });

    test('provides protected, paginated, ownership-scoped read APIs', async () => {
      const clientA = request.agent(app);
      const clientB = request.agent(app);
      const a = await register(clientA, 'api-a');
      const b = await register(clientB, 'api-b');
      const subA = await insertSubscription(database, a.user.id, { name: 'A Service' });
      const subB = await insertSubscription(database, b.user.id, { name: 'B Service' });
      const insert = async (userId, subId, key, targetDate = '2026-11-20') => {
        const result = await database.query(
          `INSERT INTO notifications (user_id, subscription_id, notification_type, title, message, scheduled_for, target_event_date, deduplication_key)
           VALUES ($1, $2, 'renewal', $3, 'Message', CURRENT_TIMESTAMP, $4, $5) RETURNING id`,
          [userId, subId, `Title ${key}`, targetDate, key],
        );
        return String(result.rows[0].id);
      };
      const aId = await insert(a.user.id, subA, 'a-one');
      await insert(a.user.id, subA, 'a-two', '2026-12-20');
      const bId = await insert(b.user.id, subB, 'b-one');

      assert.equal((await request(app).get('/api/v1/notifications')).status, 401);
      const list = await clientA
        .get('/api/v1/notifications?limit=1&page=1&unreadOnly=true')
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(list.status, 200);
      assert.equal(list.body.notifications.length, 1);
      assert.equal(list.body.pagination.total, 2);
      const count = await clientA
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(count.body.count, 2);
      const forbidden = await clientA
        .patch(`/api/v1/notifications/${bId}/read`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(forbidden.status, 404);
      const invalid = await clientA
        .patch('/api/v1/notifications/not-a-number/read')
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(invalid.status, 400);
      const read = await clientA
        .patch(`/api/v1/notifications/${aId}/read`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(read.status, 200);
      assert.equal(read.body.notification.isRead, true);
      const repeated = await clientA
        .patch(`/api/v1/notifications/${aId}/read`)
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(repeated.status, 200);
      const all = await clientA
        .patch('/api/v1/notifications/read-all')
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(all.body.updatedCount, 1);
      const bCount = await clientB
        .get('/api/v1/notifications/unread-count')
        .set('Authorization', `Bearer ${b.accessToken}`);
      assert.equal(bCount.body.count, 1);
      await database.query(
        `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE user_id = $1`,
        [a.user.id],
      );
      const revoked = await clientA
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${a.accessToken}`);
      assert.equal(revoked.status, 401);
    });
  });
}
