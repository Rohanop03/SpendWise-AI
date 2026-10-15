import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import { formatCurrency } from '../../utils/cost.js';
import { formatCompactCurrency, toChartNumber } from '../../utils/chartFormatters.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function TopSubscriptionsChart({ currencyCode, widget, onRetry }) {
  const subscriptions = widget.data?.subscriptions || [];
  return (
    <DashboardPanel
      description="Backend-ranked historical gross completed payments for the selected period."
      title="Top subscriptions by historical spend"
    >
      {!currencyCode ? (
        <p className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-5 text-sm text-cyan-100">
          Select one currency to compare subscription rankings without mixing monetary units.
        </p>
      ) : widget.loading ? (
        <WidgetLoading label="top subscriptions" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !subscriptions.length ? (
        <p className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          No completed subscription payments are available for this selection.
        </p>
      ) : (
        <>
          <div
            aria-label={`${currencyCode} highest historical subscription spending chart`}
            className="h-64 w-full min-w-0"
            role="img"
          >
            <ResponsiveContainer height="100%" width="100%">
              <BarChart
                accessibilityLayer
                data={subscriptions.map((item, index) => ({
                  ...item,
                  rank: index + 1,
                  spendValue: toChartNumber(item.grossPayments),
                }))}
                layout="vertical"
                margin={{ left: 12 }}
              >
                <CartesianGrid
                  horizontal={false}
                  stroke="var(--chart-grid)"
                  strokeDasharray="3 3"
                />
                <XAxis
                  stroke="var(--chart-axis)"
                  tickFormatter={(value) => formatCompactCurrency(value, currencyCode)}
                  type="number"
                />
                <YAxis
                  dataKey="serviceName"
                  stroke="var(--chart-axis)"
                  type="category"
                  width={92}
                />
                <Tooltip
                  formatter={(_value, _name, item) => [
                    formatCurrency(item.payload.grossPayments, currencyCode),
                    'Historical gross spending',
                  ]}
                />
                <Bar
                  dataKey="spendValue"
                  fill="var(--chart-primary)"
                  name="Historical gross spending"
                  radius={5}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ol className="mt-4 space-y-2">
            {subscriptions.map((subscription, index) => (
              <li
                className="flex items-center gap-3 rounded-xl bg-slate-950/45 p-3"
                key={subscription.subscriptionId}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-indigo-400/15 text-xs font-black text-indigo-200">
                  {index + 1}
                </span>
                <Link
                  className="min-w-0 flex-1 truncate font-semibold text-white hover:text-emerald-300"
                  title={subscription.serviceName}
                  to={`/subscriptions/${subscription.subscriptionId}`}
                >
                  {subscription.serviceName}
                </Link>
                <span className="text-sm font-bold text-indigo-200">
                  {formatCurrency(subscription.grossPayments, subscription.currencyCode)}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </DashboardPanel>
  );
}
