import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, test } from 'node:test';

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';

import { createApp } from '../src/app.js';
import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';
import { runMigrations } from '../src/db/migrationRunner.js';
import { testAppConfig } from './helpers/testConfig.js';

const origin = testAppConfig.corsOrigin;
const password = 'correct horse battery staple';
const newPassword = 'a newer secure passphrase';
const expectedTestDatabaseName = 'spendwise_test';

function csrfPost(client, path) {
  return client.post(path).set('Origin', origin).set('X-Requested-With', 'XMLHttpRequest');
}

function firstCookie(response) {
  return response.headers['set-cookie']?.[0]?.split(';')[0];
}

async function register(client, suffix = 'primary') {
  return csrfPost(client, '/api/v1/auth/register').send({
    displayName: `Stage Four ${suffix}`,
    email: `stage4.${suffix}@example.invalid`,
    password,
  });
}

if (!config.testDatabaseUrl) {
  test('authentication integration tests require TEST_DATABASE_URL', {
    skip: 'Set TEST_DATABASE_URL to the dedicated spendwise_test database.',
  });
} else {
  const database = createDatabase({ connectionString: config.testDatabaseUrl });
  const app = createApp({ appConfig: testAppConfig, databaseClient: database });

  describe('authentication and account API integration', { concurrency: 1 }, () => {
    before(async () => {
      const identity = await database.query(`SELECT current_database() AS database_name`);
      assert.equal(identity.rows[0].database_name, expectedTestDatabaseName);

      await database.withClient(async (client) => {
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public AUTHORIZATION CURRENT_USER');
      });

      const migrations = await runMigrations({ database });
      assert.deepEqual(migrations.applied, ['001_initial_schema', '002_auth_sessions']);
    });

    beforeEach(async () => {
      await database.query(`
        TRUNCATE TABLE auth_sessions, user_preferences, users
        RESTART IDENTITY CASCADE
      `);
    });

    after(async () => {
      await database.close();
    });

    test('registers atomically, hashes the password, creates defaults, and omits secrets', async () => {
      const response = await register(request.agent(app));

      assert.equal(response.status, 201);
      assert.equal(typeof response.body.accessToken, 'string');
      assert.equal(response.body.user.email, 'stage4.primary@example.invalid');
      assert.equal(response.body.user.password, undefined);
      assert.equal(response.body.user.passwordHash, undefined);
      assert.match(response.headers['set-cookie'][0], /HttpOnly/i);
      assert.match(response.headers['set-cookie'][0], /SameSite=Lax/i);
      assert.match(response.headers['set-cookie'][0], /Path=\/api\/v1\/auth/i);
      assert.doesNotMatch(response.headers['set-cookie'][0], /; Secure/i);

      const stored = await database.query(
        `
          SELECT u.password_hash, p.preferred_currency, p.timezone, count(s.id)::INTEGER AS sessions
          FROM users AS u
          INNER JOIN user_preferences AS p ON p.user_id = u.id
          LEFT JOIN auth_sessions AS s ON s.user_id = u.id
          WHERE u.email = $1
          GROUP BY u.password_hash, p.preferred_currency, p.timezone
        `,
        ['stage4.primary@example.invalid'],
      );

      assert.equal(stored.rowCount, 1);
      assert.match(stored.rows[0].password_hash, /^\$2[aby]\$/);
      assert.equal(await bcrypt.compare(password, stored.rows[0].password_hash), true);
      assert.equal(stored.rows[0].preferred_currency, 'USD');
      assert.equal(stored.rows[0].timezone, 'UTC');
      assert.equal(stored.rows[0].sessions, 1);
    });

    test('rejects invalid and duplicate registrations without partial rows', async () => {
      const agent = request.agent(app);
      assert.equal((await register(agent, 'duplicate')).status, 201);

      const duplicate = await csrfPost(request(app), '/api/v1/auth/register').send({
        displayName: 'Duplicate',
        email: 'STAGE4.DUPLICATE@EXAMPLE.INVALID',
        password,
      });
      assert.equal(duplicate.status, 409);
      assert.equal(duplicate.body.code, 'EMAIL_IN_USE');

      const invalidEmail = await csrfPost(request(app), '/api/v1/auth/register').send({
        displayName: 'Invalid',
        email: 'not-an-email',
        password,
      });
      const weakPassword = await csrfPost(request(app), '/api/v1/auth/register').send({
        displayName: 'Invalid',
        email: 'weak@example.invalid',
        password: 'too-short',
      });
      assert.equal(invalidEmail.status, 400);
      assert.equal(weakPassword.status, 400);

      const counts = await database.query(
        `
          SELECT
            (SELECT count(*)::INTEGER FROM users) AS users,
            (SELECT count(*)::INTEGER FROM user_preferences) AS preferences
        `,
      );
      assert.deepEqual(counts.rows[0], { preferences: 1, users: 1 });
    });

    test('logs in safely and issues the minimal expected access-token claims', async () => {
      await register(request.agent(app), 'login');
      const agent = request.agent(app);
      const login = await csrfPost(agent, '/api/v1/auth/login').send({
        email: 'STAGE4.LOGIN@EXAMPLE.INVALID',
        password,
      });

      assert.equal(login.status, 200);
      const claims = jwt.decode(login.body.accessToken);
      assert.deepEqual(Object.keys(claims).sort(), ['aud', 'exp', 'iat', 'iss', 'sid', 'sub']);
      assert.equal(claims.aud, 'spendwise-web');
      assert.equal(claims.iss, 'spendwise-api');

      const wrongPassword = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: 'stage4.login@example.invalid',
        password: 'this password is incorrect',
      });
      const unknownEmail = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: 'unknown@example.invalid',
        password,
      });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknownEmail.status, 401);
      assert.equal(wrongPassword.body.message, unknownEmail.body.message);

      await database.query(`UPDATE users SET account_status = 'disabled' WHERE email = $1`, [
        'stage4.login@example.invalid',
      ]);
      const disabled = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: 'stage4.login@example.invalid',
        password,
      });
      assert.equal(disabled.status, 403);
    });

    test('enforces JWT signature, expiry, issuer, audience, and live session state', async () => {
      const registration = await register(request.agent(app), 'jwt');
      const validToken = registration.body.accessToken;
      const claims = jwt.decode(validToken);
      const endpoint = '/api/v1/auth/me';

      assert.equal((await request(app).get(endpoint)).status, 401);
      assert.equal(
        (await request(app).get(endpoint).set('Authorization', `Bearer ${validToken}`)).status,
        200,
      );

      const basePayload = { sid: claims.sid, sub: claims.sub };
      const invalidSignature = jwt.sign(
        basePayload,
        'different-test-secret-with-at-least-32-chars',
        {
          audience: 'spendwise-web',
          expiresIn: '15m',
          issuer: 'spendwise-api',
        },
      );
      const expired = jwt.sign(basePayload, testAppConfig.jwtAccessSecret, {
        audience: 'spendwise-web',
        expiresIn: -1,
        issuer: 'spendwise-api',
      });
      const invalidAudience = jwt.sign(basePayload, testAppConfig.jwtAccessSecret, {
        audience: 'different-client',
        expiresIn: '15m',
        issuer: 'spendwise-api',
      });

      for (const token of [invalidSignature, expired, invalidAudience]) {
        const response = await request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
        assert.equal(response.status, 401);
      }

      await database.query(
        `UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [claims.sid],
      );
      assert.equal(
        (await request(app).get(endpoint).set('Authorization', `Bearer ${validToken}`)).status,
        401,
      );
    });

    test('rotates refresh tokens and revokes the session when an old token is reused', async () => {
      const registration = await register(request.agent(app), 'rotation');
      const oldCookie = firstCookie(registration);
      const refresh = await csrfPost(request(app), '/api/v1/auth/refresh')
        .set('Cookie', oldCookie)
        .send({});
      const replacementCookie = firstCookie(refresh);

      assert.equal(refresh.status, 200);
      assert.notEqual(replacementCookie, oldCookie);

      const reuse = await csrfPost(request(app), '/api/v1/auth/refresh')
        .set('Cookie', oldCookie)
        .send({});
      assert.equal(reuse.status, 401);

      const protectedAfterReuse = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${refresh.body.accessToken}`);
      assert.equal(protectedAfterReuse.status, 401);
    });

    test('handles concurrent, expired, revoked, invalid, and missing refresh tokens safely', async () => {
      const registration = await register(request.agent(app), 'concurrent');
      const cookie = firstCookie(registration);
      const concurrent = await Promise.all([
        csrfPost(request(app), '/api/v1/auth/refresh').set('Cookie', cookie).send({}),
        csrfPost(request(app), '/api/v1/auth/refresh').set('Cookie', cookie).send({}),
      ]);
      assert.deepEqual(concurrent.map((response) => response.status).sort(), [200, 401]);

      const missing = await csrfPost(request(app), '/api/v1/auth/refresh').send({});
      const invalid = await csrfPost(request(app), '/api/v1/auth/refresh')
        .set('Cookie', 'spendwise_refresh=invalid')
        .send({});
      assert.equal(missing.status, 401);
      assert.equal(invalid.status, 401);

      const expiredRegistration = await register(request.agent(app), 'expired');
      const expiredCookie = firstCookie(expiredRegistration);
      const expiredClaims = jwt.decode(expiredRegistration.body.accessToken);
      await database.query(
        `
          UPDATE auth_sessions
          SET
            created_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
            last_rotated_at = CURRENT_TIMESTAMP - INTERVAL '2 days',
            expires_at = CURRENT_TIMESTAMP - INTERVAL '1 day'
          WHERE id = $1
        `,
        [expiredClaims.sid],
      );
      const expired = await csrfPost(request(app), '/api/v1/auth/refresh')
        .set('Cookie', expiredCookie)
        .send({});
      assert.equal(expired.status, 401);
    });

    test('logs out idempotently, clears the cookie, and immediately invalidates access', async () => {
      const agent = request.agent(app);
      const registration = await register(agent, 'logout');
      const logout = await csrfPost(agent, '/api/v1/auth/logout').send({});

      assert.equal(logout.status, 200);
      assert.match(logout.headers['set-cookie'][0], /spendwise_refresh=;/);
      assert.equal(
        (
          await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${registration.body.accessToken}`)
        ).status,
        401,
      );
      assert.equal((await csrfPost(agent, '/api/v1/auth/logout').send({})).status, 200);
    });

    test('isolates profile and preference operations to the authenticated user', async () => {
      const first = await register(request.agent(app), 'owner-one');
      const second = await register(request.agent(app), 'owner-two');
      const firstToken = first.body.accessToken;

      const profile = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ displayName: 'Updated Owner' });
      assert.equal(profile.status, 200);
      assert.equal(profile.body.user.displayName, 'Updated Owner');

      const invalidProfile = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ displayName: 'Injection', userId: second.body.user.id });
      assert.equal(invalidProfile.status, 400);

      const defaults = await request(app)
        .get('/api/v1/users/me/preferences')
        .set('Authorization', `Bearer ${firstToken}`);
      assert.equal(defaults.status, 200);
      assert.equal(defaults.body.preferences.preferredCurrency, 'USD');

      const updated = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ preferredCurrency: 'INR', renewalReminderDays: 14 });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.preferences.preferredCurrency, 'INR');
      assert.equal(updated.body.preferences.renewalReminderDays, 14);
      assert.equal(updated.body.preferences.timezone, 'UTC');

      const invalid = await request(app)
        .patch('/api/v1/users/me/preferences')
        .set('Authorization', `Bearer ${firstToken}`)
        .send({ renewalReminderDays: 366 });
      assert.equal(invalid.status, 400);

      const secondUser = await database.query(`SELECT display_name FROM users WHERE id = $1`, [
        second.body.user.id,
      ]);
      assert.equal(secondUser.rows[0].display_name, 'Stage Four owner-two');
    });

    test('changes passwords securely and revokes every existing session', async () => {
      const firstAgent = request.agent(app);
      const registration = await register(firstAgent, 'password');
      const secondAgent = request.agent(app);
      const secondLogin = await csrfPost(secondAgent, '/api/v1/auth/login').send({
        email: 'stage4.password@example.invalid',
        password,
      });

      const incorrect = await csrfPost(request(app), '/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${registration.body.accessToken}`)
        .send({ currentPassword: 'incorrect current password', newPassword });
      assert.equal(incorrect.status, 401);

      const changed = await csrfPost(request(app), '/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${registration.body.accessToken}`)
        .send({ currentPassword: password, newPassword });
      assert.equal(changed.status, 200);

      for (const token of [registration.body.accessToken, secondLogin.body.accessToken]) {
        assert.equal(
          (await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`))
            .status,
          401,
        );
      }

      const oldLogin = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: 'stage4.password@example.invalid',
        password,
      });
      const newLogin = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: 'stage4.password@example.invalid',
        password: newPassword,
      });
      assert.equal(oldLogin.status, 401);
      assert.equal(newLogin.status, 200);
    });

    test('rejects CSRF attempts, SQL injection input, malformed JSON, and excessive login attempts', async () => {
      const noOrigin = await request(app).post('/api/v1/auth/login').send({
        email: 'unknown@example.invalid',
        password,
      });
      assert.equal(noOrigin.status, 403);

      const injection = await csrfPost(request(app), '/api/v1/auth/login').send({
        email: "' OR 1=1 --@example.invalid",
        password,
      });
      assert.ok([400, 401].includes(injection.status));
      assert.doesNotMatch(injection.text, /SELECT|password_hash|stack/i);

      const malformed = await request(app)
        .post('/api/v1/auth/login')
        .set('Origin', origin)
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('Content-Type', 'application/json')
        .send('{"email":');
      assert.equal(malformed.status, 400);
      assert.doesNotMatch(malformed.text, /stack|node_modules/i);

      const limitedApp = createApp({
        appConfig: { ...testAppConfig, authRateLimitMax: 2 },
        databaseClient: database,
      });
      const attempts = [];
      for (let attempt = 0; attempt < 3; attempt += 1) {
        attempts.push(
          await csrfPost(request(limitedApp), '/api/v1/auth/login').send({
            email: 'rate-limit@example.invalid',
            password,
          }),
        );
      }
      assert.equal(attempts[2].status, 429);
      assert.equal(attempts[2].body.code, 'RATE_LIMITED');
    });
  });
}
