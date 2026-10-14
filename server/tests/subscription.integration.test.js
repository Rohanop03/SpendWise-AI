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
const expectedTestDatabaseName = 'spendwise_test';

function csrfPost(client, path) {
  return client.post(path).set('Origin', origin).set('X-Requested-With', 'XMLHttpRequest');
}

async function registerUser(client, suffix = 'user1') {
  const response = await csrfPost(client, '/api/v1/auth/register').send({
    displayName: `Stage 5 ${suffix}`,
    email: `stage5.${suffix}@example.invalid`,
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
    skip: 'Set TEST_DATABASE_URL to the dedicated spendwise_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('subscription and catalog API integration', { concurrency: 1 }, () => {
    let categoriesList = [];
    let servicesList = [];

    before(async () => {
      const identity = await database.query('SELECT current_database() AS database_name');
      assert.equal(identity.rows[0].database_name, expectedTestDatabaseName);

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      await runMigrations({ database });
      await seedCatalog(database);

      const catResult = await database.query('SELECT id, name FROM categories ORDER BY name ASC');
      categoriesList = catResult.rows;

      const svcResult = await database.query('SELECT id, name FROM services ORDER BY name ASC');
      servicesList = svcResult.rows;
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE subscriptions, auth_sessions, user_preferences, users
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
      assert.ok(Array.isArray(categoriesResponse.body.categories));
      assert.ok(categoriesResponse.body.categories.length >= 7);
      assert.ok(categoriesResponse.body.categories.some((cat) => cat.name === 'Entertainment'));

      const servicesResponse = await client.get('/api/v1/services');
      assert.equal(servicesResponse.status, 200);
      assert.ok(Array.isArray(servicesResponse.body.services));
      assert.ok(servicesResponse.body.services.length >= 7);
      assert.ok(servicesResponse.body.services.some((svc) => svc.name === 'Netflix'));

      const searchResponse = await client.get('/api/v1/services?search=spot');
      assert.equal(searchResponse.status, 200);
      assert.equal(searchResponse.body.services.length, 1);
      assert.equal(searchResponse.body.services[0].name, 'Spotify');
    });

    test('rejects unauthenticated requests to subscription endpoints', async () => {
      const client = request.agent(app);

      const listResponse = await client.get('/api/v1/subscriptions');
      assert.equal(listResponse.status, 401);

      const createResponse = await client.post('/api/v1/subscriptions').send({});
      assert.equal(createResponse.status, 401);
    });

    test('creates catalog-based and custom-named subscriptions with constraints', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'alice');
      const entertainmentCategory = categoriesList.find((c) => c.name === 'Entertainment');
      const netflixService = servicesList.find((s) => s.name === 'Netflix');

      // Create catalog-based subscription
      const catalogSubRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          nextRenewalDate: '2026-11-15',
          notes: 'Standard 4K streaming plan',
          planName: 'Premium 4K',
          price: 22.99,
          serviceId: String(netflixService.id),
          startDate: '2026-10-15',
          status: 'active',
        });

      assert.equal(catalogSubRes.status, 201);
      const catalogSub = catalogSubRes.body.subscription;
      assert.equal(catalogSub.serviceName, 'Netflix');
      assert.equal(catalogSub.serviceId, String(netflixService.id));
      assert.equal(catalogSub.customServiceName, null);
      assert.equal(catalogSub.price, 22.99);
      assert.equal(catalogSub.status, 'active');
      assert.equal(catalogSub.cancelledAt, null);

      // Create custom-named subscription
      const customSubRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'yearly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          customServiceName: 'Campus Recreation Gym',
          nextRenewalDate: '2027-10-15',
          price: 150.0,
          startDate: '2026-10-15',
          status: 'active',
        });

      assert.equal(customSubRes.status, 201);
      const customSub = customSubRes.body.subscription;
      assert.equal(customSub.serviceName, 'Campus Recreation Gym');
      assert.equal(customSub.serviceId, null);
      assert.equal(customSub.customServiceName, 'Campus Recreation Gym');
      assert.equal(customSub.price, 150.0);
    });

    test('enforces mutual exclusivity, category existence, and date rules on creation', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'bob');
      const entertainmentCategory = categoriesList.find((c) => c.name === 'Entertainment');
      const netflixService = servicesList.find((s) => s.name === 'Netflix');

      // Both serviceId and customServiceName
      const bothRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          customServiceName: 'Netflix Alternative',
          nextRenewalDate: '2026-11-15',
          price: 15.0,
          serviceId: String(netflixService.id),
          startDate: '2026-10-15',
          status: 'active',
        });
      assert.equal(bothRes.status, 400);

      // Neither serviceId nor customServiceName
      const neitherRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          nextRenewalDate: '2026-11-15',
          price: 15.0,
          startDate: '2026-10-15',
          status: 'active',
        });
      assert.equal(neitherRes.status, 400);

      // Non-existent category
      const badCatRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: '999999',
          currencyCode: 'USD',
          customServiceName: 'Special Service',
          nextRenewalDate: '2026-11-15',
          price: 10.0,
          startDate: '2026-10-15',
          status: 'active',
        });
      assert.equal(badCatRes.status, 400);
      assert.equal(badCatRes.body.code, 'INVALID_CATEGORY');

      // nextRenewalDate before startDate
      const badDateRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          customServiceName: 'Special Service',
          nextRenewalDate: '2026-09-01',
          price: 10.0,
          startDate: '2026-10-15',
          status: 'active',
        });
      assert.equal(badDateRes.status, 400);

      // Trial status requires trialEndDate
      const missingTrialEndRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          customServiceName: 'Free Trial Service',
          nextRenewalDate: '2026-11-15',
          price: 0.0,
          startDate: '2026-10-15',
          status: 'trial',
        });
      assert.equal(missingTrialEndRes.status, 400);

      // Status cancelled sets cancelled_at
      const cancelledRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(entertainmentCategory.id),
          currencyCode: 'USD',
          customServiceName: 'Cancelled Service',
          price: 10.0,
          startDate: '2026-10-15',
          status: 'cancelled',
        });
      assert.equal(cancelledRes.status, 201);
      assert.ok(cancelledRes.body.subscription.cancelledAt);
    });

    test('lists subscriptions with pagination, filtering, search, and sorting', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'charlie');
      const catEnt = categoriesList.find((c) => c.name === 'Entertainment');
      const catProd = categoriesList.find((c) => c.name === 'Productivity');

      const seedData = [
        {
          billingCycle: 'monthly',
          categoryId: String(catEnt.id),
          currencyCode: 'USD',
          customServiceName: 'Alpha Music',
          nextRenewalDate: '2026-11-01',
          planName: 'Family',
          price: 14.99,
          startDate: '2026-10-01',
          status: 'active',
        },
        {
          billingCycle: 'yearly',
          categoryId: String(catEnt.id),
          currencyCode: 'USD',
          customServiceName: 'Beta Video',
          nextRenewalDate: '2027-01-15',
          planName: 'Pro',
          price: 120.0,
          startDate: '2026-01-15',
          status: 'paused',
        },
        {
          billingCycle: 'monthly',
          categoryId: String(catProd.id),
          currencyCode: 'USD',
          customServiceName: 'Gamma Notes',
          nextRenewalDate: '2026-11-20',
          planName: 'Team',
          price: 8.0,
          startDate: '2026-10-20',
          status: 'active',
        },
      ];

      for (const item of seedData) {
        const res = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${accessToken}`)
          .send(item);
        assert.equal(res.status, 201);
      }

      // Default list
      const listRes = await client
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.items.length, 3);
      assert.equal(listRes.body.pagination.totalCount, 3);

      // Filter by status=paused
      const pausedRes = await client
        .get('/api/v1/subscriptions?status=paused')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(pausedRes.status, 200);
      assert.equal(pausedRes.body.items.length, 1);
      assert.equal(pausedRes.body.items[0].serviceName, 'Beta Video');

      // Filter by category
      const prodRes = await client
        .get(`/api/v1/subscriptions?categoryId=${catProd.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(prodRes.status, 200);
      assert.equal(prodRes.body.items.length, 1);
      assert.equal(prodRes.body.items[0].serviceName, 'Gamma Notes');

      // Search by service or plan
      const searchRes = await client
        .get('/api/v1/subscriptions?search=family')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(searchRes.status, 200);
      assert.equal(searchRes.body.items.length, 1);
      assert.equal(searchRes.body.items[0].serviceName, 'Alpha Music');

      // Sort by price asc
      const sortRes = await client
        .get('/api/v1/subscriptions?sortBy=price&sortOrder=asc')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(sortRes.status, 200);
      assert.equal(sortRes.body.items[0].price, 8.0);
      assert.equal(sortRes.body.items[2].price, 120.0);

      // Pagination
      const pageRes = await client
        .get('/api/v1/subscriptions?limit=2&page=1')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(pageRes.status, 200);
      assert.equal(pageRes.body.items.length, 2);
      assert.equal(pageRes.body.pagination.totalPages, 2);
    });

    test('updates subscription fields, handles service switching, and enforces status transitions', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'dana');
      const catEnt = categoriesList.find((c) => c.name === 'Entertainment');
      const netflixService = servicesList.find((s) => s.name === 'Netflix');

      const createRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(catEnt.id),
          currencyCode: 'USD',
          customServiceName: 'Initial Custom',
          nextRenewalDate: '2026-11-01',
          price: 10.0,
          startDate: '2026-10-01',
          status: 'active',
        });
      const subId = createRes.body.subscription.id;

      // Partial update price and notes
      const patchRes1 = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          notes: 'Updated note',
          price: 12.5,
        });
      assert.equal(patchRes1.status, 200);
      assert.equal(patchRes1.body.subscription.price, 12.5);
      assert.equal(patchRes1.body.subscription.notes, 'Updated note');

      // Switch to catalog service
      const patchRes2 = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          serviceId: String(netflixService.id),
        });
      assert.equal(patchRes2.status, 200);
      assert.equal(patchRes2.body.subscription.serviceName, 'Netflix');
      assert.equal(patchRes2.body.subscription.customServiceName, null);
      assert.equal(patchRes2.body.subscription.serviceId, String(netflixService.id));

      // Switch status to cancelled: sets cancelled_at
      const patchRes3 = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          status: 'cancelled',
        });
      assert.equal(patchRes3.status, 200);
      assert.equal(patchRes3.body.subscription.status, 'cancelled');
      assert.ok(patchRes3.body.subscription.cancelledAt);

      // Reactivate: clears cancelled_at
      const patchRes4 = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          nextRenewalDate: '2026-12-01',
          status: 'active',
        });
      assert.equal(patchRes4.status, 200);
      assert.equal(patchRes4.body.subscription.status, 'active');
      assert.equal(patchRes4.body.subscription.cancelledAt, null);
    });

    test('supports soft archival and restoration without deleting records', async () => {
      const client = request.agent(app);
      const { accessToken } = await registerUser(client, 'eva');
      const catEnt = categoriesList.find((c) => c.name === 'Entertainment');

      const createRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(catEnt.id),
          currencyCode: 'USD',
          customServiceName: 'Old Membership',
          nextRenewalDate: '2026-11-01',
          price: 25.0,
          startDate: '2026-10-01',
          status: 'active',
        });
      const subId = createRes.body.subscription.id;

      // Archive subscription
      const archiveRes = await client
        .post(`/api/v1/subscriptions/${subId}/archive`)
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(archiveRes.status, 200);
      assert.ok(archiveRes.body.subscription.archivedAt);

      // Excluded from default list
      const defaultListRes = await client
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(defaultListRes.status, 200);
      assert.equal(defaultListRes.body.items.length, 0);

      // Present in archived=true query
      const archivedListRes = await client
        .get('/api/v1/subscriptions?archived=true')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(archivedListRes.status, 200);
      assert.equal(archivedListRes.body.items.length, 1);
      assert.equal(archivedListRes.body.items[0].id, subId);

      // Updating an archived subscription is blocked
      const editArchivedRes = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ price: 30.0 });
      assert.equal(editArchivedRes.status, 400);
      assert.equal(editArchivedRes.body.code, 'SUBSCRIPTION_ARCHIVED');

      // Restore subscription
      const restoreRes = await client
        .post(`/api/v1/subscriptions/${subId}/restore`)
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(restoreRes.status, 200);
      assert.equal(restoreRes.body.subscription.archivedAt, null);

      // Visible in default list again
      const restoredListRes = await client
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${accessToken}`);
      assert.equal(restoredListRes.status, 200);
      assert.equal(restoredListRes.body.items.length, 1);
    });

    test('strictly enforces user isolation on all read, write, and status endpoints', async () => {
      const client = request.agent(app);
      const userA = await registerUser(client, 'userA');
      const userB = await registerUser(client, 'userB');
      const catEnt = categoriesList.find((c) => c.name === 'Entertainment');

      // User A creates a subscription
      const createRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userA.accessToken}`)
        .send({
          billingCycle: 'monthly',
          categoryId: String(catEnt.id),
          currencyCode: 'USD',
          customServiceName: "User A's Secret Service",
          nextRenewalDate: '2026-11-01',
          price: 50.0,
          startDate: '2026-10-01',
          status: 'active',
        });
      const subId = createRes.body.subscription.id;

      // User B attempts GET /subscriptions/:id -> 404
      const getRes = await client
        .get(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      assert.equal(getRes.status, 404);

      // User B attempts PATCH /subscriptions/:id -> 404
      const patchRes = await client
        .patch(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${userB.accessToken}`)
        .send({ price: 0.0 });
      assert.equal(patchRes.status, 404);

      // User B attempts POST /subscriptions/:id/archive -> 404
      const archiveRes = await client
        .post(`/api/v1/subscriptions/${subId}/archive`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      assert.equal(archiveRes.status, 404);

      // User B attempts POST /subscriptions/:id/restore -> 404
      const restoreRes = await client
        .post(`/api/v1/subscriptions/${subId}/restore`)
        .set('Authorization', `Bearer ${userB.accessToken}`);
      assert.equal(restoreRes.status, 404);

      // User B lists subscriptions -> empty
      const listRes = await client
        .get('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userB.accessToken}`);
      assert.equal(listRes.status, 200);
      assert.equal(listRes.body.items.length, 0);
    });
  });
}
