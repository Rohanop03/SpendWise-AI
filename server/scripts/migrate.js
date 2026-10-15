import database from '../src/config/db.js';
import { runMigrations } from '../src/db/migrationRunner.js';

try {
  const result = await runMigrations({ database });

  if (result.applied.length > 0) {
    console.info(`Applied migrations: ${result.applied.join(', ')}`);
  } else {
    console.info('No pending migrations.');
  }

  if (result.skipped.length > 0) {
    console.info(`Already applied: ${result.skipped.join(', ')}`);
  }
} catch (error) {
  const details = [error.code, error.message || error.name].filter(Boolean).join(': ');
  console.error(`Migration failed: ${details || 'unknown database error'}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
