/**
 * Safe calendar date utilities for billing intervals, renewal projections,
 * and overdue date detection.
 * Operates strictly on UTC calendar days to eliminate local timezone drift.
 */

export function parseIsoDate(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') {
    return null;
  }
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return { date, day, month, year };
}

export function formatIsoDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayUtcIsoString() {
  const now = new Date();
  return formatIsoDate(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
  );
}

/**
 * Calculates difference in calendar days between targetDate and baseDate.
 * target - base. Positive if target is in the future, 0 if today, negative if in the past (overdue).
 */
export function getDaysDifference(targetDateStr, baseDateStr = getTodayUtcIsoString()) {
  const target = parseIsoDate(targetDateStr);
  const base = parseIsoDate(baseDateStr);

  if (!target || !base) {
    return null;
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffTime = target.date.getTime() - base.date.getTime();
  return Math.round(diffTime / msPerDay);
}

export function isOverdue(targetDateStr, baseDateStr = getTodayUtcIsoString()) {
  const diff = getDaysDifference(targetDateStr, baseDateStr);
  return diff !== null && diff < 0;
}

/**
 * Calculates estimated billing period end given a start date and cycle.
 * Monthly: 1 month forward minus 1 day (e.g. 2026-10-01 -> 2026-10-31)
 * Quarterly: 3 months forward minus 1 day
 * Yearly: 1 year forward minus 1 day
 */
export function calculateBillingPeriodEnd(startDateStr, billingCycle) {
  const parsed = parseIsoDate(startDateStr);
  if (!parsed) {
    return null;
  }

  const { day, month, year } = parsed;
  let targetYear = year;
  let targetMonth = month; // 1-indexed

  if (billingCycle === 'yearly') {
    targetYear += 1;
  } else if (billingCycle === 'quarterly') {
    targetMonth += 3;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }
  } else {
    // monthly default
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }

  // Create date for next cycle inception, then subtract 1 day
  const nextCycleStart = new Date(Date.UTC(targetYear, targetMonth - 1, day));
  nextCycleStart.setUTCDate(nextCycleStart.getUTCDate() - 1);
  return formatIsoDate(nextCycleStart);
}
