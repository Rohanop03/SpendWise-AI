import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '../../utils/cost.js';
import {
  formatCompactCurrency,
  groupByCurrency,
  toChartNumber,
} from '../../utils/chartFormatters.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function CategorySpendingChart({ widget, onRetry }) {
  const categories = widget.data?.categories || [];
  return (
    <DashboardPanel
      description="Gross completed spending is shown separately from refunds and potentially negative net cash flow."
      title="Spending by category"
    >
      {widget.loading ? (
        <WidgetLoading label="category spending" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !categories.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No category spending was recorded for this period.
        </p>
      ) : (
        <div className="space-y-7">
          {Object.entries(groupByCurrency(categories)).map(([currency, rows]) => {
            const plotted = rows.map((row) => ({
              ...row,
              grossValue: toChartNumber(row.grossPayments),
              netValue: toChartNumber(row.netCashFlow),
              refundValue: toChartNumber(row.completedRefunds),
            }));
            return (
              <div key={currency}>
                <h3 className="mb-3 text-sm font-bold text-slate-300">{currency}</h3>
                <div
                  aria-label={`${currency} category gross spending, refunds, and net cash flow chart`}
                  className="h-72 w-full min-w-0"
                  role="img"
                >
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart
                      accessibilityLayer
                      data={plotted}
                      layout="vertical"
                      margin={{ left: 12 }}
                    >
                      <CartesianGrid horizontal={false} stroke="#1e293b" strokeDasharray="3 3" />
                      <XAxis
                        stroke="#94a3b8"
                        tickFormatter={(value) => formatCompactCurrency(value, currency)}
                        type="number"
                      />
                      <YAxis dataKey="categoryName" stroke="#94a3b8" type="category" width={88} />
                      <Tooltip
                        formatter={(value, name, item) => [
                          formatCurrency(
                            name === 'Gross spending'
                              ? item.payload.grossPayments
                              : name === 'Completed refunds'
                                ? item.payload.completedRefunds
                                : item.payload.netCashFlow,
                            currency,
                          ),
                          name,
                        ]}
                      />
                      <Legend />
                      <Bar dataKey="grossValue" fill="#34d399" name="Gross spending" radius={4} />
                      <Bar
                        dataKey="refundValue"
                        fill="#fbbf24"
                        name="Completed refunds"
                        radius={4}
                      />
                      <Bar dataKey="netValue" fill="#38bdf8" name="Net cash flow" radius={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <ul className="mt-4 space-y-2" aria-label={`${currency} category values`}>
                  {rows.map((row) => (
                    <li
                      className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-950/45 px-3 py-2 text-xs"
                      key={row.categoryId}
                    >
                      <span className="font-semibold text-white">{row.categoryName}</span>
                      <span className="text-slate-300">
                        Gross {formatCurrency(row.grossPayments, currency)} · Refunds{' '}
                        {formatCurrency(row.completedRefunds, currency)} · Net{' '}
                        {formatCurrency(row.netCashFlow, currency)} · {row.percentageOfGross}% of
                        gross
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
