import pg from 'pg';

import config from './env.js';

const { Pool } = pg;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super('PostgreSQL is not configured.');
    this.name = 'DatabaseNotConfiguredError';
  }
}

export function createDatabase({
  connectionString = config.databaseUrl,
  poolFactory = (options) => new Pool(options),
} = {}) {
  let pool = null;

  function getPool() {
    if (!connectionString) {
      throw new DatabaseNotConfiguredError();
    }

    if (!pool) {
      const poolOptions = {
        connectionString,
        connectionTimeoutMillis: 3000,
        idleTimeoutMillis: 10000,
        max: 10,
      };

      if (config.databaseSsl) {
        poolOptions.ssl = { rejectUnauthorized: true };
      }

      pool = poolFactory(poolOptions);

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
    async withClient(callback) {
      const client = await getPool().connect();

      try {
        return await callback({
          query: (text, parameters = []) => client.query(text, parameters),
        });
      } finally {
        client.release();
      }
    },
    async withTransaction(callback) {
      const client = await getPool().connect();
      const transaction = {
        query: (text, parameters = []) => client.query(text, parameters),
      };

      try {
        await client.query('BEGIN');
        const result = await callback(transaction);
        await client.query('COMMIT');
        return result;
      } catch (error) {
        try {
          await client.query('ROLLBACK');
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }

        throw error;
      } finally {
        client.release();
      }
    },
    query(text, parameters = []) {
      return getPool().query(text, parameters);
    },
  };
}

const database = createDatabase();

export default database;
