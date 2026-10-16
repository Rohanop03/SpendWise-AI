/** Same auto-fill rule as before: start date + one billing cycle (UTC, no time-zone drift). */
export function computeRenewalDate(startDate, billingCycle) {
  if (!startDate) return '';
  const [year, month, day] = startDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (billingCycle === 'monthly') date.setUTCMonth(date.getUTCMonth() + 1);
  else if (billingCycle === 'quarterly') date.setUTCMonth(date.getUTCMonth() + 3);
  else if (billingCycle === 'yearly') date.setUTCFullYear(date.getUTCFullYear() + 1);
  return date.toISOString().split('T')[0];
}
