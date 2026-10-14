import database from '../src/config/db.js';

try {
  const result = await database.query(`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      version() AS postgres_version
  `);
  const connection = result.rows[0];

  console.info(`Database: ${connection.database_name}`);
  console.info(`Role: ${connection.database_user}`);
  console.info(`Server: ${connection.postgres_version}`);
} catch (error) {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
