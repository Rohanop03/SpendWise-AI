/**
 * `isoDate` plus `periods` billing cycles, clamped to the target month's last day
 * (Jan 31 + 1 month = Feb 28/29, Feb 29 + 1 year = Feb 28) — the same rule as the
 * database renewal trigger. UTC throughout, so there is no time-zone drift.
 */
export function addBillingCycle(isoDate, billingCycle, periods = 1) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return '';
  const [year, month, day] = isoDate.split('-').map(Number);
  const months = (billingCycle === 'Yearly' ? 12 : 1) * periods;
  const firstOfTarget = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0),
  ).getUTCDate();
  firstOfTarget.setUTCDate(Math.min(day, lastDay));
  return firstOfTarget.toISOString().slice(0, 10);
}

/** Auto-fill rule: start date + one billing cycle. */
export function computeRenewalDate(startDate, billingCycle) {
  return startDate ? addBillingCycle(startDate, billingCycle) : '';
}

/** Today's calendar date in the browser's time zone (YYYY-MM-DD). */
export function localToday() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
