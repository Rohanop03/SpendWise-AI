import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';
import {
  formatCompactCurrency,
  groupByCurrency,
  toChartNumber,
} from '../../utils/chartFormatters.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function BillingCycleChart({ widget, onRetry }) {
  const cycles = widget.data?.billingCycles || [];
  return (
    <DashboardPanel
      description="Current active and trial commitments, normalized by the backend to monthly equivalents."
      title="Billing cycle commitments"
    >
      {widget.loading ? (
        <WidgetLoading label="billing cycle commitments" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !cycles.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No current active or trial subscription commitments were found.
        </p>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupByCurrency(cycles)).map(([currency, rows]) => (
            <div key={currency}>
              <h3 className="mb-3 text-sm font-bold text-slate-300">{currency}</h3>
              <div
                aria-label={`${currency} normalized monthly commitment by billing cycle chart`}
                className="h-56 w-full min-w-0"
                role="img"
              >
                <ResponsiveContainer height="100%" width="100%">
                  <BarChart
                    accessibilityLayer
                    data={rows.map((row) => ({
                      ...row,
                      cycleLabel: getBillingCycleLabel(row.billingCycle),
                      monthlyValue: toChartNumber(row.estimatedMonthlyTotal),
                    }))}
                  >
                    <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
                    <XAxis dataKey="cycleLabel" stroke="var(--chart-axis)" />
                    <YAxis
                      stroke="var(--chart-axis)"
                      tickFormatter={(value) => formatCompactCurrency(value, currency)}
                      width={72}
                    />
                    <Tooltip
                      formatter={(_value, _name, item) => [
                        formatCurrency(item.payload.estimatedMonthlyTotal, currency),
                        'Backend monthly equivalent',
                      ]}
                    />
                    <Bar
                      dataKey="monthlyValue"
                      fill="var(--chart-primary)"
                      name="Monthly equivalent"
                      radius={6}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                {rows.map((row) => (
                  <li className="rounded-xl bg-slate-950/45 p-3 text-xs" key={row.billingCycle}>
                    <strong className="block text-white">
                      {getBillingCycleLabel(row.billingCycle)}
                    </strong>
                    <span className="mt-1 block text-slate-400">
                      {row.subscriptionCount} subscriptions ·{' '}
                      {formatCurrency(row.estimatedMonthlyTotal, currency)}/month
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </DashboardPanel>
  );
}
