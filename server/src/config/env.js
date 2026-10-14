import dotenv from 'dotenv';

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

export function loadConfig(environment = process.env) {
  return Object.freeze({
    allowDemoSeed: parseBoolean(environment.ALLOW_DEMO_SEED, 'ALLOW_DEMO_SEED'),
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL, 'DATABASE_URL'),
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
    port: parsePort(environment.PORT),
    testDatabaseUrl: parseDatabaseUrl(environment.TEST_DATABASE_URL, 'TEST_DATABASE_URL'),
  });
}

const config = loadConfig();

export default config;
