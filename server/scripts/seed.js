import { seedCatalog } from '../db/seeds/catalog.js';
import { seedDemoData } from '../db/seeds/demo.js';
import database from '../src/config/db.js';
import config from '../src/config/env.js';

const isDemoSeed = process.argv.includes('--demo');

try {
  const catalogResult = await seedCatalog(database);
  console.info(
    `Catalog seed complete: ${catalogResult.categories} categories and ${catalogResult.services} services.`,
  );

  if (isDemoSeed) {
    const demoResult = await seedDemoData(database, {
      allowDemoSeed: config.allowDemoSeed,
      nodeEnv: config.nodeEnv,
    });
    console.info(
      `Fictional demo seed complete: ${demoResult.users} users and ${demoResult.subscriptions} subscriptions.`,
    );
  }
} catch (error) {
  console.error(`Seed failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await database.close();
}
