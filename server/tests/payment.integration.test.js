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
    name: `Stage 6 ${suffix}`,
    email: `stage6.${suffix}@example.invalid`,
    password,
  });
  assert.equal(response.status, 201);
  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  };
}

if (!config.testDatabaseUrl) {
  test('payment integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('payment, refund, and billing API integration', { concurrency: 1 }, () => {
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
        await client.query('DELETE FROM subscription_audit_events');
        await client.query('DELETE FROM refunds');
        await client.query('DELETE FROM payment_history');
        await client.query('DELETE FROM subscription');
        await client.query('DELETE FROM auth_sessions');
        await client.query('DELETE FROM user_preferences');
        await client.query('DELETE FROM users');
      });

      const client = request(app);
      userOne = await registerUser(client, 'alpha');
      userTwo = await registerUser(client, 'beta');
    });

    async function createTestSubscription(user, overrides = {}) {
      const client = request(app);
      const res = await client
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${user.accessToken}`)
        .send({
          billingCycle: 'Monthly',
          categoryId: categoriesList[0].id,
          currencyCode: 'INR',
          renewalDate: '2026-11-01',
          cost: 499,
          serviceName: 'Test Service',
          startDate: '2026-10-01',
          ...overrides,
        });
      assert.equal(res.status, 201, `Failed to create sub: ${JSON.stringify(res.body)}`);
      return res.body.subscription;
    }

    test('creates manual payments and enforces data integrity and ownership', async () => {
      const client = request(app);
      const sub = await createTestSubscription(userOne);

      // 1. Unauthenticated creation fails
      const unauthRes = await client.post(`/api/v1/subscriptions/${sub.id}/payments`).send({
        amount: 499,
        currencyCode: 'INR',
        paymentDate: '2026-10-01',
      });
      assert.equal(unauthRes.status, 401);

      // 2. Cross-user subscription payment creation fails
      const crossRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userTwo.accessToken}`)
        .send({
          amount: 499,
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
        });
      assert.equal(crossRes.status, 404);

      // 3. Invalid amount (<= 0) rejected
      const invalidAmountRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: -50,
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
        });
      assert.equal(invalidAmountRes.status, 400);

      // 4. Invalid billing period (end < start) rejected
      const invalidPeriodRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: 499,
          billingPeriodEnd: '2026-09-01',
          billingPeriodStart: '2026-10-01',
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
        });
      assert.equal(invalidPeriodRes.status, 400);

      // 5. Valid payment creation succeeds
      const validRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '499.00',
          billingPeriodEnd: '2026-10-31',
          billingPeriodStart: '2026-10-01',
          currencyCode: 'INR',
          notes: 'Credit card manual payment',
          paymentDate: '2026-10-01',
          paymentStatus: 'completed',
        });
      assert.equal(validRes.status, 201);
      const payment = validRes.body.payment;
      assert.equal(payment.amount, '499.00');
      assert.equal(payment.currencyCode, 'INR');
      assert.equal(payment.paymentStatus, 'completed');
      assert.equal(payment.billingPeriodStart, '2026-10-01');
      assert.equal(payment.billingPeriodEnd, '2026-10-31');
      assert.equal(payment.notes, 'Credit card manual payment');
      assert.equal(payment.totalRefunded, '0.00');
      assert.equal(payment.netAmount, '499.00');
      assert.equal(payment.remainingRefundable, '499.00');

      // 6. Historical preservation: modifying subscription price does not mutate existing payment
      await client
        .patch(`/api/v1/subscriptions/${sub.id}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ price: 699 });

      const detailRes = await client
        .get(`/api/v1/payments/${payment.id}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(detailRes.status, 200);
      assert.equal(detailRes.body.payment.amount, '499.00'); // remains 499, not rewritten to 699
    });

    test('lists payments with pagination, server-side filters, and sorting', async () => {
      const client = request(app);
      const subA = await createTestSubscription(userOne, { planName: 'Plan A' });
      const subB = await createTestSubscription(userOne, {
        currencyCode: 'USD',
        planName: 'Plan B',
      });

      // Insert 3 payments for userOne
      await client
        .post(`/api/v1/subscriptions/${subA.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '100.00',
          currencyCode: 'INR',
          paymentDate: '2026-08-01',
          paymentStatus: 'completed',
        });

      await client
        .post(`/api/v1/subscriptions/${subA.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '200.00',
          currencyCode: 'INR',
          paymentDate: '2026-09-01',
          paymentStatus: 'completed',
        });

      await client
        .post(`/api/v1/subscriptions/${subB.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '15.00',
          currencyCode: 'USD',
          paymentDate: '2026-10-01',
          paymentStatus: 'pending',
        });

      // Insert 1 payment for userTwo (must not appear in userOne results)
      const subTwo = await createTestSubscription(userTwo);
      await client
        .post(`/api/v1/subscriptions/${subTwo.id}/payments`)
        .set('Authorization', `Bearer ${userTwo.accessToken}`)
        .send({
          amount: '999.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
          paymentStatus: 'completed',
        });

      // 1. List userOne payments - pagination
      const pageRes = await client
        .get('/api/v1/payments?page=1&limit=2')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(pageRes.status, 200);
      assert.equal(pageRes.body.items.length, 2);
      assert.equal(pageRes.body.pagination.totalCount, 3);
      assert.equal(pageRes.body.pagination.totalPages, 2);

      // 2. Filter by status: pending
      const pendingRes = await client
        .get('/api/v1/payments?paymentStatus=pending')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(pendingRes.status, 200);
      assert.equal(pendingRes.body.items.length, 1);
      assert.equal(pendingRes.body.items[0].currencyCode, 'USD');

      // 3. Filter by currency: INR
      const inrRes = await client
        .get('/api/v1/payments?currencyCode=INR')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(inrRes.status, 200);
      assert.equal(inrRes.body.items.length, 2);

      // 4. Filter by date range: 2026-08-15 to 2026-09-15
      const dateRes = await client
        .get('/api/v1/payments?startDate=2026-08-15&endDate=2026-09-15')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(dateRes.status, 200);
      assert.equal(dateRes.body.items.length, 1);
      assert.equal(dateRes.body.items[0].paymentDate, '2026-09-01');

      // 5. Subscription scoped listing
      const subListRes = await client
        .get(`/api/v1/subscriptions/${subA.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(subListRes.status, 200);
      assert.equal(subListRes.body.items.length, 2);

      // 6. User isolation: userTwo sees only 1 payment
      const userTwoRes = await client
        .get('/api/v1/payments')
        .set('Authorization', `Bearer ${userTwo.accessToken}`);
      assert.equal(userTwoRes.status, 200);
      assert.equal(userTwoRes.body.items.length, 1);
      assert.equal(userTwoRes.body.items[0].amount, '999.00');
    });

    test('supports controlled payment updates and prevents invalid refund states', async () => {
      const client = request(app);
      const sub = await createTestSubscription(userOne);

      const payRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1000.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
          paymentStatus: 'completed',
        });
      const paymentId = payRes.body.payment.id;

      // 1. Permitted update: notes and billing period
      const updateRes = await client
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          billingPeriodEnd: '2026-10-31',
          billingPeriodStart: '2026-10-01',
          notes: 'Updated invoice receipt #123',
        });
      assert.equal(updateRes.status, 200);
      assert.equal(updateRes.body.payment.notes, 'Updated invoice receipt #123');
      assert.equal(updateRes.body.payment.billingPeriodStart, '2026-10-01');

      // 2. Record a partial refund of 400
      const refundRes = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '400.00',
          reason: 'Promotional discount retroactive',
          refundDate: '2026-10-05',
        });
      assert.equal(refundRes.status, 201);

      // 3. Attempting to reduce payment amount below completed refunds (e.g. 300 < 400) fails
      const illegalAmountRes = await client
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '300.00' });
      assert.equal(illegalAmountRes.status, 400);
      assert.equal(illegalAmountRes.body.code, 'PAYMENT_BELOW_REFUNDS');

      // 4. Attempting to change status of refunded payment to failed or cancelled fails
      const illegalStatusRes = await client
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ paymentStatus: 'failed' });
      assert.equal(illegalStatusRes.status, 400);
      assert.equal(illegalStatusRes.body.code, 'PAYMENT_HAS_REFUNDS');

      // 5. UserTwo cannot update userOne payment
      const unauthorizedUpdate = await client
        .patch(`/api/v1/payments/${paymentId}`)
        .set('Authorization', `Bearer ${userTwo.accessToken}`)
        .send({ notes: 'Malicious modification' });
      assert.equal(unauthorizedUpdate.status, 404);
    });

    test('records single and multiple partial refunds, rejects excessive refunds, and enforces isolation', async () => {
      const client = request(app);
      const sub = await createTestSubscription(userOne);

      const payRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1200.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
          paymentStatus: 'completed',
        });
      const paymentId = payRes.body.payment.id;

      // 1. Nonexistent payment refund fails with 404
      const nonExistent = await client
        .post('/api/v1/payments/99999999/refunds')
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '100.00', refundDate: '2026-10-02' });
      assert.equal(nonExistent.status, 404);

      // 2. UserTwo cannot refund UserOne payment
      const crossRefund = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userTwo.accessToken}`)
        .send({ amount: '100.00', refundDate: '2026-10-02' });
      assert.equal(crossRefund.status, 404);

      // 3. Negative refund rejected
      const negRefund = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '-50.00', refundDate: '2026-10-02' });
      assert.equal(negRefund.status, 400);

      // 4. First partial refund: 300.00
      const ref1 = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '300.00', reason: 'First partial', refundDate: '2026-10-02' });
      assert.equal(ref1.status, 201);
      assert.equal(ref1.body.paymentSummary.totalRefunded, '300.00');
      assert.equal(ref1.body.paymentSummary.netAmount, '900.00');
      assert.equal(ref1.body.paymentSummary.remainingRefundable, '900.00');

      // 5. Second partial refund: 400.00
      const ref2 = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '400.00', reason: 'Second partial', refundDate: '2026-10-03' });
      assert.equal(ref2.status, 201);
      assert.equal(ref2.body.paymentSummary.totalRefunded, '700.00');
      assert.equal(ref2.body.paymentSummary.netAmount, '500.00');
      assert.equal(ref2.body.paymentSummary.remainingRefundable, '500.00');

      // 6. Excessive refund: attempting 600.00 when remaining is 500.00 must be rejected
      const excessRef = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '600.00', refundDate: '2026-10-04' });
      assert.equal(excessRef.status, 400);
      assert.equal(excessRef.body.code, 'EXCESSIVE_REFUND');
      assert.equal(excessRef.body.details.remainingRefundable, '500.00');

      // 7. Full remaining refund: 500.00 succeeds
      const ref3 = await client
        .post(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '500.00', reason: 'Full remaining', refundDate: '2026-10-04' });
      assert.equal(ref3.status, 201);
      assert.equal(ref3.body.paymentSummary.totalRefunded, '1200.00');
      assert.equal(ref3.body.paymentSummary.netAmount, '0.00');
      assert.equal(ref3.body.paymentSummary.remainingRefundable, '0.00');

      // 8. List refunds endpoint returns all 3 refunds in reverse chronological order
      const listRef = await client
        .get(`/api/v1/payments/${paymentId}/refunds`)
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(listRef.status, 200);
      assert.equal(listRef.body.refunds.length, 3);
      assert.equal(listRef.body.payment.totalRefunded, '1200.00');
      assert.equal(listRef.body.payment.netAmount, '0.00');
    });

    test('critical concurrency: prevents over-refund under parallel concurrent requests', async () => {
      const client = request(app);
      const sub = await createTestSubscription(userOne);

      // Record completed payment of ₹1,000
      const payRes = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({
          amount: '1000.00',
          currencyCode: 'INR',
          paymentDate: '2026-10-01',
          paymentStatus: 'completed',
        });
      const paymentId = payRes.body.payment.id;

      // Two concurrent refund requests of ₹700 each dispatched at the exact same moment
      const [resA, resB] = await Promise.all([
        client
          .post(`/api/v1/payments/${paymentId}/refunds`)
          .set('Authorization', `Bearer ${userOne.accessToken}`)
          .send({ amount: '700.00', reason: 'Concurrent request A', refundDate: '2026-10-02' }),
        client
          .post(`/api/v1/payments/${paymentId}/refunds`)
          .set('Authorization', `Bearer ${userOne.accessToken}`)
          .send({ amount: '700.00', reason: 'Concurrent request B', refundDate: '2026-10-02' }),
      ]);

      const statuses = [resA.status, resB.status].sort();
      // Exactly one must succeed (201) and one must be rejected (400)
      assert.deepEqual(
        statuses,
        [201, 400],
        `Expected [201, 400], got [${resA.status}, ${resB.status}]`,
      );

      const failedRes = resA.status === 400 ? resA : resB;
      assert.equal(failedRes.body.code, 'EXCESSIVE_REFUND');

      // Verify the database row total in refunds is exactly ₹700.00 (not ₹1400.00)
      const dbCheck = await database.query(
        'SELECT SUM(amount)::text AS sum FROM refunds WHERE payment_id = $1 AND refund_status = $2',
        [paymentId, 'completed'],
      );
      assert.equal(dbCheck.rows[0].sum, '700.00');
    });

    test('calculates recurring monthly costs with currency separation and tracks upcoming renewals', async () => {
      const client = request(app);
      const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

      // Monthly INR 600, renewing in 20 days
      await createTestSubscription(userOne, {
        currencyCode: 'INR',
        renewalDate: day(20),
        cost: 600,
        startDate: day(-40),
      });
      // Yearly INR 1,200 (monthly equivalent 100), renewing in 25 days
      await createTestSubscription(userOne, {
        billingCycle: 'Yearly',
        currencyCode: 'INR',
        renewalDate: day(25),
        cost: 1200,
        startDate: day(-340),
      });
      // Yearly USD 120 (monthly equivalent 10), outside the 30-day window
      await createTestSubscription(userOne, {
        billingCycle: 'Yearly',
        currencyCode: 'USD',
        renewalDate: day(60),
        cost: 120,
        startDate: day(-300),
      });
      // Cancelled monthly INR 500: must NOT count toward recurring cost
      const cancelled = await createTestSubscription(userOne, {
        currencyCode: 'INR',
        renewalDate: day(10),
        cost: 500,
        startDate: day(-50),
      });
      await client
        .patch(`/api/v1/subscriptions/${cancelled.id}`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ status: 'Cancelled' });
      // Overdue Active INR 300
      await createTestSubscription(userOne, {
        currencyCode: 'INR',
        renewalDate: day(-5),
        cost: 300,
        startDate: day(-60),
      });

      const overviewRes = await client
        .get('/api/v1/billing/overview?days=30')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(overviewRes.status, 200);
      const overview = overviewRes.body;

      // INR = 600 + 100 + 300 = 1000.00 across 3 Active subscriptions; USD = 10.00 across 1
      const inrCost = overview.recurringCosts.find((c) => c.currencyCode === 'INR');
      const usdCost = overview.recurringCosts.find((c) => c.currencyCode === 'USD');
      assert.equal(inrCost.monthlyEquivalent, '1000.00');
      assert.equal(inrCost.subscriptionCount, 3);
      assert.equal(usdCost.monthlyEquivalent, '10.00');
      assert.equal(usdCost.subscriptionCount, 1);

      // Overdue renewals are reported separately and are not upcoming reminders
      assert.equal(overview.overdueRenewals.length, 1);
      assert.equal(overview.overdueRenewals[0].isOverdue, true);
      assert.equal(overview.stats.upcomingCount, 2);

      // No payments are invented for the overdue subscription
      const paymentsCheck = await database.query(
        'SELECT COUNT(*)::int AS count FROM payment_history',
      );
      assert.equal(paymentsCheck.rows[0].count, 0);

      const upcomingRes = await client
        .get('/api/v1/billing/upcoming?days=30')
        .set('Authorization', `Bearer ${userOne.accessToken}`);
      assert.equal(upcomingRes.status, 200);
      assert.deepEqual(
        upcomingRes.body.items.map((item) => item.cost),
        ['600.00', '1200.00'],
      );
      assert.equal(upcomingRes.body.overdue.length, 1);
    });

    test('a completed payment advances the renewal date (FR5 trigger)', async () => {
      const client = request(app);
      const sub = await createTestSubscription(userOne, { renewalDate: '2026-11-01' });
      const res = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '499.00', paymentDate: '2026-11-01' });
      assert.equal(res.status, 201);
      assert.equal(res.body.subscription.renewalDate, '2026-12-01');

      const mismatch = await client
        .post(`/api/v1/subscriptions/${sub.id}/payments`)
        .set('Authorization', `Bearer ${userOne.accessToken}`)
        .send({ amount: '1.00', currencyCode: 'USD', paymentDate: '2026-11-02' });
      assert.equal(mismatch.status, 400);
      assert.equal(mismatch.body.code, 'CURRENCY_MISMATCH');
    });
  });
}
