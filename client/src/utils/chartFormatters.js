import { formatCurrency } from './cost.js';

const MAX_SAFE_CHART_AMOUNT = Number.MAX_SAFE_INTEGER / 100;

export function toChartNumber(decimalValue) {
  const value = Number(decimalValue);
  return Number.isFinite(value) && Math.abs(value) <= MAX_SAFE_CHART_AMOUNT ? value : null;
}

export function formatCompactCurrency(value, currencyCode) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '';

  try {
    return new Intl.NumberFormat('en-IN', {
      currency: currencyCode,
      maximumFractionDigits: 1,
      notation: 'compact',
      style: 'currency',
    }).format(numeric);
  } catch {
    return formatCurrency(numeric, currencyCode);
  }
}

export function formatMonth(period) {
  if (!/^\d{4}-\d{2}$/.test(period)) return period;
  const [year, month] = period.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'short',
    year: '2-digit',
  });
}

export function groupByCurrency(rows = []) {
  return rows.reduce((groups, row) => {
    const code = row.currencyCode || 'Unknown';
    if (!groups[code]) groups[code] = [];
    groups[code].push(row);
    return groups;
  }, {});
}
