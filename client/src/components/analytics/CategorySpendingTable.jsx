import { formatCurrency } from '../../utils/cost.js';

function CategorySpendingTable({ categories = [] }) {
  if (!categories || categories.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/30 p-8 text-center text-slate-400">
        No category spending recorded for this period.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur">
      <table className="w-full text-left text-sm text-slate-200">
        <thead className="border-b border-white/10 bg-slate-950/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
          <tr>
            <th className="px-5 py-3.5">Category</th>
            <th className="px-5 py-3.5">Currency</th>
            <th className="px-5 py-3.5 text-right">Gross Payments</th>
            <th className="px-5 py-3.5 text-right">Refunds</th>
            <th className="px-5 py-3.5 text-right">Net Cash Flow</th>
            <th className="px-5 py-3.5 text-center">Payments</th>
            <th className="px-5 py-3.5 text-right">% of Spending</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {categories.map((cat) => {
            const netNum = Number(cat.netCashFlow);
            const isNegative = netNum < 0;

            return (
              <tr key={`${cat.categoryId}-${cat.currencyCode}`} className="hover:bg-slate-800/40">
                <td className="px-5 py-4 font-semibold text-white">{cat.categoryName}</td>
                <td className="px-5 py-4 text-xs font-medium text-slate-400">{cat.currencyCode}</td>
                <td className="px-5 py-4 text-right font-medium text-white">
                  {formatCurrency(cat.grossPayments, cat.currencyCode)}
                </td>
                <td className="px-5 py-4 text-right font-medium text-amber-400">
                  {formatCurrency(cat.completedRefunds, cat.currencyCode)}
                </td>
                <td
                  className={`px-5 py-4 text-right font-semibold ${
                    isNegative ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(cat.netCashFlow, cat.currencyCode)}
                </td>
                <td className="px-5 py-4 text-center text-xs text-slate-400">
                  {cat.completedPaymentCount}
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-2 w-16 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(100, Math.max(0, cat.percentageOfGross))}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-slate-300">
                      {cat.percentageOfGross}%
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default CategorySpendingTable;
