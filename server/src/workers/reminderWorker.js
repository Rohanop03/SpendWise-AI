export function createReminderWorker({ intervalMilliseconds, job, logger = console }) {
  let running = false;
  let runningPromise = null;
  let timer = null;

  async function run() {
    if (running) {
      logger.warn('Reminder scan skipped because the previous scan is still running.');
      return null;
    }
    running = true;
    runningPromise = (async () => {
      try {
        const summary = await job.runOnce();
        logger.info('Reminder scan completed.', summary);
        return summary;
      } catch (error) {
        logger.error('Reminder scan failed.', { message: error.message });
        return null;
      } finally {
        running = false;
        runningPromise = null;
      }
    })();
    return runningPromise;
  }

  return {
    async start() {
      await run();
      timer = setInterval(run, intervalMilliseconds);
    },
    async stop() {
      if (timer) clearInterval(timer);
      timer = null;
      if (runningPromise) await runningPromise;
    },
    run,
  };
}
