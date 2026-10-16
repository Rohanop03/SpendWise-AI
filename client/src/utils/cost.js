import { addBillingCycle } from '../forms/renewal.js';

export const BILLING_CYCLES = ['Monthly', 'Yearly'];

export function calculateMonthlyEquivalent(cost, billingCycle) {
  const numericCost = Number(cost);
  if (!Number.isFinite(numericCost) || numericCost <= 0) {
    return 0;
  }

  return billingCycle === 'Yearly' ? numericCost / 12 : numericCost;
}

export function formatCurrency(amount, currencyCode = 'USD') {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  try {
    return new Intl.NumberFormat('en-IN', {
      currency: currencyCode,
      currencyDisplay: 'symbol',
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
      style: 'currency',
    }).format(safeAmount);
  } catch {
    return `${currencyCode} ${safeAmount.toFixed(2)}`;
  }
}

export function getBillingCycleLabel(billingCycle) {
  return billingCycle === 'Yearly' ? 'Yearly' : 'Monthly';
}

/** Last day covered by a payment made on `startDateStr` (one cycle later, minus a day). */
export function calculateEstimatedPeriodEnd(startDateStr, billingCycle) {
  const nextCycle = addBillingCycle(startDateStr, billingCycle);
  if (!nextCycle) return '';
  const date = new Date(`${nextCycle}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}
