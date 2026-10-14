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

function parseDatabaseUrl(value) {
  if (!value?.trim()) {
    return null;
  }

  try {
    const url = new URL(value);

    if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
      throw new Error();
    }
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL connection URL when provided.');
  }

  return value;
}

export function loadConfig(environment = process.env) {
  return Object.freeze({
    corsOrigin: parseCorsOrigin(environment.CORS_ORIGIN),
    databaseUrl: parseDatabaseUrl(environment.DATABASE_URL),
    nodeEnv: parseNodeEnvironment(environment.NODE_ENV),
    port: parsePort(environment.PORT),
  });
}

const config = loadConfig();

export default config;
