import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';

import { assertDemoSeedAllowed } from '../db/seeds/demo.js';
import { createDatabase, DatabaseNotConfiguredError } from '../src/config/db.js';
import { calculateChecksum, loadMigrationFiles } from '../src/db/migrationRunner.js';

function createPoolDouble({ failOnQuery } = {}) {
  const calls = [];
  let released = false;

  const client = {
    async query(text, parameters = []) {
      calls.push({ parameters, text });

      if (failOnQuery && text === failOnQuery) {
        throw new Error('forced transaction failure');
      }

      return { rowCount: 0, rows: [] };
    },
    release() {
      released = true;
    },
  };
  const pool = {
    async connect() {
      return client;
    },
    async end() {},
    on() {},
    query: client.query.bind(client),
  };

  return {
    calls,
    pool,
    wasReleased: () => released,
  };
}

describe('database utility', () => {
  it('requires a configured PostgreSQL URL before querying', async () => {
    const database = createDatabase({ connectionString: null });

    await assert.rejects(async () => database.query('SELECT 1'), DatabaseNotConfiguredError);
  });

  it('commits a successful transaction on one acquired client', async () => {
    const poolDouble = createPoolDouble();
    const database = createDatabase({
      connectionString: 'postgresql://example.invalid/test',
      poolFactory: () => poolDouble.pool,
    });

    const value = await database.withTransaction(async (transaction) => {
      await transaction.query('INSERT TEST', ['value']);
      return 'committed';
    });

    assert.equal(value, 'committed');
    assert.deepEqual(
      poolDouble.calls.map((call) => call.text),
      ['BEGIN', 'INSERT TEST', 'COMMIT'],
    );
    assert.equal(poolDouble.wasReleased(), true);
  });

  it('releases a directly acquired client after callback completion', async () => {
    const poolDouble = createPoolDouble();
    const database = createDatabase({
      connectionString: 'postgresql://example.invalid/test',
      poolFactory: () => poolDouble.pool,
    });

    await database.withClient((client) => client.query('SELECT TEST', ['value']));

    assert.deepEqual(poolDouble.calls, [{ parameters: ['value'], text: 'SELECT TEST' }]);
    assert.equal(poolDouble.wasReleased(), true);
  });

  it('rolls back a failed transaction and releases the client', async () => {
    const poolDouble = createPoolDouble({ failOnQuery: 'INVALID TEST' });
    const database = createDatabase({
      connectionString: 'postgresql://example.invalid/test',
      poolFactory: () => poolDouble.pool,
    });

    await assert.rejects(
      database.withTransaction(async (transaction) => {
        await transaction.query('INSERT TEST');
        await transaction.query('INVALID TEST');
      }),
      /forced transaction failure/,
    );

    assert.deepEqual(
      poolDouble.calls.map((call) => call.text),
      ['BEGIN', 'INSERT TEST', 'INVALID TEST', 'ROLLBACK'],
    );
    assert.equal(poolDouble.wasReleased(), true);
  });
});

describe('demo seed safeguards', () => {
  it('requires development opt-in and the exact development database', () => {
    assert.throws(
      () =>
        assertDemoSeedAllowed({
          allowDemoSeed: false,
          databaseName: 'spendwise_dev',
          nodeEnv: 'development',
        }),
      /ALLOW_DEMO_SEED=true/,
    );
    assert.throws(
      () =>
        assertDemoSeedAllowed({
          allowDemoSeed: true,
          databaseName: 'smart_subscription_test',
          nodeEnv: 'development',
        }),
      /restricted to the smart_subscription development database/,
    );
    assert.doesNotThrow(() =>
      assertDemoSeedAllowed({
        allowDemoSeed: true,
        databaseName: 'smart_subscription',
        nodeEnv: 'development',
      }),
    );
  });
});

describe('migration file utilities', () => {
  it('calculates a stable SHA-256 checksum', () => {
    assert.equal(
      calculateChecksum('SELECT 1;'),
      '17db4fd369edb9244b9f91d9aeed145c3d04ad8ba6e95d06247f07a63527d11a',
    );
  });

  it('loads only valid migration filenames in deterministic order', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'spendwise-migrations-'));

    try {
      await writeFile(path.join(directory, '002_second.sql'), 'SELECT 2;');
      await writeFile(path.join(directory, '001_first.sql'), 'SELECT 1;');
      await writeFile(path.join(directory, 'notes.txt'), 'ignored');

      const migrations = await loadMigrationFiles(directory);

      assert.deepEqual(
        migrations.map((migration) => migration.id),
        ['001_first', '002_second'],
      );
    } finally {
      await rm(directory, { force: true, recursive: true });
    }
  });
});
