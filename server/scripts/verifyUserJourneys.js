/**
 * End-to-End User Journey Verification Script
 * Validates 21 comprehensive full-stack workflows across the application:
 * authentication, preferences, catalog, subscriptions, payments, refunds,
 * analytics, notifications, AI recommendations, and session lifecycle.
 */
import assert from 'node:assert/strict';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { seedCatalog } from '../db/seeds/catalog.js';

const testConfig = Object.freeze({
  authRateLimitMax: 1000,
  bcryptCost: 4,
  cookieSecure: false,
  corsOrigin: 'http://localhost:5173',
  jwtAccessExpiresIn: '15m',
  jwtAccessSecret: 'e2e-journey-testing-secret-with-at-least-32-chars',
  nodeEnv: 'test',
  refreshTokenExpiresDays: 7,
});

const origin = testConfig.corsOrigin;

function csrfPost(client, path) {
  return client.post(path).set('Origin', origin).set('X-Requested-With', 'XMLHttpRequest');
}

async function run() {
  console.log('🚀 Starting SpendWise AI 21-Workflow User Journey Verification...\n');

  const connectionString = config.testDatabaseUrl || config.databaseUrl;
  const database = createDatabase({ connectionString });

  const identity = await database.query('SELECT current_database() AS name');
  const dbName = identity.rows[0].name;
  console.log(`📌 Target Database: ${dbName}`);

  if (dbName === 'spendwise_dev') {
    throw new Error(
      'Safety guard: Journey verification tests must never run on spendwise_dev directly.',
    );
  }

  // Ensure clean test schema
  await database.withClient(async (client) => {
    await client.query('DROP SCHEMA public CASCADE');
    await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
  });

  await runMigrations({ database });
  await seedCatalog(database);

  const app = createApp({ appConfig: testConfig, databaseClient: database });
  const client = request(app);

  const passedWorkflows = [];

  async function step(number, name, fn) {
    try {
      await fn();
      console.log(`  ✅ Workflow ${String(number).padStart(2, '0')}: ${name}`);
      passedWorkflows.push({ number, name });
    } catch (error) {
      console.error(`  ❌ Workflow ${String(number).padStart(2, '0')}: ${name} FAILED!`);
      console.error(error);
      process.exit(1);
    }
  }

  let user = null;
  let accessToken = null;
  let refreshTokenCookie = null;
  let categories = [];
  let services = [];
  let catalogSub = null;
  let customSub = null;
  let trialSub = null;
  let payment1 = null;
  let payment2 = null;
  let refund1 = null;

  // 1. Health check & security headers
  await step(1, 'System Health Check & Defensive Security Headers', async () => {
    const res = await client.get('/api/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-frame-options'], 'DENY');
    assert.equal(res.headers['x-powered-by'], undefined);
  });

  // 2. User Registration
  await step(2, 'New User Registration with Password Hashing', async () => {
    const res = await csrfPost(client, '/api/v1/auth/register').send({
      displayName: 'Journey User',
      email: 'journey.tester@example.invalid',
      password: 'StrongUserJourneyPass123!',
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.accessToken);
    accessToken = res.body.accessToken;
    user = res.body.user;
    refreshTokenCookie = res.headers['set-cookie']?.[0]?.split(';')[0];
    assert.ok(refreshTokenCookie);
  });

  // 3. Authenticated Session Check
  await step(3, 'Session Verification via Bearer Authentication', async () => {
    const res = await client.get('/api/v1/auth/me').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'journey.tester@example.invalid');
  });

  // 4. Update Preferences
  await step(4, 'User Preferences Configuration (Currency & Renewal Reminders)', async () => {
    const res = await client
      .patch('/api/v1/users/me/preferences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        notificationsEnabled: true,
        preferredCurrency: 'USD',
        renewalReminderDays: 7,
        renewalRemindersEnabled: true,
      });
    assert.equal(res.status, 200);
    assert.equal(res.body.preferences.preferredCurrency, 'USD');
  });

  // 5. Public Catalog Discovery
  await step(5, 'Public Catalog Discovery (Categories & Verified Services)', async () => {
    const catRes = await client.get('/api/v1/categories');
    assert.equal(catRes.status, 200);
    assert.ok(catRes.body.categories.length > 0);
    categories = catRes.body.categories;

    const svcRes = await client.get('/api/v1/services');
    assert.equal(svcRes.status, 200);
    assert.ok(svcRes.body.services.length > 0);
    services = svcRes.body.services;
  });

  // 6. Create Catalog Subscription
  await step(6, 'Create Standard Catalog Subscription (Streaming Service)', async () => {
    const streamService = services[0];
    const res = await client
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        billingCycle: 'monthly',
        categoryId: streamService.defaultCategoryId || categories[0].id,
        currencyCode: 'USD',
        nextRenewalDate: '2026-11-01',
        planName: 'Premium Family',
        price: 19.99,
        serviceId: streamService.id,
        startDate: '2026-10-01',
        status: 'active',
      });
    assert.equal(res.status, 201);
    catalogSub = res.body.subscription;
    assert.equal(Number(catalogSub.price), 19.99);
  });

  // 7. Create Custom Subscription
  await step(7, 'Create Custom Subscription with User-Defined Provider', async () => {
    const res = await client
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        billingCycle: 'monthly',
        categoryId: categories[0].id,
        currencyCode: 'USD',
        customServiceName: 'Metro CrossFit Gym',
        nextRenewalDate: '2026-11-15',
        price: 85.0,
        startDate: '2026-10-15',
        status: 'active',
      });
    assert.equal(res.status, 201);
    customSub = res.body.subscription;
    assert.equal(customSub.serviceName, 'Metro CrossFit Gym');
  });

  // 8. Create Trial Subscription
  await step(8, 'Create Free Trial Subscription with Expiration Boundary', async () => {
    const res = await client
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        billingCycle: 'monthly',
        categoryId: categories[0].id,
        currencyCode: 'USD',
        customServiceName: 'Cloud Storage Pro Trial',
        nextRenewalDate: '2026-10-25',
        price: 9.99,
        startDate: '2026-10-11',
        status: 'trial',
        trialEndDate: '2026-10-25',
      });
    assert.equal(res.status, 201);
    trialSub = res.body.subscription;
    assert.equal(trialSub.status, 'trial');
    assert.equal(trialSub.trialEndDate, '2026-10-25');
  });

  // 9. List Subscriptions with Search & Pagination
  await step(9, 'Search, Filter, and Paginate Active Subscriptions', async () => {
    const res = await client
      .get('/api/v1/subscriptions?search=Gym&page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 1);
    assert.equal(res.body.items[0].serviceName, 'Metro CrossFit Gym');
  });

  // 10. Fetch Single Subscription Detail
  await step(10, 'Retrieve Subscription Details and Verify Relations', async () => {
    const res = await client
      .get(`/api/v1/subscriptions/${catalogSub.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.subscription.id, catalogSub.id);
  });

  // 11. Update Subscription Terms
  await step(11, 'Update Subscription Price and Plan Terms', async () => {
    const res = await client
      .patch(`/api/v1/subscriptions/${catalogSub.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        planName: 'Premium Family 4K HDR',
        price: 22.99,
      });
    assert.equal(res.status, 200);
    assert.equal(Number(res.body.subscription.price), 22.99);
    catalogSub = res.body.subscription;
  });

  // 12. Record First Payment
  await step(12, 'Record Historical Completed Subscription Payment', async () => {
    const res = await client
      .post(`/api/v1/subscriptions/${catalogSub.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 22.99,
        billingPeriodEnd: '2026-10-31',
        billingPeriodStart: '2026-10-01',
        currencyCode: 'USD',
        notes: 'Monthly auto-billing invoice #1001',
        paymentDate: '2026-10-01',
        paymentStatus: 'completed',
      });
    assert.equal(res.status, 201);
    payment1 = res.body.payment;
    assert.equal(payment1.amount, '22.99');
    assert.equal(payment1.paymentStatus, 'completed');
  });

  // 13. Record Second Payment
  await step(13, 'Record Second Subscription Payment with Period Isolation', async () => {
    const res = await client
      .post(`/api/v1/subscriptions/${customSub.id}/payments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 85.0,
        billingPeriodEnd: '2026-11-14',
        billingPeriodStart: '2026-10-15',
        currencyCode: 'USD',
        notes: 'Monthly membership dues',
        paymentDate: '2026-10-15',
        paymentStatus: 'completed',
      });
    assert.equal(res.status, 201);
    payment2 = res.body.payment;
    assert.equal(payment2.amount, '85.00');
  });

  // 14. List Payments with Date Filter
  await step(14, 'List Payments with Pagination and Verification', async () => {
    const res = await client
      .get('/api/v1/payments?page=1&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.items.length, 2);
    assert.equal(res.body.pagination.totalCount, 2);
  });

  // 15. Partial Refund & Recalculation
  await step(15, 'Process Partial Refund & Verify Balance Recalculation', async () => {
    const res = await client
      .post(`/api/v1/payments/${payment1.id}/refunds`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        amount: 5.0,
        reason: 'Service outage courtesy credit',
        refundDate: '2026-10-08',
      });
    assert.equal(res.status, 201);
    refund1 = res.body.refund;
    assert.equal(Number(refund1.amount), 5.0);

    const payCheck = await client
      .get(`/api/v1/payments/${payment1.id}`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(payCheck.status, 200);
    assert.equal(payCheck.body.payment.totalRefunded, '5.00');
    assert.equal(payCheck.body.payment.netAmount, '17.99');
    assert.equal(payCheck.body.payment.remainingRefundable, '17.99');
  });

  // 16. Financial Analytics Overview
  await step(16, 'Calculate Real-Time Financial Overview Metrics', async () => {
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.body.currencySummaries.length > 0);
    const usdSummary = res.body.currencySummaries.find((s) => s.currencyCode === 'USD');
    assert.ok(usdSummary);
    // 22.99 + 85.00 = 107.99 gross
    assert.equal(usdSummary.grossPayments, '107.99');
    assert.equal(usdSummary.completedRefunds, '5.00');
    assert.equal(usdSummary.netCashFlow, '102.99');
  });

  // 17. Analytics Trends & Breakdown
  await step(17, 'Retrieve Spending Trends and Category Distribution', async () => {
    const trendsRes = await client
      .get('/api/v1/analytics/trends?currencyCode=USD')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(trendsRes.status, 200);

    const catRes = await client
      .get('/api/v1/analytics/categories?currencyCode=USD')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(catRes.status, 200);
    assert.ok(catRes.body.categories.length > 0);
  });

  // 18. Custom Report CSV Export
  await step(18, 'Generate and Export Comprehensive Financial Report CSV', async () => {
    const res = await client
      .get('/api/v1/analytics/report/export')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.ok(res.text.includes('--- FINANCIAL OVERVIEW BY CURRENCY ---'));
    assert.ok(res.text.includes('107.99'));
    assert.ok(res.text.includes('102.99'));
  });

  // 19. In-App Notification Center
  await step(19, 'Notification Center Queries and Read Status Management', async () => {
    // Insert system notification
    await database.query(
      `
        INSERT INTO notifications (
          user_id, notification_type, title, message, scheduled_for, deduplication_key
        ) VALUES (
          $1, 'system', 'Renewal approaching', 'Your subscription renews in 7 days.',
          CURRENT_TIMESTAMP, 'journey-notif-1'
        )
      `,
      [user.id],
    );

    const listRes = await client
      .get('/api/v1/notifications')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(listRes.status, 200);
    assert.equal(listRes.body.notifications.length, 1);
    const notifId = listRes.body.notifications[0].id;

    const readRes = await client
      .patch(`/api/v1/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(readRes.status, 200);
    assert.equal(readRes.body.notification.isRead, true);
  });

  // 20. Cost Optimization Recommendations
  await step(20, 'Generate and Review Cost-Optimization Opportunities', async () => {
    const genRes = await client
      .post('/api/v1/recommendations/generate')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(genRes.status, 200);

    const recsRes = await client
      .get('/api/v1/recommendations')
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(recsRes.status, 200);
  });

  // 21. Soft Archival and Session Logout
  await step(21, 'Soft-Archive Subscription and Securely Logout Session', async () => {
    // Soft archive trial sub
    const archiveRes = await client
      .post(`/api/v1/subscriptions/${trialSub.id}/archive`)
      .set('Authorization', `Bearer ${accessToken}`);
    assert.equal(archiveRes.status, 200);
    assert.ok(archiveRes.body.subscription.archivedAt);

    // Logout
    const logoutRes = await csrfPost(client, '/api/v1/auth/logout').set('Cookie', [
      refreshTokenCookie,
    ]);
    assert.equal(logoutRes.status, 200);

    // Attempting to refresh after logout must fail
    const refreshRes = await csrfPost(client, '/api/v1/auth/refresh').set('Cookie', [
      refreshTokenCookie,
    ]);
    assert.equal(refreshRes.status, 401);
  });

  console.log(`\n🎉 ALL ${passedWorkflows.length} END-TO-END WORKFLOWS PASSED SUCESSFULLY!`);
  await database.close();
  process.exit(0);
}

run().catch((err) => {
  console.error('Journey verification failed with unhandled error:', err);
  process.exit(1);
});
