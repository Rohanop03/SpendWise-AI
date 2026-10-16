import { formatEventDate, getUserToday, isReminderEligible } from '../utils/reminderDates.js';

function createReminder(candidate, now) {
  const targetEventDate = candidate.renewalDate;
  // "Today" is the user's local date (same definition as GET /billing/upcoming).
  const localDate = getUserToday(candidate.timezone, now);
  if (
    !isReminderEligible({ leadDays: candidate.renewalReminderDays, localDate, targetDate: targetEventDate })
  ) {
    return null;
  }

  const formattedDate = formatEventDate(targetEventDate, candidate.timezone);
  return {
    deduplicationKey: `renewal:${candidate.subscriptionId}:${targetEventDate}`,
    message: `Your ${candidate.serviceName} subscription is scheduled to renew on ${formattedDate}. Subscription information may have changed since this reminder was generated.`,
    scheduledFor: now,
    subscriptionId: candidate.subscriptionId,
    targetEventDate,
    title: `${candidate.serviceName} renewal approaching`,
    type: 'renewal',
    userId: candidate.userId,
  };
}

export function createReminderService(
  repository,
  { batchSize = 500, clock = () => new Date() } = {},
) {
  return {
    async runOnce() {
      const now = clock();
      const summary = { created: 0, duplicatesSkipped: 0, eligible: 0, errors: 0, examined: 0 };
      let after = null;
      while (true) {
        const candidates = await repository.findReminderCandidates({ after, limit: batchSize });
        if (candidates.length === 0) break;
        summary.examined += candidates.length;
        for (const candidate of candidates) {
          try {
            const reminder = createReminder(candidate, now);
            if (!reminder) continue;
            summary.eligible += 1;
            if (await repository.insertReminder(reminder)) summary.created += 1;
            else summary.duplicatesSkipped += 1;
          } catch {
            summary.errors += 1;
          }
        }
        if (candidates.length < batchSize) break;
        const last = candidates.at(-1);
        after = { subscriptionId: last.subscriptionId, userId: last.userId };
      }
      return summary;
    },
  };
}
