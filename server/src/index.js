import { createApp } from './app.js';
import database from './config/db.js';
import config from './config/env.js';

const app = createApp();

const server = app.listen(config.port, () => {
  console.info(`SpendWise API listening on http://localhost:${config.port}`);
});

let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.info(`${signal} received. Closing HTTP and PostgreSQL connections.`);

  const forceExitTimer = setTimeout(() => {
    console.error('Graceful shutdown timed out.');
    process.exit(1);
  }, 10000);

  forceExitTimer.unref();

  server.close(async (serverError) => {
    try {
      await database.close();
    } catch (databaseError) {
      console.error('PostgreSQL pool shutdown failed.', databaseError);
      process.exitCode = 1;
    }

    clearTimeout(forceExitTimer);

    if (serverError) {
      console.error('HTTP server shutdown failed.', serverError);
      process.exitCode = 1;
    }

    process.exit(process.exitCode || 0);
  });
}

server.on('error', (error) => {
  console.error('The SpendWise API failed to start.', error);
  process.exit(1);
});

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
