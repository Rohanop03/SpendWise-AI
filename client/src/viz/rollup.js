const toCents = (value) => Math.round(Number(value || 0) * 100);
const fromCents = (cents) => (cents / 100).toFixed(2);

/** Client-side yearly roll-up of the backend's monthly rows (integer cents, no float drift). */
export function rollUpYearly(rows) {
  const years = new Map();
  for (const row of rows) {
    const year = row.period.slice(0, 4);
    const entry = years.get(year) || {
      completedRefunds: 0,
      currencyCode: row.currencyCode,
      grossPayments: 0,
      netCashFlow: 0,
      period: year,
    };
    entry.grossPayments += toCents(row.grossPayments);
    entry.completedRefunds += toCents(row.completedRefunds);
    entry.netCashFlow += toCents(row.netCashFlow);
    years.set(year, entry);
  }
  return [...years.values()].map((entry) => ({
    ...entry,
    completedRefunds: fromCents(entry.completedRefunds),
    grossPayments: fromCents(entry.grossPayments),
    netCashFlow: fromCents(entry.netCashFlow),
  }));
}
