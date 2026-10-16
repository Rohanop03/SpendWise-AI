import { createDatabase } from '../src/config/db.js';
import config from '../src/config/env.js';

export const expectedTestDatabaseName = 'smart_subscription_test';

export function createTestDatabase() {
  if (!config.testDatabaseUrl) {
    throw new Error('TEST_DATABASE_URL is required for advanced database commands.');
  }

  return createDatabase({ connectionString: config.testDatabaseUrl });
}

export async function assertDedicatedTestDatabase(database) {
  const result = await database.query('SELECT current_database() AS database_name');
  const databaseName = result.rows[0].database_name;

  if (databaseName !== expectedTestDatabaseName) {
    throw new Error(
      `Advanced database commands are restricted to ${expectedTestDatabaseName}; connected to ${databaseName}.`,
    );
  }

  return databaseName;
}

export function uniqueFixture(prefix) {
  return `${prefix}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
