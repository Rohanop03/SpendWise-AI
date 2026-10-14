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
