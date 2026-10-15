import { Link } from 'react-router-dom';

import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';
import { DashboardPanel, WidgetError, WidgetLoading } from './DashboardPanel.jsx';

export default function UpcomingRenewalsWidget({ currencyCode, widget, onRetry }) {
  const renewals = (widget.data?.items || []).filter(
    (item) => !currencyCode || item.currencyCode === currencyCode,
  );
  return (
    <DashboardPanel
      description="Expected obligations within 30 days, plus overdue dates whose payment outcome is unconfirmed."
      title="Upcoming renewals"
    >
      {widget.loading ? (
        <WidgetLoading label="upcoming renewals" />
      ) : widget.error ? (
        <WidgetError message={widget.error} onRetry={onRetry} />
      ) : !renewals.length ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-sm text-slate-400">
          <p>No active or trial subscriptions renew within the next 30 days.</p>
          <Link className="mt-3 inline-flex font-bold text-emerald-300" to="/subscriptions/new">
            Add a subscription →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {renewals.slice(0, 5).map((item) => (
            <article
              className="rounded-2xl border border-white/5 bg-slate-950/45 p-4"
              key={item.subscriptionId}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    className="block truncate font-bold text-white hover:text-emerald-300"
                    to={`/subscriptions/${item.subscriptionId}`}
                  >
                    {item.serviceName}
                  </Link>
                  <p className="mt-1 text-xs text-slate-400">
                    {getBillingCycleLabel(item.billingCycle)} · {item.status}
                  </p>
                </div>
                <p className="shrink-0 text-right text-sm font-bold text-white">
                  {formatCurrency(item.price, item.currencyCode)}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <time className="text-slate-300" dateTime={item.nextRenewalDate}>
                  {item.nextRenewalDate}
                </time>
                <span className={item.isOverdue ? 'font-bold text-rose-300' : 'text-emerald-300'}>
                  {item.isOverdue
                    ? `Date passed by ${Math.abs(item.daysUntilRenewal)} days — unconfirmed`
                    : item.daysUntilRenewal === 0
                      ? 'Expected today'
                      : `Expected in ${item.daysUntilRenewal} days`}
                </span>
              </div>
            </article>
          ))}
          <Link
            className="inline-flex text-sm font-bold text-emerald-300 hover:text-emerald-200"
            to="/billing"
          >
            Open full billing schedule →
          </Link>
        </div>
      )}
    </DashboardPanel>
  );
}
