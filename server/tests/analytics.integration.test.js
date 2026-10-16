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
    name: `Stage 7 ${suffix}`,
    email: `stage7.${suffix}@example.invalid`,
    password,
  });
  assert.equal(response.status, 201);
  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  };
}

if (!config.testDatabaseUrl) {
  test('analytics integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('spending analytics and SQL reporting integration', { concurrency: 1 }, () => {
    let categoriesList = [];
    let userOne = null;
    let userTwo = null;

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

    after(async () => {
      await database.close();
    });

    beforeEach(async () => {
      await database.withClient(async (client) => {
        await client.query('DELETE FROM refunds');
        await client.query('DELETE FROM payment_history');
        await client.query('DELETE FROM subscription');
        await client.query('DELETE FROM auth_sessions');
        await client.query('DELETE FROM user_preferences');
        await client.query('DELETE FROM users');
      });

      const client = request(app);
      userOne = await registerUser(client, 'primary');
      userTwo = await registerUser(client, 'secondary');
    });

    test('financial overview calculates gross, refunds, net cash flow, and excludes pending/failed payments', async () => {
      const client = request(app);

      // 1. Initially empty: should return empty summaries or 0
      const emptyRes = await client
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(emptyRes.status, 200);
      assert.deepEqual(emptyRes.body.currencySummaries, []);

      // 2. Create subscription 1 (INR, monthly, 649.00)
      const subRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-15',
          cost: '649.00',
          serviceName: 'Test Service',
          startDate: '2026-10-15',
        });
      assert.equal(subRes.status, 201);
      const subId = subRes.body.subscription.id;

      // 3. Record a completed payment of 649.00
      const pay1 = await client
        .post(`/api/v1/subscriptions/${subId}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '649.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-15',
          paymentStatus: 'completed',
        });
      assert.equal(pay1.status, 201);
      const pay1Id = pay1.body.payment.id;

      // 4. Record a pending payment (500.00) and failed payment (200.00)
      await client
        .post(`/api/v1/subscriptions/${subId}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '500.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-16',
          paymentStatus: 'pending',
        });

      await client
        .post(`/api/v1/subscriptions/${subId}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '200.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-17',
          paymentStatus: 'failed',
        });

      // 5. Record a partial refund of 149.00 on pay1
      const refundRes = await client
        .post(`/api/v1/payments/${pay1Id}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '149.00',
          reason: 'Discount applied',
          refundDate: '2026-10-18',
          status: 'completed',
        });
      assert.equal(refundRes.status, 201);

      // 6. Check overview
      const overviewRes = await client
        .get('/api/v1/analytics/overview?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(overviewRes.status, 200);

      const inrSummary = overviewRes.body.currencySummaries.find((s) => s.currencyCode === 'INR');
      assert.ok(inrSummary);
      assert.equal(inrSummary.grossPayments, '649.00'); // only completed
      assert.equal(inrSummary.completedRefunds, '149.00');
      assert.equal(inrSummary.netCashFlow, '500.00'); // 649 - 149
      assert.equal(inrSummary.completedPaymentCount, 1);
      assert.equal(inrSummary.pendingPaymentCount, 1);
      assert.equal(inrSummary.failedPaymentCount, 1);
      assert.equal(inrSummary.pendingAmount, '500.00');
      assert.equal(inrSummary.failedAmount, '200.00');
      assert.equal(inrSummary.refundCount, 1);
      assert.equal(inrSummary.activeSubscriptionCount, 1);
      assert.equal(inrSummary.estimatedMonthlyRecurring, '649.00');
    });

    test('multi-currency separation keeps INR and USD strictly distinct', async () => {
      const client = request(app);

      // Create INR subscription
      const inrSub = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-15',
          cost: '1000.00',
          serviceName: 'Test Service',
          startDate: '2026-10-15',
        });
      assert.equal(inrSub.status, 201);

      // Create USD subscription
      const usdSub = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Yearly',
          categoryId: categoriesList[1].id,
          currencyCode: 'USD',
          renewalDate: '2027-10-15',
          cost: '120.00',
          serviceName: 'Test Service',
          startDate: '2026-10-15',
        });
      assert.equal(usdSub.status, 201);

      // Record payments in both
      await client
        .post(`/api/v1/subscriptions/${inrSub.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1000.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-15',
          paymentStatus: 'completed',
        });

      await client
        .post(`/api/v1/subscriptions/${usdSub.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '120.00',
          currencyCode: 'USD',
          paymentDate: '2026-10-15',
          paymentStatus: 'completed',
        });

      const overviewRes = await client
        .get('/api/v1/analytics/overview')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(overviewRes.status, 200);

      const summaries = overviewRes.body.currencySummaries;
      assert.equal(summaries.length, 2);

      const inr = summaries.find((s) => s.currencyCode === 'INR');
      const usd = summaries.find((s) => s.currencyCode === 'USD');

      assert.equal(inr.grossPayments, '1000.00');
      assert.equal(inr.estimatedMonthlyRecurring, '1000.00');

      assert.equal(usd.grossPayments, '120.00');
      assert.equal(usd.estimatedMonthlyRecurring, '10.00'); // 120 / 12 = 10.00
      assert.equal(usd.estimatedYearlyRecurring, '120.00');
    });

    test('monthly trends group payments by payment date, refunds by refund date, and handle negative cash flow & zero-activity months', async () => {
      const client = request(app);

      const subRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '1000.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });
      const subId = subRes.body.subscription.id;

      // Payment 1: January 2026 (1000.00)
      const payJan = await client
        .post(`/api/v1/subscriptions/${subId}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1000.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-15',
          paymentStatus: 'completed',
        });
      assert.equal(payJan.status, 201);

      // Payment 2: February 2026 (1500.00)
      const payFeb = await client
        .post(`/api/v1/subscriptions/${subId}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1500.00',
          currencyCode: 'INR',
          paymentDate: '2026-02-10',
          paymentStatus: 'completed',
        });
      assert.equal(payFeb.status, 201);

      // Refund in March 2026 (300.00 on payJan)
      // Note: March has 0 payments and 300 refund -> net cash flow should be -300.00!
      const refundMarch = await client
        .post(`/api/v1/payments/${payJan.body.payment.id}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '300.00',
          reason: 'March refund for Jan payment',
          refundDate: '2026-03-05',
          status: 'completed',
        });
      assert.equal(refundMarch.status, 201);

      // Query trends for 2026-01-01 to 2026-04-30 (April is a zero-activity month)
      const trendsRes = await client
        .get(
          '/api/v1/analytics/trends?currencyCode=INR&startDate=2026-01-01&endDate=2026-04-30&interval=monthly',
        )
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(trendsRes.status, 200);

      const trends = trendsRes.body.trends;
      assert.ok(trends.length >= 4);

      const jan = trends.find((t) => t.period === '2026-01');
      assert.equal(jan.grossPayments, '1000.00');
      assert.equal(jan.completedRefunds, '0.00');
      assert.equal(jan.netCashFlow, '1000.00');
      assert.equal(jan.completedPaymentCount, 1);

      const feb = trends.find((t) => t.period === '2026-02');
      assert.equal(feb.grossPayments, '1500.00');
      assert.equal(feb.completedRefunds, '0.00');
      assert.equal(feb.netCashFlow, '1500.00');

      const mar = trends.find((t) => t.period === '2026-03');
      assert.equal(mar.grossPayments, '0.00');
      assert.equal(mar.completedRefunds, '300.00');
      assert.equal(mar.netCashFlow, '-300.00'); // Negative cash flow!

      const apr = trends.find((t) => t.period === '2026-04');
      assert.equal(apr.grossPayments, '0.00');
      assert.equal(apr.completedRefunds, '0.00');
      assert.equal(apr.netCashFlow, '0.00');
    });

    test('category analytics prevents duplicate sums with multiple refunds and calculates percentage of gross', async () => {
      const client = request(app);

      // Create subscription in Category 0
      const sub1 = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '800.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      // Create subscription in Category 1
      const sub2 = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[1].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '200.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      // Record payment of 800.00 for sub1
      const pay1 = await client
        .post(`/api/v1/subscriptions/${sub1.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '800.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-10',
          paymentStatus: 'completed',
        });

      // Record two partial refunds on pay1 (100.00 and 150.00)
      await client
        .post(`/api/v1/payments/${pay1.body.payment.id}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '100.00',
          reason: 'Refund 1',
          refundDate: '2026-01-15',
          status: 'completed',
        });

      await client
        .post(`/api/v1/payments/${pay1.body.payment.id}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '150.00',
          reason: 'Refund 2',
          refundDate: '2026-01-20',
          status: 'completed',
        });

      // Record payment of 200.00 for sub2
      await client
        .post(`/api/v1/subscriptions/${sub2.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '200.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-12',
          paymentStatus: 'completed',
        });

      const catRes = await client
        .get('/api/v1/analytics/categories?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(catRes.status, 200);

      const cats = catRes.body.categories;
      assert.equal(cats.length, 2);

      const cat0 = cats.find((c) => c.categoryId === String(categoriesList[0].id));
      assert.ok(cat0);
      // Even with 2 refunds, grossPayments must be exactly 800.00, NOT 1600.00!
      assert.equal(cat0.grossPayments, '800.00');
      assert.equal(cat0.completedRefunds, '250.00'); // 100 + 150
      assert.equal(cat0.netCashFlow, '550.00');
      assert.equal(cat0.percentageOfGross, 80); // 800 / 1000 = 80%

      const cat1 = cats.find((c) => c.categoryId === String(categoriesList[1].id));
      assert.ok(cat1);
      assert.equal(cat1.grossPayments, '200.00');
      assert.equal(cat1.completedRefunds, '0.00');
      assert.equal(cat1.netCashFlow, '200.00');
      assert.equal(cat1.percentageOfGross, 20); // 200 / 1000 = 20%
    });

    test('subscription analytics, top subscriptions, and billing cycle distributions', async () => {
      const client = request(app);

      // Monthly subscription: price 300, payment 300
      const subM = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '300.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      // Yearly subscription: cost 2400 (monthly equiv 200), payment 600
      const subQ = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Yearly',
          categoryId: categoriesList[1].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '2400.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      await client
        .post(`/api/v1/subscriptions/${subM.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '300.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-10',
          paymentStatus: 'completed',
        });

      await client
        .post(`/api/v1/subscriptions/${subQ.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '600.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-10',
          paymentStatus: 'completed',
        });

      // 1. Top subscriptions by recurring cost:
      // Monthly 300 has normalized monthly 300.00
      // Yearly 2400 has normalized monthly 200.00 (2400 / 12)
      // So subM outranks subQ in recurring cost!
      const topRec = await client
        .get('/api/v1/analytics/top-subscriptions?currencyCode=INR&type=recurring&limit=5')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(topRec.status, 200);
      assert.equal(topRec.body.subscriptions[0].subscriptionId, subM.body.subscription.id);
      assert.equal(topRec.body.subscriptions[0].normalizedMonthlyCost, '300.00');
      assert.equal(topRec.body.subscriptions[1].normalizedMonthlyCost, '200.00');

      // 2. Top subscriptions by historical gross spending:
      // subQ paid 600.00, subM paid 300.00
      // So subQ outranks subM in historical gross spending!
      const topHist = await client
        .get('/api/v1/analytics/top-subscriptions?currencyCode=INR&type=historical&limit=5')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(topHist.status, 200);
      assert.equal(topHist.body.subscriptions[0].subscriptionId, subQ.body.subscription.id);
      assert.equal(topHist.body.subscriptions[0].grossPayments, '600.00');

      // 3. Billing cycle distribution
      const cyclesRes = await client
        .get('/api/v1/analytics/billing-cycles?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(cyclesRes.status, 200);
      assert.equal(cyclesRes.body.billingCycles.length, 2);

      const monthlyCycle = cyclesRes.body.billingCycles.find((c) => c.billingCycle === 'Monthly');
      assert.equal(monthlyCycle.subscriptionCount, 1);
      assert.equal(monthlyCycle.estimatedMonthlyTotal, '300.00');
      assert.equal(monthlyCycle.estimatedYearlyTotal, '3600.00');

      const yearlyCycle = cyclesRes.body.billingCycles.find((c) => c.billingCycle === 'Yearly');
      assert.equal(yearlyCycle.subscriptionCount, 1);
      assert.equal(yearlyCycle.estimatedMonthlyTotal, '200.00');
      assert.equal(yearlyCycle.estimatedYearlyTotal, '2400.00');
    });

    test('custom report and CSV export generate sanitized tabular outputs', async () => {
      const client = request(app);

      const subRes = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '500.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      await client
        .post(`/api/v1/subscriptions/${subRes.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '500.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-10',
          paymentStatus: 'completed',
        });

      // JSON Report
      const reportRes = await client
        .get('/api/v1/analytics/report?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(reportRes.status, 200);
      assert.ok(reportRes.body.overview);
      assert.ok(reportRes.body.categoryBreakdown);
      assert.ok(reportRes.body.monthlyTrends);
      assert.ok(reportRes.body.subscriptionBreakdown);

      // CSV Export
      const exportRes = await client
        .get('/api/v1/analytics/report/export?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(exportRes.status, 200);
      assert.ok(exportRes.headers['content-type'].includes('text/csv'));
      assert.ok(exportRes.headers['content-disposition'].includes('attachment; filename='));
      assert.ok(exportRes.text.includes('--- FINANCIAL OVERVIEW BY CURRENCY ---'));
      assert.ok(exportRes.text.includes('--- CATEGORY BREAKDOWN ---'));
      assert.ok(exportRes.text.includes('"500.00"'));
    });

    test('strictly enforces user isolation across all analytics endpoints', async () => {
      const client = request(app);

      // User 1 creates subscription and payment
      const subUser1 = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: '999.00',
          serviceName: 'Test Service',
          startDate: '2026-01-01',
        });

      await client
        .post(`/api/v1/subscriptions/${subUser1.body.subscription.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '999.00',
          currencyCode: 'INR',
          paymentDate: '2026-01-10',
          paymentStatus: 'completed',
        });

      // User 2 queries overview
      const user2Overview = await client
        .get('/api/v1/analytics/overview?currencyCode=INR')
        .set('Authorization', `Bearer ${userTwo.accessToken}`);
      assert.equal(user2Overview.status, 200);
      // User 2 must see 0 / empty, never User 1's data!
      assert.deepEqual(user2Overview.body.currencySummaries, []);

      // User 2 queries categories
      const user2Categories = await client
        .get('/api/v1/analytics/categories?currencyCode=INR')
        .set('Authorization', `Bearer ${userTwo.accessToken}`);
      assert.equal(user2Categories.status, 200);
      assert.deepEqual(user2Categories.body.categories, []);

      // User 2 queries subscriptions
      const user2Subs = await client
        .get('/api/v1/analytics/subscriptions?currencyCode=INR')
        .set('Authorization', `Bearer ${userTwo.accessToken}`);
      assert.equal(user2Subs.status, 200);
      assert.deepEqual(user2Subs.body.subscriptions, []);

      // Unauthenticated request should be rejected with 401
      const unauthRes = await client.get('/api/v1/analytics/overview');
      assert.equal(unauthRes.status, 401);

      // Invalid date range (startDate > endDate) should be rejected with 400
      const invalidDateRes = await client
        .get('/api/v1/analytics/overview?startDate=2026-12-01&endDate=2026-01-01')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(invalidDateRes.status, 400);
    });
  });
}
