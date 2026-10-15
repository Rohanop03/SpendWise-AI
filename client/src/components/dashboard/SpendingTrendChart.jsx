import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { formatCurrency } from '../../utils/cost.js';
import {
  formatCompactCurrency,
  formatMonth,
  groupByCurrency,
  toChartNumber,
} from '../../utils/chartFormatters.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

function CashFlowTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/15 bg-slate-950 p-3 text-xs shadow-xl">
      <p className="mb-2 font-bold text-white">{formatMonth(row.period)}</p>
      <p className="text-emerald-300">
        Gross: {formatCurrency(row.grossPayments, row.currencyCode)}
      </p>
      <p className="text-amber-300">
        Refunds: {formatCurrency(row.completedRefunds, row.currencyCode)}
      </p>
      <p className={Number(row.netCashFlow) < 0 ? 'text-rose-300' : 'text-cyan-300'}>
        Net: {formatCurrency(row.netCashFlow, row.currencyCode)}
      </p>
    </div>
  );
}

export default function SpendingTrendChart({ widget, onRetry }) {
  return (
    <DashboardPanel
      description="Completed payments and completed refunds by reporting month."
      title="Monthly cash flow"
    >
      {widget.loading ? (
        <WidgetLoading label="monthly cash flow" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !widget.data?.trends?.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No completed payments or refunds were recorded for this period.
        </p>
      ) : (
        <div className="space-y-7">
          {Object.entries(groupByCurrency(widget.data.trends)).map(([currency, rows]) => {
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
                  aria-label={`${currency} monthly gross spending, refunds, and net cash flow chart`}
                  className="h-72 w-full min-w-0"
                  role="img"
                >
                  <ResponsiveContainer height="100%" width="100%">
                    <ComposedChart accessibilityLayer data={plotted} margin={{ left: 0, right: 8 }}>
                      <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="period"
                        stroke="var(--chart-axis)"
                        tickFormatter={formatMonth}
                      />
                      <YAxis
                        stroke="var(--chart-axis)"
                        tickFormatter={(value) => formatCompactCurrency(value, currency)}
                        width={72}
                      />
                      <Tooltip content={<CashFlowTooltip />} />
                      <Legend />
                      <Area
                        dataKey="grossValue"
                        fill="var(--chart-secondary)"
                        fillOpacity={0.08}
                        name="Gross payments"
                        stroke="var(--chart-secondary)"
                        type="monotone"
                      />
                      <Line
                        dataKey="refundValue"
                        dot={false}
                        name="Completed refunds"
                        stroke="var(--chart-warning)"
                        strokeWidth={2}
                        type="monotone"
                      />
                      <Line
                        dataKey="netValue"
                        name="Net cash flow"
                        stroke="var(--chart-axis)"
                        strokeWidth={3}
                        type="monotone"
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <details className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                    Accessible monthly data table
                  </summary>
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="text-slate-400">
                        <tr>
                          <th className="p-2">Month</th>
                          <th className="p-2">Gross</th>
                          <th className="p-2">Refunds</th>
                          <th className="p-2">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr className="border-t border-white/5" key={row.period}>
                            <th className="p-2 text-white">{formatMonth(row.period)}</th>
                            <td className="p-2">{formatCurrency(row.grossPayments, currency)}</td>
                            <td className="p-2">
                              {formatCurrency(row.completedRefunds, currency)}
                            </td>
                            <td className="p-2">{formatCurrency(row.netCashFlow, currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              </div>
            );
          })}
        </div>
      )}
    </DashboardPanel>
  );
}
