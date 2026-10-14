import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import request from 'supertest';

import { createApp } from '../src/app.js';
import { testAppConfig } from './helpers/testConfig.js';

function createTestApp(databaseClient) {
  return createApp({
    appConfig: testAppConfig,
    databaseClient,
  });
}

describe('health API', () => {
  it('returns the backend health response without accessing PostgreSQL', async () => {
    const databaseClient = {
      query() {
        throw new Error('The general health endpoint must not query PostgreSQL.');
      },
    };
    const response = await request(createTestApp(databaseClient)).get('/api/v1/health');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: 'ok',
      service: 'spendwise-api',
    });
  });

  it('returns 200 when PostgreSQL responds to the connectivity query', async () => {
    const databaseClient = {
      async query(text) {
        assert.equal(text, 'SELECT 1');
      },
    };
    const response = await request(createTestApp(databaseClient)).get('/api/v1/health/database');

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      status: 'ok',
      database: 'connected',
    });
  });

  it('returns 503 without exposing details when PostgreSQL is unavailable', async () => {
    const databaseClient = {
      async query() {
        throw new Error('password authentication failed for secret-value');
      },
    };
    const response = await request(createTestApp(databaseClient)).get('/api/v1/health/database');

    assert.equal(response.status, 503);
    assert.deepEqual(response.body, {
      status: 'error',
      database: 'unavailable',
    });
    assert.doesNotMatch(response.text, /password|secret-value/i);
  });

  it('returns a consistent 404 response for unknown API routes', async () => {
    const response = await request(createTestApp({ query: async () => {} })).get(
      '/api/v1/does-not-exist',
    );

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, {
      status: 'error',
      message: 'Route not found: GET /api/v1/does-not-exist',
    });
  });
});
