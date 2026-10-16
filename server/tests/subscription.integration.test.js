import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { seedCatalog } from '../db/seeds/catalog.js';
import { testAppConfig } from './helpers/testConfig.js';

const origin = testAppConfig.corsOrigin;
const password = 'correct horse battery staple';
const expectedTestDatabaseName = 'smart_subscription_test';

function csrfPost(client, path) {
  return client.post(path).set('Origin', origin).set('X-Requested-With', 'XMLHttpRequest');
}

async function registerUser(client, suffix = 'user1') {
  const response = await csrfPost(client, '/api/v1/auth/register').send({
    email: `stage5.${suffix}@example.invalid`,
    name: `Stage 5 ${suffix}`,
    password,
  });
  assert.equal(response.status, 201);
  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  };
}

if (!config.testDatabaseUrl) {
  test('subscription integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('subscription and catalog API integration', { concurrency: 1 }, () => {
    let categoriesList = [];
    const category = (name) => String(categoriesList.find((c) => c.name === name).id);
    const subscriptionBody = (overrides = {}) => ({
      billingCycle: 'Monthly',
      categoryId: category('Entertainment'),
      cost: 10,
      currencyCode: 'USD',
      renewalDate: '2026-11-01',
      serviceName: 'Service',
      startDate: '2026-10-01',
      ...overrides,
    });

    before(async () => {
      const identity = await database.query('SELECT current_database() AS database_name');
      assert.equal(identity.rows[0].database_name, expectedTestDatabaseName);

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      await runMigrations({ database });
      await seedCatalog(database);

      const catResult = await database.query(
        'SELECT category_id AS id, category_name AS name FROM category ORDER BY category_name ASC',
      );
      categoriesList = catResult.rows;
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE subscription, auth_sessions, user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => {
      await database.close();
    });

    test('retrieves reference categories and services with optional search', async () => {
      const client = request.agent(app);

      const categoriesResponse = await client.get('/api/v1/categories');
      assert.equal(categoriesResponse.status, 200);
      const names = categoriesResponse.body.categories.map((cat) => cat.name);
      for (const name of ['Entertainment', 'Productivity', 'Fitness', 'Utilities']) {
        assert.ok(names.includes(name), `${name} should be seeded`);
      }

      const servicesResponse = await client.get('/api/v1/services');
      assert.equal(servicesResponse.status, 200);
      assert.ok(servicesResponse.body.services.some((svc) => svc.name === 'Netflix'));

      const searchResponse = await client.get('/api/v1/services?search=spot');
      assert.equal(searchResponse.status, 200);
      assert.equal(searchResponse.body.services.length, 1);
      assert.equal(searchResponse.body.services[0].name, 'Spotify');

      const wildcard = await client.get('/api/v1/services?search=%25');
      assert.equal(wildcard.body.services.length, 0, '% is matched literally');
    });

    test('rejects unauthenticated requests to subscription endpoints', async () => {
      const client = request.agent(app);

      assert.equal((await client.get('/api/v1/subscriptions')).status, 401);
      assert.equal((await client.post('/api/v1/subscriptions').send({})).status, 401);
      assert.equal((await client.delete('/api/v1/subscriptions/1')).status, 401);
    });

    test('creates subscriptions with the spec fields and value sets', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'alice');

      const created = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          subscriptionBody({
            notes: 'Standard 4K streaming plan',
            planName: 'Premium 4K',
            renewalDate: '2026-11-15',
            serviceName: 'Netflix',
            startDate: '2026-10-15',
            cost: 22.99,
          }),
        );

      assert.equal(created.status, 201);
      const subscription = created.body.subscription;
      assert.equal(subscription.serviceName, 'Netflix');
      assert.equal(subscription.cost, 22.99);
      assert.equal(subscription.billingCycle, 'Monthly');
      assert.equal(subscription.status, 'Active');
      assert.equal(subscription.renewalDate, '2026-11-15');
      assert.equal(subscription.lastUsedDate, null);
      assert.equal(subscription.cancelledAt, null);
      assert.equal(subscription.categoryName, 'Entertainment');

      const yearly = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(
          subscriptionBody({
            billingCycle: 'Yearly',
            cost: 150,
            renewalDate: '2027-10-15',
            serviceName: 'Campus Gym',
          }),
        );
      assert.equal(yearly.status, 201);
      assert.equal(yearly.body.subscription.monthlyEquivalent, 12.5);
    });

    test('validates cost, value sets, category and dates on creation', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'bob');
      const post = (body) =>
        client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(body);

      for (const body of [
        subscriptionBody({ cost: 0 }),
        subscriptionBody({ cost: -1 }),
        subscriptionBody({ billingCycle: 'Quarterly' }),
        subscriptionBody({ billingCycle: 'monthly' }),
        subscriptionBody({ status: 'Trial' }),
        subscriptionBody({ serviceName: '' }),
        subscriptionBody({ serviceName: 'x'.repeat(101) }),
        subscriptionBody({ renewalDate: undefined }),
        subscriptionBody({ renewalDate: '2026-09-01' }),
        subscriptionBody({ lastUsedDate: '2026-09-01' }),
        subscriptionBody({ customServiceName: 'Old field' }),
      ]) {
        const response = await post(body);
        assert.equal(response.status, 400, JSON.stringify(body));
      }

      const badCategory = await post(subscriptionBody({ categoryId: '999999' }));
      assert.equal(badCategory.status, 400);
      assert.equal(badCategory.body.code, 'INVALID_CATEGORY');
    });

    test('lists subscriptions with pagination, filtering, search, and sorting', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'charlie');
      const auth = { Authorization: `Bearer ${accessToken}` };

      for (const body of [
        subscriptionBody({ cost: 14.99, planName: 'Family', serviceName: 'Alpha Music' }),
        subscriptionBody({
          billingCycle: 'Yearly',
          cost: 120,
          planName: 'Pro',
          renewalDate: '2027-01-15',
          serviceName: 'Beta Video',
          startDate: '2026-01-15',
        }),
        subscriptionBody({
          categoryId: category('Productivity'),
          cost: 8,
          planName: 'Team',
          renewalDate: '2026-11-20',
          serviceName: 'Gamma Notes',
        }),
      ]) {
        assert.equal((await client.post('/api/v1/subscriptions').set(auth).send(body)).status, 201);
      }

      const listRes = await client.get('/api/v1/subscriptions').set(auth);
      assert.equal(listRes.body.items.length, 3);
      assert.equal(listRes.body.pagination.totalCount, 3);

      const yearlyRes = await client.get('/api/v1/subscriptions?billingCycle=Yearly').set(auth);
      assert.deepEqual(
        yearlyRes.body.items.map((item) => item.serviceName),
        ['Beta Video'],
      );

      const prodRes = await client
        .get(`/api/v1/subscriptions?categoryId=${category('Productivity')}`)
        .set(auth);
      assert.deepEqual(
        prodRes.body.items.map((item) => item.serviceName),
        ['Gamma Notes'],
      );

      const searchRes = await client.get('/api/v1/subscriptions?search=family').set(auth);
      assert.deepEqual(
        searchRes.body.items.map((item) => item.serviceName),
        ['Alpha Music'],
      );

      const sortRes = await client.get('/api/v1/subscriptions?sortBy=cost&sortOrder=asc').set(auth);
      assert.equal(sortRes.body.items[0].cost, 8);
      assert.equal(sortRes.body.items[2].cost, 120);

      const pageRes = await client.get('/api/v1/subscriptions?limit=2&page=1').set(auth);
      assert.equal(pageRes.body.items.length, 2);
      assert.equal(pageRes.body.pagination.totalPages, 2);

      assert.equal((await client.get('/api/v1/subscriptions?status=paused').set(auth)).status, 400);
    });

    test('updates fields and status; a cancelled subscription keeps its renewal date', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'dana');
      const auth = { Authorization: `Bearer ${accessToken}` };

      const createRes = await client
        .post('/api/v1/subscriptions')
        .set(auth)
        .send(subscriptionBody({ serviceName: 'Initial' }));
      const subId = createRes.body.subscription.id;

      const patch1 = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set(auth)
        .send({ cost: 12.5, notes: 'Updated note', serviceName: 'Renamed' });
      assert.equal(patch1.status, 200);
      assert.equal(patch1.body.subscription.cost, 12.5);
      assert.equal(patch1.body.subscription.serviceName, 'Renamed');

      const cancelled = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set(auth)
        .send({ status: 'Cancelled' });
      assert.equal(cancelled.body.subscription.status, 'Cancelled');
      assert.ok(cancelled.body.subscription.cancelledAt);
      assert.equal(cancelled.body.subscription.renewalDate, '2026-11-01');

      const reactivated = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set(auth)
        .send({ renewalDate: '2026-12-01', status: 'Active' });
      assert.equal(reactivated.body.subscription.status, 'Active');
      assert.equal(reactivated.body.subscription.cancelledAt, null);

      const history = await client.get(`/api/v1/subscriptions/${subId}/history`).set(auth);
      assert.equal(history.status, 200);
      assert.deepEqual(
        history.body.items.map((item) => item.changedFields),
        [['status', 'renewal_date'], ['status'], ['cost']],
      );
    });

    test('cancels with a final payment in one transaction', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'frank');
      const auth = { Authorization: `Bearer ${accessToken}` };
      const subId = (await client.post('/api/v1/subscriptions').set(auth).send(subscriptionBody()))
        .body.subscription.id;

      const failed = await csrfPost(client, `/api/v1/subscriptions/${subId}/cancel`)
        .set(auth)
        .send({ finalPayment: { amount: 0, paymentDate: '2026-10-20' } });
      assert.equal(failed.status, 400);
      assert.equal(
        (await client.get(`/api/v1/subscriptions/${subId}`).set(auth)).body.subscription.status,
        'Active',
      );

      const ok = await csrfPost(client, `/api/v1/subscriptions/${subId}/cancel`)
        .set(auth)
        .send({ finalPayment: { amount: '10.00', paymentDate: '2026-10-20' } });
      assert.equal(ok.status, 200);
      assert.equal(ok.body.subscription.status, 'Cancelled');
      assert.equal(
        ok.body.subscription.renewalDate,
        '2026-11-01',
        'trigger skips the cancelled row',
      );
      assert.equal(ok.body.payment.amount, '10.00');

      const again = await csrfPost(client, `/api/v1/subscriptions/${subId}/cancel`)
        .set(auth)
        .send({});
      assert.equal(again.status, 409);
    });

    test('marks usage and lists unused subscriptions (FR8)', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'gina');
      const auth = { Authorization: `Bearer ${accessToken}` };
      const subId = (
        await client
          .post('/api/v1/subscriptions')
          .set(auth)
          .send(subscriptionBody({ startDate: '2025-01-01' }))
      ).body.subscription.id;

      const used = await client.patch(`/api/v1/subscriptions/${subId}/used`).set(auth).send({});
      assert.equal(used.status, 200);
      assert.equal(used.body.subscription.lastUsedDate, new Date().toISOString().slice(0, 10));

      await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set(auth)
        .send({ lastUsedDate: '2025-02-01' });
      const unused = await client.get('/api/v1/subscriptions?unusedDays=60').set(auth);
      assert.deepEqual(
        unused.body.items.map((item) => item.id),
        [subId],
      );

      const future = await client
        .patch(`/api/v1/subscriptions/${subId}/used`)
        .set(auth)
        .send({ lastUsedDate: '2999-01-01' });
      assert.equal(future.status, 400);
    });

    test('supports soft archival and restoration, and hard deletion', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'eva');
      const auth = { Authorization: `Bearer ${accessToken}` };

      const subId = (
        await client
          .post('/api/v1/subscriptions')
          .set(auth)
          .send(subscriptionBody({ serviceName: 'Old Membership' }))
      ).body.subscription.id;

      const archiveRes = await csrfPost(client, `/api/v1/subscriptions/${subId}/archive`).set(auth);
      assert.equal(archiveRes.status, 200);
      assert.ok(archiveRes.body.subscription.archivedAt);
      assert.equal((await client.get('/api/v1/subscriptions').set(auth)).body.items.length, 0);
      assert.equal(
        (await client.get('/api/v1/subscriptions?archived=true').set(auth)).body.items.length,
        1,
      );

      const editArchived = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set(auth)
        .send({ cost: 30 });
      assert.equal(editArchived.status, 400);
      assert.equal(editArchived.body.code, 'SUBSCRIPTION_ARCHIVED');

      const restoreRes = await csrfPost(client, `/api/v1/subscriptions/${subId}/restore`).set(auth);
      assert.equal(restoreRes.body.subscription.archivedAt, null);

      await csrfPost(client, `/api/v1/subscriptions/${subId}/payments`)
        .set(auth)
        .send({ amount: '25.00', paymentDate: '2026-10-05' });
      const deleted = await client.delete(`/api/v1/subscriptions/${subId}`).set(auth);
      assert.equal(deleted.status, 204);
      assert.equal((await client.get(`/api/v1/subscriptions/${subId}`).set(auth)).status, 404);
      const leftovers = await database.query(
        'SELECT count(*)::int AS count FROM payment_history WHERE subscription_id = $1',
        [subId],
      );
      assert.equal(leftovers.rows[0].count, 0);
    });

    test('rejects malformed identifiers with 400', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'hal');
      for (const id of ['abc', '0', '2147483648', '99999999999999999999', '1%20OR%201%3D1']) {
        const response = await client
          .get(`/api/v1/subscriptions/${id}`)
          .set('Authorization', `Bearer ${accessToken}`);
        assert.equal(response.status, 400, id);
        assert.equal(response.body.code, 'INVALID_ID');
      }
    });

    test('strictly enforces user isolation on all read, write, and status endpoints', async () => {
      const client = request.agent(app);
      const userA = await registerUser(client, 'userA');
      const userB = await registerUser(client, 'userB');
      const asB = { Authorization: `Bearer ${userB.accessToken}` };

      const subId = (
        await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send(subscriptionBody({ cost: 50, serviceName: "User A's Secret Service" }))
      ).body.subscription.id;

      assert.equal((await client.get(`/api/v1/subscriptions/${subId}`).set(asB)).status, 404);
      assert.equal(
        (await client.patch(`/api/v1/subscriptions/${subId}`).set(asB).send({ cost: 1 })).status,
        404,
      );
      assert.equal((await client.delete(`/api/v1/subscriptions/${subId}`).set(asB)).status, 404);
      assert.equal(
        (await csrfPost(client, `/api/v1/subscriptions/${subId}/archive`).set(asB)).status,
        404,
      );
      assert.equal(
        (await csrfPost(client, `/api/v1/subscriptions/${subId}/restore`).set(asB)).status,
        404,
      );
      assert.equal(
        (await csrfPost(client, `/api/v1/subscriptions/${subId}/cancel`).set(asB).send({})).status,
        404,
      );
      assert.equal(
        (await client.patch(`/api/v1/subscriptions/${subId}/used`).set(asB).send({})).status,
        404,
      );
      assert.equal(
        (await client.get(`/api/v1/subscriptions/${subId}/history`).set(asB)).status,
        404,
      );

      const listRes = await client.get('/api/v1/subscriptions').set(asB);
      assert.equal(listRes.body.items.length, 0);
    });
  });
}
