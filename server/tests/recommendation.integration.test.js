import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import request from 'supertest';

import { seedCatalog } from '../db/seeds/catalog.js';
import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { testAppConfig } from './helpers/testConfig.js';

const origin = testAppConfig.corsOrigin;
const password = 'correct horse battery staple';

async function register(client, suffix) {
  const response = await client
    .post('/api/v1/auth/register')
    .set('Origin', origin)
    .set('X-Requested-With', 'XMLHttpRequest')
    .send({
      displayName: `Recommend ${suffix}`,
      email: `recommend.${suffix}@example.invalid`,
      password,
    });
  assert.equal(response.status, 201);
  return response.body;
}

async function insertSubscription(database, userId, name, price = '10.00') {
  const category = await database.query('SELECT id FROM categories ORDER BY id LIMIT 1');
  const result = await database.query(
    `INSERT INTO subscriptions (user_id, custom_service_name, category_id, price, currency_code, billing_cycle, status, start_date, next_renewal_date)
     VALUES ($1, $2, $3, $4, 'USD', 'monthly', 'active', DATE '2026-01-01', DATE '2026-11-01') RETURNING id`,
    [userId, name, category.rows[0].id, price],
  );
  return String(result.rows[0].id);
}

if (!config.testDatabaseUrl) {
  test('recommendation integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to spendwise_test.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('recommendation persistence and APIs', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query('SELECT current_database() database_name');
      assert.equal(identity.rows[0].database_name, 'spendwise_test');
      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });
      await runMigrations({ database });
      await seedCatalog(database);
    });
    beforeEach(async () => {
      await database.query(
        'TRUNCATE TABLE recommendations, subscriptions, auth_sessions, user_preferences, users RESTART IDENTITY CASCADE',
      );
    });
    after(async () => database.close());

    test('requires authentication and persists concurrent generation idempotently', async () => {
      assert.equal((await request(app).post('/api/v1/recommendations/generate')).status, 401);
      const client = request.agent(app);
      const account = await register(client, 'concurrent');
      await insertSubscription(database, account.user.id, 'Same Name', '10.00');
      await insertSubscription(database, account.user.id, ' same   name ', '6.00');
      const call = () =>
        client
          .post('/api/v1/recommendations/generate')
          .set('Authorization', `Bearer ${account.accessToken}`);
      const responses = await Promise.all([call(), call()]);
      assert.deepEqual(
        responses.map((response) => response.status),
        [200, 200],
      );
      const duplicates = await database.query(
        "SELECT count(*)::integer count FROM recommendations WHERE recommendation_type = 'exact_duplicate'",
      );
      assert.equal(duplicates.rows[0].count, 1);
      const relations = await database.query(
        'SELECT count(*)::integer count FROM recommendation_subscriptions',
      );
      assert.ok(relations.rows[0].count >= 2);
    });

    test('preserves dismissal, updates facts, and retires stale recommendations', async () => {
      const client = request.agent(app);
      const account = await register(client, 'lifecycle');
      const firstId = await insertSubscription(database, account.user.id, 'Lifecycle', '10.00');
      const secondId = await insertSubscription(database, account.user.id, 'lifecycle', '6.00');
      const auth = { Authorization: `Bearer ${account.accessToken}` };
      await client.post('/api/v1/recommendations/generate').set(auth);
      const list = await client.get('/api/v1/recommendations?type=exact_duplicate').set(auth);
      const recommendation = list.body.recommendations[0];
      assert.equal(recommendation.estimatedSavings, '6.00');
      assert.equal(
        (
          await client
            .patch(`/api/v1/recommendations/${recommendation.id}`)
            .set(auth)
            .send({ status: 'dismissed' })
        ).status,
        200,
      );
      await database.query('UPDATE subscriptions SET price = 4.00 WHERE id = $1', [secondId]);
      await client.post('/api/v1/recommendations/generate').set(auth);
      const dismissed = await client
        .get('/api/v1/recommendations?status=dismissed&type=exact_duplicate')
        .set(auth);
      assert.equal(dismissed.body.recommendations[0].estimatedSavings, '4.00');
      await database.query(
        "UPDATE subscriptions SET status = 'cancelled', next_renewal_date = NULL, cancelled_at = CURRENT_TIMESTAMP WHERE id = $1",
        [firstId],
      );
      await client
        .patch(`/api/v1/recommendations/${recommendation.id}`)
        .set(auth)
        .send({ status: 'active' });
      await client.post('/api/v1/recommendations/generate').set(auth);
      const inactive = await client
        .get('/api/v1/recommendations?status=inactive&type=exact_duplicate')
        .set(auth);
      assert.equal(inactive.body.recommendations.length, 1);
    });

    test('enforces ownership with non-disclosing 404 responses and validates filters', async () => {
      const clientA = request.agent(app);
      const clientB = request.agent(app);
      const a = await register(clientA, 'owner-a');
      const b = await register(clientB, 'owner-b');
      await insertSubscription(database, a.user.id, 'Owner A');
      await insertSubscription(database, a.user.id, 'owner a');
      await clientA
        .post('/api/v1/recommendations/generate')
        .set('Authorization', `Bearer ${a.accessToken}`);
      const list = await clientA
        .get('/api/v1/recommendations')
        .set('Authorization', `Bearer ${a.accessToken}`);
      const id = list.body.recommendations[0].id;
      const forbidden = await clientB
        .get(`/api/v1/recommendations/${id}`)
        .set('Authorization', `Bearer ${b.accessToken}`);
      assert.equal(forbidden.status, 404);
      const update = await clientB
        .patch(`/api/v1/recommendations/${id}`)
        .set('Authorization', `Bearer ${b.accessToken}`)
        .send({ status: 'dismissed' });
      assert.equal(update.status, 404);
      assert.equal(
        (
          await clientA
            .get('/api/v1/recommendations?sortBy=id;DROP TABLE users')
            .set('Authorization', `Bearer ${a.accessToken}`)
        ).status,
        400,
      );
      assert.equal(
        (
          await clientA
            .get('/api/v1/recommendations/not-a-number')
            .set('Authorization', `Bearer ${a.accessToken}`)
        ).status,
        400,
      );
    });
  });
}
