import pg from 'pg';

import config from './env.js';

const { Pool } = pg;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('PostgreSQL is not configured.');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export function createDatabase({ connectionString = config.databaseUrl } = {}) {
  let pool = null;

  function getPool() {
    if (!connectionString) {
      throw new DatabaseNotConfiguredError();
    }

    if (!pool) {
      pool = new Pool({
        connectionString,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        max: 10,
      });

      pool.on('error', () => {
        console.error('An unexpected PostgreSQL pool error occurred.');
      });
    }

    return pool;
  }

  return {
    async close() {
      if (pool) {
        await pool.end();
        pool = null;
      }
    },
    query(text, parameters = []) {
      return getPool().query(text, parameters);
    },
  };
}

const database = createDatabase();

export default database;
