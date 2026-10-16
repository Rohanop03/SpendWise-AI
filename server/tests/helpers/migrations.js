import { loadMigrationFiles } from '../../src/db/migrationRunner.js';

/** Every migration id in server/db/migrations, in apply order. */
export const allMigrationIds = (await loadMigrationFiles()).map((migration) => migration.id);
