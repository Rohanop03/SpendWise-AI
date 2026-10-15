import database from '../src/config/db.js';
import config from '../src/config/env.js';
import { createRenewalReminderJob } from '../src/jobs/renewalReminderJob.js';
import { createReminderWorker } from '../src/workers/reminderWorker.js';

const job = createRenewalReminderJob({ batchSize: config.reminderBatchSize, database });
const worker = createReminderWorker({
  intervalMilliseconds: config.reminderIntervalMinutes * 60_000,
  job,
});
let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.info(`${signal} received. Stopping reminder worker.`);
  await worker.stop();
  await database.close();
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.info(`Reminder worker starting with a ${config.reminderIntervalMinutes}-minute interval.`);
await worker.start();
