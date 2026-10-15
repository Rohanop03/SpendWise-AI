import assert from 'node:assert/strict';
import { test } from 'node:test';

import { createReminderWorker } from '../src/workers/reminderWorker.js';

test('reminder worker prevents overlapping in-process scans', async () => {
  let release;
  let calls = 0;
  const pending = new Promise((resolve) => {
    release = resolve;
  });
  const worker = createReminderWorker({
    intervalMilliseconds: 60_000,
    job: {
      runOnce: async () => {
        calls += 1;
        await pending;
        return { created: 0 };
      },
    },
    logger: { error() {}, info() {}, warn() {} },
  });

  const first = worker.run();
  const overlapping = await worker.run();
  assert.equal(overlapping, null);
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await first, { created: 0 });
  await worker.stop();
});
