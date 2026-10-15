import { formatEventDate, getLocalDate, isReminderEligible } from '../utils/reminderDates.js';

function createReminder(candidate, now) {
  const trial = candidate.status === 'trial';
  const targetEventDate = trial ? candidate.trialEndDate : candidate.nextRenewalDate;
  const leadDays = trial ? candidate.trialReminderDays : candidate.renewalReminderDays;
  const localDate = getLocalDate(now, candidate.timezone);
  if (!isReminderEligible({ leadDays, localDate, targetDate: targetEventDate })) return null;

  const type = trial ? 'trial_expiration' : 'renewal';
  const formattedDate = formatEventDate(targetEventDate, candidate.timezone);
  return {
    deduplicationKey: `${type}:${candidate.subscriptionId}:${targetEventDate}`,
    message: trial
      ? `Your ${candidate.serviceName} trial is scheduled to end on ${formattedDate}. Subscription information may have changed since this reminder was generated.`
      : `Your ${candidate.serviceName} subscription is scheduled to renew on ${formattedDate}. Subscription information may have changed since this reminder was generated.`,
    scheduledFor: now,
    subscriptionId: candidate.subscriptionId,
    targetEventDate,
    title: trial
      ? `${candidate.serviceName} trial ending soon`
      : `${candidate.serviceName} renewal approaching`,
    type,
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
      let offset = 0;
      while (true) {
        const candidates = await repository.findReminderCandidates({ limit: batchSize, offset });
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
        offset += batchSize;
      }
      return summary;
    },
  };
}
