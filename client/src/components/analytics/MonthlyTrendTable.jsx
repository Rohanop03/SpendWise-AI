import { formatCurrency } from '../../utils/cost.js';

function formatPeriodLabel(period) {
  if (/^\d{4}-\d{2}$/.test(period)) {
    const [year, month] = period.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  }
  return period;
}

function MonthlyTrendTable({ trends = [] }) {
  if (!trends || trends.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-slate-400">
        No monthly trends found for the selected period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur">
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3.5">Period</th>
            <th className="px-5 py-3.5">Currency</th>
            <th className="px-5 py-3.5 text-right">Gross Payments</th>
            <th className="px-5 py-3.5 text-right">Completed Refunds</th>
            <th className="px-5 py-3.5 text-right">Net Cash Flow</th>
            <th className="px-5 py-3.5 text-center">Completed Payments</th>
            <th className="px-5 py-3.5 text-center">Refunds</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {trends.map((row) => {
            const netNum = Number(row.netCashFlow);
            const isNegative = netNum < 0;

            return (
              <tr key={`${row.period}-${row.currencyCode}`} className="hover:bg-slate-800/40">
                <td className="px-5 py-4 font-semibold text-white">
                  {formatPeriodLabel(row.period)}
                  <span className="ml-2 text-xs font-normal text-slate-500">({row.period})</span>
                </td>
                <td className="px-5 py-4 text-xs font-medium text-slate-400">{row.currencyCode}</td>
                <td className="px-5 py-4 text-right font-medium text-white">
                  {formatCurrency(row.grossPayments, row.currencyCode)}
                </td>
                <td className="px-5 py-4 text-right font-medium text-amber-400">
                  {formatCurrency(row.completedRefunds, row.currencyCode)}
                </td>
                <td className="px-5 py-4 text-right font-semibold">
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      isNegative ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {formatCurrency(row.netCashFlow, row.currencyCode)}
                    {isNegative && (
                      <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-300">
                        Deficit
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-400">
                  {row.completedPaymentCount}
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-400">{row.refundCount}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default MonthlyTrendTable;
