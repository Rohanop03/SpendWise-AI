import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const migrationFilePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const migrationLockId = 738214601;
const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

export const defaultMigrationsDirectory = path.resolve(currentDirectory, '../../db/migrations');

export function calculateChecksum(contents) {
  return createHash('sha256').update(contents).digest('hex');
}

export async function loadMigrationFiles(migrationsDirectory = defaultMigrationsDirectory) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const filenames = entries
    .filter((entry) => entry.isFile() && migrationFilePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  if (filenames.length === 0) {
    throw new Error(`No migration files were found in ${migrationsDirectory}.`);
  }

  return Promise.all(
    filenames.map(async (filename) => {
      const contents = await readFile(path.join(migrationsDirectory, filename), 'utf8');

      return {
        checksum: calculateChecksum(contents),
        contents,
        id: filename.replace(/\.sql$/, ''),
      };
    }),
  );
}

async function ensureMigrationTable(database) {
  await database.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_id VARCHAR(255) PRIMARY KEY,
      checksum CHAR(64) NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT chk_schema_migrations_checksum
        CHECK (checksum ~ '^[0-9a-f]{64}$')
    )
  `);
}

async function getAppliedMigrations(database) {
  const result = await database.query(`
    SELECT migration_id, checksum
    FROM schema_migrations
    ORDER BY migration_id
  `);

  return new Map(result.rows.map((row) => [row.migration_id, row.checksum.trim()]));
}

function validateMigrationHistory(migrations, appliedMigrations) {
  const localMigrations = new Map(migrations.map((migration) => [migration.id, migration]));

  for (const [migrationId, appliedChecksum] of appliedMigrations) {
    const localMigration = localMigrations.get(migrationId);

    if (!localMigration) {
      throw new Error(`Applied migration ${migrationId} is missing from the repository.`);
    }

    if (localMigration.checksum !== appliedChecksum) {
      throw new Error(`Applied migration ${migrationId} has been modified.`);
    }
  }
}

export async function runMigrations({
  database,
  migrationsDirectory = defaultMigrationsDirectory,
} = {}) {
  if (!database) {
    throw new Error('A database client is required to run migrations.');
  }

  const migrations = await loadMigrationFiles(migrationsDirectory);
  await ensureMigrationTable(database);

  const appliedMigrations = await getAppliedMigrations(database);
  validateMigrationHistory(migrations, appliedMigrations);

  const applied = [];
  const skipped = [];

  for (const migration of migrations) {
    if (appliedMigrations.has(migration.id)) {
      skipped.push(migration.id);
      continue;
    }

    const wasApplied = await database.withTransaction(async (transaction) => {
      await transaction.query('SELECT pg_advisory_xact_lock($1)', [migrationLockId]);

      const existing = await transaction.query(
        `SELECT checksum FROM schema_migrations WHERE migration_id = $1`,
        [migration.id],
      );

      if (existing.rowCount > 0) {
        if (existing.rows[0].checksum.trim() !== migration.checksum) {
          throw new Error(`Applied migration ${migration.id} has a checksum conflict.`);
        }

        return false;
      }

      await transaction.query(migration.contents);
      await transaction.query(
        `INSERT INTO schema_migrations (migration_id, checksum) VALUES ($1, $2)`,
        [migration.id, migration.checksum],
      );

      return true;
    });

    if (wasApplied) {
      applied.push(migration.id);
    } else {
      skipped.push(migration.id);
    }
  }

  return { applied, skipped };
}
