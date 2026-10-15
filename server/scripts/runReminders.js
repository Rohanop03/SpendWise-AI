import database from '../src/config/db.js';
import config from '../src/config/env.js';
import { createRenewalReminderJob } from '../src/jobs/renewalReminderJob.js';

try {
  const summary = await createRenewalReminderJob({
    batchSize: config.reminderBatchSize,
    database,
  }).runOnce();
  console.info('Reminder scan completed.', summary);
  if (summary.errors > 0) process.exitCode = 1;
} catch (error) {
  console.error('Reminder scan failed.', { message: error.message });
  process.exitCode = 1;
} finally {
  await database.close();
}
