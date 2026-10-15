import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

import { createReminderService } from '../src/services/reminderService.js';
import { addCalendarDays, getLocalDate, isReminderEligible } from '../src/utils/reminderDates.js';

describe('reminder calendar rules', () => {
  test('uses user-local dates at the same instant', () => {
    const instant = new Date('2026-11-17T02:00:00.000Z');
    assert.equal(getLocalDate(instant, 'Asia/Kolkata'), '2026-11-17');
    assert.equal(getLocalDate(instant, 'America/New_York'), '2026-11-16');
  });

  test('handles leap days, month ends, and year transitions', () => {
    assert.equal(addCalendarDays('2028-03-01', -1), '2028-02-29');
    assert.equal(addCalendarDays('2026-03-01', -1), '2026-02-28');
    assert.equal(addCalendarDays('2027-01-01', -1), '2026-12-31');
  });

  test('uses an inclusive threshold-to-target window and excludes overdue dates', () => {
    assert.equal(
      isReminderEligible({ leadDays: 3, localDate: '2026-11-17', targetDate: '2026-11-20' }),
      true,
    );
    assert.equal(
      isReminderEligible({ leadDays: 3, localDate: '2026-11-20', targetDate: '2026-11-20' }),
      true,
    );
    assert.equal(
      isReminderEligible({ leadDays: 3, localDate: '2026-11-16', targetDate: '2026-11-20' }),
      false,
    );
    assert.equal(
      isReminderEligible({ leadDays: 3, localDate: '2026-11-21', targetDate: '2026-11-20' }),
      false,
    );
    assert.equal(
      isReminderEligible({ leadDays: 3, localDate: '2026-11-17', targetDate: null }),
      false,
    );
  });

  test('generates stable renewal and trial reminders with an injectable clock', async () => {
    const inserted = [];
    const repository = {
      findReminderCandidates: async ({ offset }) =>
        offset > 0
          ? []
          : [
              {
                nextRenewalDate: '2026-11-20',
                renewalReminderDays: 3,
                serviceName: 'Custom Stream',
                status: 'active',
                subscriptionId: '10',
                timezone: 'UTC',
                trialEndDate: null,
                trialReminderDays: 2,
                userId: '1',
              },
              {
                nextRenewalDate: '2026-12-01',
                renewalReminderDays: 3,
                serviceName: 'Trial Tool',
                status: 'trial',
                subscriptionId: '11',
                timezone: 'UTC',
                trialEndDate: '2026-11-19',
                trialReminderDays: 2,
                userId: '1',
              },
            ],
      insertReminder: async (reminder) => {
        inserted.push(reminder);
        return true;
      },
    };
    const service = createReminderService(repository, {
      batchSize: 10,
      clock: () => new Date('2026-11-17T12:00:00.000Z'),
    });
    const summary = await service.runOnce();
    assert.deepEqual(summary, {
      created: 2,
      duplicatesSkipped: 0,
      eligible: 2,
      errors: 0,
      examined: 2,
    });
    assert.equal(inserted[0].deduplicationKey, 'renewal:10:2026-11-20');
    assert.match(inserted[0].title, /Custom Stream renewal approaching/);
    assert.equal(inserted[1].type, 'trial_expiration');
    assert.match(inserted[1].message, /trial is scheduled to end/);
  });
});
