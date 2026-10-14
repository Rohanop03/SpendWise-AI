import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(serverDirectory, '.env'), quiet: true });
dotenv.config({ quiet: true });

const validNodeEnvironments = new Set(['development', 'test', 'production']);

function parsePort(value) {
  const port = Number(value ?? 5000);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function parseNodeEnvironment(value) {
  const nodeEnvironment = value || 'development';

  if (!validNodeEnvironments.has(nodeEnvironment)) {
    throw new Error('NODE_ENV must be development, test, or production.');
  }

  return nodeEnvironment;
}

function parseCorsOrigin(value) {
  const corsOrigin = value || 'http://localhost:5173';

  try {
    const url = new URL(corsOrigin);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error('CORS_ORIGIN must be a valid HTTP or HTTPS origin.');
  }

  return corsOrigin;
}

function parseDatabaseUrl(value, variableName) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error(`${variableName} must be a valid PostgreSQL connection URL when provided.`);
  }

  return value;
}

function parseBoolean(value, variableName, defaultValue = false) {
  if (value === undefined || value === '') {
    return defaultValue;
  }

  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  throw new Error(`${variableName} must be true or false.`);
}

function parseInteger(value, variableName, { defaultValue, maximum, minimum }) {
  const parsed = Number(value ?? defaultValue);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${variableName} must be an integer between ${minimum} and ${maximum}.`);
  }

  return parsed;
}

function parseJwtSecret(value) {
  if (!value) {
    return null;
  }

  if (value.length < 32) {
    throw new Error('JWT_ACCESS_SECRET must contain at least 32 characters.');
  }

  return value;
}

function parseJwtExpiration(value) {
  const expiration = value || '15m';

  if (!/^\d+[smhd]$/.test(expiration)) {
    throw new Error('JWT_ACCESS_EXPIRES_IN must use a value such as 15m, 1h, or 1d.');
  }

  return expiration;
}

export function loadConfig(environment = process.env) {
  return Object.freeze({
    allowDemoSeed: parseBoolean(environment.ALLOW_DEMO_SEED, 'ALLOW_DEMO_SEED'),
    authRateLimitMax: parseInteger(environment.AUTH_RATE_LIMIT_MAX, 'AUTH_RATE_LIMIT_MAX', {
      defaultValue: 10,
      maximum: 1000,
      minimum: 1,
    }),
    bcryptCost: parseInteger(environment.BCRYPT_COST, 'BCRYPT_COST', {
      defaultValue: 12,
      maximum: 15,
      minimum: 10,
    }),
    cookieSecure: parseBoolean(environment.COOKIE_SECURE, 'COOKIE_SECURE'),
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL'),
    jwtAccessExpiresIn: parseJwtExpiration(environment.JWT_ACCESS_EXPIRES_IN),
    jwtAccessSecret: parseJwtSecret(environment.JWT_ACCESS_SECRET),
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
    port: parsePort(environment.PORT),
    refreshTokenExpiresDays: parseInteger(
      environment.REFRESH_TOKEN_EXPIRES_DAYS,
      'REFRESH_TOKEN_EXPIRES_DAYS',
      { defaultValue: 7, maximum: 30, minimum: 1 },
    ),
    testDatabaseUrl: parseDatabaseUrl(environment.TEST_DATABASE_URL, 'TEST_DATABASE_URL'),
  });
}

const config = loadConfig();

export default config;
