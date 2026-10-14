export function calculateMonthlyEquivalent(price, billingCycle) {
  const numericPrice = Number(price);
  if (!Number.isFinite(numericPrice) || numericPrice <= 0) {
    return 0;
  }

  switch (billingCycle) {
    case 'yearly':
      return numericPrice / 12;
    case 'quarterly':
      return numericPrice / 3;
    case 'monthly':
    default:
      return numericPrice;
  }
}

export function formatCurrency(amount, currencyCode = 'USD') {
  const numericAmount = Number(amount);
  const safeAmount = Number.isFinite(numericAmount) ? numericAmount : 0;

  try {
    return new Intl.NumberFormat('en-US', {
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
  switch (billingCycle) {
    case 'yearly':
      return 'Yearly';
    case 'quarterly':
      return 'Quarterly';
    case 'monthly':
    default:
      return 'Monthly';
  }
}

export function calculateEstimatedPeriodEnd(startDateStr, billingCycle) {
  if (!startDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
    return '';
  }

  const [year, month, day] = startDateStr.split('-').map(Number);
  let targetYear = year;
  let targetMonth = month;

  if (billingCycle === 'yearly') {
    targetYear += 1;
  } else if (billingCycle === 'quarterly') {
    targetMonth += 3;
    while (targetMonth > 12) {
      targetMonth -= 12;
      targetYear += 1;
    }
  } else {
    targetMonth += 1;
    if (targetMonth > 12) {
      targetMonth = 1;
      targetYear += 1;
    }
  }

  const nextCycle = new Date(Date.UTC(targetYear, targetMonth - 1, day));
  nextCycle.setUTCDate(nextCycle.getUTCDate() - 1);

  const y = nextCycle.getUTCFullYear();
  const m = String(nextCycle.getUTCMonth() + 1).padStart(2, '0');
  const d = String(nextCycle.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
