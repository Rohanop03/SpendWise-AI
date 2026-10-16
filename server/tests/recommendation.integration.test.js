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
      email: `recommend.${suffix}@example.invalid`,
      name: `Recommend ${suffix}`,
      password,
    });
  assert.equal(response.status, 201);
  return response.body;
}

// Each test user gets a private currency so rule 2's cross-user average stays predictable.
async function insertSubscription(database, userId, name, cost, currency) {
  const category = await database.query(
    `SELECT category_id FROM category WHERE category_name = 'Entertainment'`,
  );
  const result = await database.query(
    `INSERT INTO subscription (user_id, service_name, category_id, cost, currency_code, billing_cycle, start_date, renewal_date)
     VALUES ($1, $2, $3, $4, $5, 'Monthly', DATE '2026-01-01', DATE '2026-11-01') RETURNING subscription_id`,
    [userId, name, category.rows[0].category_id, cost, currency],
  );
  return String(result.rows[0].subscription_id);
}

if (!config.testDatabaseUrl) {
  test('recommendation integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to smart_subscription_test.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('recommendation persistence and APIs', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query('SELECT current_database() database_name');
      assert.equal(identity.rows[0].database_name, 'smart_subscription_test');
      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });
      await runMigrations({ database });
      await seedCatalog(database);
    });
    beforeEach(async () => {
      await database.query(
        'TRUNCATE TABLE recommendation, subscription, auth_sessions, user_preferences, users RESTART IDENTITY CASCADE',
      );
    });
    after(async () => database.close());

    test('requires authentication and persists concurrent generation idempotently', async () => {
      assert.equal((await request(app).post('/api/v1/recommendations/generate')).status, 401);
      const client = request.agent(app);
      const account = await register(client, 'concurrent');
      await insertSubscription(database, account.user.id, 'Stream One', '10.00', 'XAA');
      await insertSubscription(database, account.user.id, 'Stream Two', '6.00', 'XAA');
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
        "SELECT count(*)::integer count FROM recommendation WHERE rule = 'duplicate_category'",
      );
      assert.equal(duplicates.rows[0].count, 1);
    });

    test('preserves dismissal, updates facts, and removes stale Pending recommendations', async () => {
      const client = request.agent(app);
      const account = await register(client, 'lifecycle');
      const firstId = await insertSubscription(database, account.user.id, 'Lifecycle A', '10.00', 'XAB');
      const secondId = await insertSubscription(database, account.user.id, 'Lifecycle B', '6.00', 'XAB');
      const auth = { Authorization: `Bearer ${account.accessToken}` };
      await client.post('/api/v1/recommendations/generate').set(auth);
      const list = await client.get('/api/v1/recommendations?rule=duplicate_category').set(auth);
      const recommendation = list.body.recommendations[0];
      assert.equal(recommendation.subscriptionId, secondId);
      assert.equal(recommendation.potentialSavings, '6.00');
      assert.equal(recommendation.status, 'Pending');
      assert.match(recommendation.recommendationText, /cancelling Lifecycle B would save XAB 6\.00\/month/);

      const dismissed = await client
        .patch(`/api/v1/recommendations/${recommendation.id}`)
        .set(auth)
        .send({ status: 'Dismissed' });
      assert.equal(dismissed.status, 200);
      assert.equal(dismissed.body.recommendation.status, 'Dismissed');

      await database.query('UPDATE subscription SET cost = 4.00 WHERE subscription_id = $1', [secondId]);
      await client.post('/api/v1/recommendations/generate').set(auth);
      const afterUpdate = await client
        .get('/api/v1/recommendations?status=Dismissed&rule=duplicate_category')
        .set(auth);
      assert.equal(afterUpdate.body.recommendations[0].potentialSavings, '4.00');

      // Back to Pending, then make it stale: the Pending row disappears.
      await client.patch(`/api/v1/recommendations/${recommendation.id}`).set(auth).send({ status: 'Pending' });
      await database.query(
        "UPDATE subscription SET status = 'Cancelled', cancelled_at = CURRENT_TIMESTAMP WHERE subscription_id = $1",
        [firstId],
      );
      await client.post('/api/v1/recommendations/generate').set(auth);
      const remaining = await client.get('/api/v1/recommendations?status=all').set(auth);
      assert.equal(remaining.body.recommendations.length, 0);
    });

    test('enforces ownership with non-disclosing 404 responses and validates filters', async () => {
      const clientA = request.agent(app);
      const clientB = request.agent(app);
      const a = await register(clientA, 'owner-a');
      const b = await register(clientB, 'owner-b');
      await insertSubscription(database, a.user.id, 'Owner A', '10.00', 'XAC');
      await insertSubscription(database, a.user.id, 'Owner A2', '5.00', 'XAC');
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
        .send({ status: 'Dismissed' });
      assert.equal(update.status, 404);
      for (const path of [
        '/api/v1/recommendations?sortBy=id;DROP TABLE users',
        '/api/v1/recommendations?status=active',
        '/api/v1/recommendations/not-a-number',
      ]) {
        assert.equal(
          (await clientA.get(path).set('Authorization', `Bearer ${a.accessToken}`)).status,
          400,
          path,
        );
      }
    });
  });
}
