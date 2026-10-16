import assert from 'node:assert/strict';
import { before, beforeEach, describe, it, test } from 'node:test';

import jwt from 'jsonwebtoken';
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

async function registerUser(client, suffix) {
  const response = await csrfPost(client, '/api/v1/auth/register').send({
    name: `Security Test ${suffix}`,
    email: `security.${suffix}@example.invalid`,
    password,
  });
  assert.equal(response.status, 201, `Failed to register user ${suffix}`);
  return {
    accessToken: response.body.accessToken,
    user: response.body.user,
  };
}

if (!config.testDatabaseUrl) {
  test('security integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated smart_subscription_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('security, isolation, and hardening integration', { concurrency: 1 }, () => {
    let categoriesList = [];

    before(async () => {
      const identity = await database.query('SELECT current_database() AS database_name');
      assert.equal(identity.rows[0].database_name, expectedTestDatabaseName);

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      await runMigrations({ database });
      await seedCatalog(database);

      const catResult = await database.query('SELECT category_id AS id, category_name AS name FROM category ORDER BY category_name ASC');
      categoriesList = catResult.rows;
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE
          subscription_audit_events, auth_sessions,
          recommendation, notifications, refunds, payment_history, subscription,
          user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    describe('HTTP security headers and server identification', () => {
      it('returns defensive security headers and suppresses X-Powered-By on API responses', async () => {
        const response = await request(app).get('/api/v1/health');

        assert.equal(response.status, 200);
        assert.equal(response.headers['x-content-type-options'], 'nosniff');
        assert.equal(response.headers['x-frame-options'], 'DENY');
        assert.equal(response.headers['referrer-policy'], 'strict-origin-when-cross-origin');
        assert.equal(response.headers['x-xss-protection'], '0');
        assert.equal(response.headers['cross-origin-opener-policy'], 'same-origin');
        assert.equal(response.headers['x-powered-by'], undefined);
      });

      it('emits Strict-Transport-Security when configured in production mode with HTTPS', async () => {
        const prodConfig = {
          ...testAppConfig,
          cookieSecure: true,
          nodeEnv: 'production',
        };
        const prodApp = createApp({ appConfig: prodConfig, databaseClient: database });
        const response = await request(prodApp).get('/api/v1/health');

        assert.equal(response.status, 200);
        assert.equal(
          response.headers['strict-transport-security'],
          'max-age=31536000; includeSubDomains; preload',
        );
      });
    });

    describe('Cross-account resource isolation (404 policy)', () => {
      it('strictly rejects access to foreign subscriptions, payments, and refunds with 404', async () => {
        const client = request(app);

        // Register User A and User B
        const userA = await registerUser(client, 'usera');
        const userB = await registerUser(client, 'userb');

        // User A creates a subscription
        const createSubRes = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: 'Secret Stream A',
            renewalDate: '2026-11-01',
            cost: 15.99,
            startDate: '2026-10-01',
          });
        assert.equal(createSubRes.status, 201);
        const subAId = createSubRes.body.subscription.id;

        // User A records a payment for their subscription
        const createPayRes = await client
          .post(`/api/v1/subscriptions/${subAId}/payments`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({
            amount: 15.99,
            billingPeriodEnd: '2026-10-31',
            billingPeriodStart: '2026-10-01',
            currencyCode: 'USD',
            paymentDate: '2026-10-01',
            paymentStatus: 'completed',
          });
        assert.equal(createPayRes.status, 201);
        const payAId = createPayRes.body.payment.id;

        // User A records a refund
        const refundRes = await client
          .post(`/api/v1/payments/${payAId}/refunds`)
          .set('Authorization', `Bearer ${userA.accessToken}`)
          .send({
            amount: 5.0,
            reason: 'Partial courtesy refund',
            refundDate: '2026-10-05',
          });
        assert.equal(refundRes.status, 201);

        // User B attempts to access User A's subscription
        const getSubForeign = await client
          .get(`/api/v1/subscriptions/${subAId}`)
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(getSubForeign.status, 404);
        assert.equal(getSubForeign.body.code, 'NOT_FOUND');

        // User B attempts to edit User A's subscription
        const patchSubForeign = await client
          .patch(`/api/v1/subscriptions/${subAId}`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ serviceName: 'Hacked Service' });
        assert.equal(patchSubForeign.status, 404);
        assert.equal(patchSubForeign.body.code, 'NOT_FOUND');

        // User B attempts to archive User A's subscription
        const archiveSubForeign = await client
          .post(`/api/v1/subscriptions/${subAId}/archive`)
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(archiveSubForeign.status, 404);
        assert.equal(archiveSubForeign.body.code, 'NOT_FOUND');

        // User B attempts to restore User A's subscription
        const restoreSubForeign = await client
          .post(`/api/v1/subscriptions/${subAId}/restore`)
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(restoreSubForeign.status, 404);
        assert.equal(restoreSubForeign.body.code, 'NOT_FOUND');

        // User B attempts to view User A's payment
        const getPayForeign = await client
          .get(`/api/v1/payments/${payAId}`)
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(getPayForeign.status, 404);
        assert.equal(getPayForeign.body.code, 'NOT_FOUND');

        // User B attempts to update User A's payment
        const patchPayForeign = await client
          .patch(`/api/v1/payments/${payAId}`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ notes: 'Tampered notes' });
        assert.equal(patchPayForeign.status, 404);
        assert.equal(patchPayForeign.body.code, 'NOT_FOUND');

        // User B attempts to refund User A's payment
        const postRefundForeign = await client
          .post(`/api/v1/payments/${payAId}/refunds`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ amount: 10.0, refundDate: '2026-10-06' });
        assert.equal(postRefundForeign.status, 404);
        assert.equal(postRefundForeign.body.code, 'NOT_FOUND');

        // User B attempts to create a payment against User A's subscription
        const postPayForeignSub = await client
          .post(`/api/v1/subscriptions/${subAId}/payments`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({
            amount: 15.99,
            billingPeriodEnd: '2026-10-31',
            billingPeriodStart: '2026-10-01',
            currencyCode: 'USD',
            paymentDate: '2026-10-01',
            paymentStatus: 'completed',
          });
        assert.equal(postPayForeignSub.status, 404);
        assert.equal(postPayForeignSub.body.code, 'NOT_FOUND');

        // User B's analytics overview must show zero spend and no foreign payments
        const analyticsRes = await client
          .get('/api/v1/analytics/overview')
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(analyticsRes.status, 200);
        assert.equal(analyticsRes.body.currencySummaries.length, 0);
      });

      it('isolates notifications and recommendations between accounts', async () => {
        const client = request(app);

        const userA = await registerUser(client, 'user-notif-a');
        const userB = await registerUser(client, 'user-notif-b');

        // Insert direct notification fixture for User A
        const notifResult = await database.query(
          `
            INSERT INTO notifications (
              user_id, notification_type, title, message, scheduled_for, deduplication_key
            ) VALUES (
              $1, 'system', 'User A Private Alert', 'Confidential notification',
              CURRENT_TIMESTAMP, 'user-a-notif-dedup-key-1'
            )
            RETURNING id
          `,
          [userA.user.id],
        );
        const notifAId = notifResult.rows[0].id;

        // User B lists notifications
        const listB = await client
          .get('/api/v1/notifications')
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(listB.status, 200);
        const userBNotifs = listB.body.notifications || [];
        assert.ok(!userBNotifs.some((n) => n.id === notifAId));

        // User B attempts to mark User A's notification as read
        const markReadForeign = await client
          .patch(`/api/v1/notifications/${notifAId}/read`)
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(markReadForeign.status, 404);
        assert.equal(markReadForeign.body.code, 'NOT_FOUND');

        // Insert direct recommendation fixture for User A
        const recResult = await database.query(
          `
            INSERT INTO recommendation (
              user_id, rule, status, recommendation_text, potential_savings, currency_code,
              title, priority, suggested_action
            ) VALUES (
              $1, 'above_category_average', 'Pending',
              'User A Private Recommendation', 25.00, 'USD',
              'Above category average', 'medium', 'Review subscription terms'
            )
            RETURNING recommendation_id AS id
          `,
          [userA.user.id],
        );
        const recAId = recResult.rows[0].id;

        // User B lists recommendations
        const listRecsB = await client
          .get('/api/v1/recommendations')
          .set('Authorization', `Bearer ${userB.accessToken}`);
        assert.equal(listRecsB.status, 200);
        const userBRecs = listRecsB.body.recommendations || [];
        assert.ok(!userBRecs.some((r) => r.id === recAId));

        // User B attempts to dismiss User A's recommendation
        const dismissForeign = await client
          .patch(`/api/v1/recommendations/${recAId}`)
          .set('Authorization', `Bearer ${userB.accessToken}`)
          .send({ status: 'Dismissed' });
        assert.equal(dismissForeign.status, 404);
        assert.equal(dismissForeign.body.code, 'NOT_FOUND');
      });
    });

    describe('Authentication and token integrity', () => {
      it('rejects unauthenticated requests to protected endpoints', async () => {
        const client = request(app);

        const res1 = await client.get('/api/v1/subscriptions');
        assert.equal(res1.status, 401);
        assert.equal(res1.body.code, 'AUTHENTICATION_REQUIRED');

        const res2 = await client.get('/api/v1/analytics/overview');
        assert.equal(res2.status, 401);
        assert.equal(res2.body.code, 'AUTHENTICATION_REQUIRED');

        const res3 = await client.get('/api/v1/notifications');
        assert.equal(res3.status, 401);
        assert.equal(res3.body.code, 'AUTHENTICATION_REQUIRED');

        const res4 = await client.get('/api/v1/recommendations');
        assert.equal(res4.status, 401);
        assert.equal(res4.body.code, 'AUTHENTICATION_REQUIRED');
      });

      it('rejects forged tokens signed with an arbitrary secret', async () => {
        const forgedToken = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) + 3600,
            iat: Math.floor(Date.now() / 1000),
            sid: 'fake-sid',
            sub: '99999',
          },
          'wrong-secret-key-that-does-not-match-spendwise-access-secret',
        );

        const response = await request(app)
          .get('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${forgedToken}`);

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 'AUTHENTICATION_REQUIRED');
      });

      it('rejects expired access tokens', async () => {
        const expiredToken = jwt.sign(
          {
            exp: Math.floor(Date.now() / 1000) - 60,
            iat: Math.floor(Date.now() / 1000) - 120,
            sid: 'fake-sid',
            sub: '1',
          },
          testAppConfig.jwtAccessSecret,
        );

        const response = await request(app)
          .get('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${expiredToken}`);

        assert.equal(response.status, 401);
        assert.equal(response.body.code, 'AUTHENTICATION_REQUIRED');
      });

      it('revokes session on logout and rejects revoked refresh tokens', async () => {
        const client = request(app);
        const registerRes = await csrfPost(client, '/api/v1/auth/register').send({
          name: 'Logout Security Tester',
          email: 'logout.security@example.invalid',
          password,
        });
        assert.equal(registerRes.status, 201);

        const refreshTokenCookie = registerRes.headers['set-cookie']?.[0]?.split(';')[0];
        assert.ok(refreshTokenCookie, 'Expected refresh token cookie');

        // Logout
        const logoutRes = await csrfPost(client, '/api/v1/auth/logout')
          .set('Cookie', [refreshTokenCookie])
          .send();
        assert.equal(logoutRes.status, 200);

        // Attempting to refresh using the revoked session cookie
        const refreshRes = await csrfPost(client, '/api/v1/auth/refresh')
          .set('Cookie', [refreshTokenCookie])
          .send();
        assert.equal(refreshRes.status, 401);
      });
    });

    describe('Input validation, parameter boundaries, and injection defense', () => {
      it('safely handles SQL injection probes in queries and request parameters', async () => {
        const client = request(app);
        const user = await registerUser(client, 'sqli-tester');

        // Probe in query parameters: ' OR 1=1 --
        const sqlProbeQuery = await client
          .get("/api/v1/subscriptions?search=' OR 1=1 --")
          .set('Authorization', `Bearer ${user.accessToken}`);
        assert.equal(sqlProbeQuery.status, 200);
        assert.equal(sqlProbeQuery.body.items.length, 0);

        // Probe in body parameter
        const sqlProbeBody = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: "'; DROP TABLE subscription; --",
            renewalDate: '2026-11-01',
            cost: 19.99,
            startDate: '2026-10-01',
          });
        assert.equal(sqlProbeBody.status, 201);

        // Confirm table was not dropped and data is intact
        const tableCheck = await database.query('SELECT COUNT(*)::int AS count FROM subscription');
        assert.equal(tableCheck.rows[0].count, 1);
      });

      it('rejects negative or zero monetary amounts', async () => {
        const client = request(app);
        const user = await registerUser(client, 'money-boundary');

        const negativePrice = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: 'Negative Price Subscription',
            renewalDate: '2026-11-01',
            cost: -5.0,
            startDate: '2026-10-01',
          });
        assert.equal(negativePrice.status, 400);
        assert.equal(negativePrice.body.code, 'VALIDATION_ERROR');

        const nonNumericPrice = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: 'Invalid Price Subscription',
            renewalDate: '2026-11-01',
            cost: 'not-a-number',
            startDate: '2026-10-01',
          });
        assert.equal(nonNumericPrice.status, 400);
        assert.equal(nonNumericPrice.body.code, 'VALIDATION_ERROR');
      });

      it('rejects inverted renewal dates that precede the start date', async () => {
        const client = request(app);
        const user = await registerUser(client, 'inverted-dates');

        const invertedDates = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: 'Time Travel Subscription',
            renewalDate: '2026-05-01',
            cost: 12.0,
            startDate: '2026-10-01',
          });
        assert.equal(invertedDates.status, 400);
        assert.equal(invertedDates.body.code, 'VALIDATION_ERROR');
      });

      it('rejects oversized JSON payloads with HTTP 413', async () => {
        const client = request(app);
        const user = await registerUser(client, 'payload-tester');

        // Create a string that exceeds 100kb limit
        const largeString = 'A'.repeat(120 * 1024);

        const response = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .set('Content-Type', 'application/json')
          .send(JSON.stringify({ serviceName: largeString }));

        assert.equal(response.status, 413);
      });

      it('neutralizes spreadsheet formula injection in CSV exports', async () => {
        const client = request(app);
        const user = await registerUser(client, 'csv-injection');

        // Create a subscription with formula payload
        const subRes = await client
          .post('/api/v1/subscriptions')
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            billingCycle: 'Monthly',
            categoryId: categoriesList[0].id,
            currencyCode: 'USD',
            serviceName: '=CMD|calc.exe',
            renewalDate: '2026-11-01',
            cost: 29.99,
            startDate: '2026-10-01',
          });
        assert.equal(subRes.status, 201);
        const subId = subRes.body.subscription.id;

        // Record a payment for this subscription
        const payRes = await client
          .post(`/api/v1/subscriptions/${subId}/payments`)
          .set('Authorization', `Bearer ${user.accessToken}`)
          .send({
            amount: 29.99,
            currencyCode: 'USD',
            notes: '+1234567890-DangerousFormula',
            paymentDate: '2026-10-01',
            paymentStatus: 'completed',
          });
        assert.equal(payRes.status, 201);

        // Export report as CSV
        const csvRes = await client
          .get('/api/v1/analytics/report/export')
          .set('Authorization', `Bearer ${user.accessToken}`);
        assert.equal(csvRes.status, 200);

        // Verify CSV output neutralized the formula injection
        // Formula injection characters at beginning of cell must be prefixed with a single quote (')
        assert.ok(
          csvRes.text.includes("''=CMD|calc.exe\"") || csvRes.text.includes("'=CMD|calc.exe"),
          'Expected formula injection characters to be prefixed with single quote',
        );
      });
    });
  });
}
