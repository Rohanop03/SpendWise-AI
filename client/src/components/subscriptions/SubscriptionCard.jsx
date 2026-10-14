import { Link } from 'react-router-dom';

import {
  calculateMonthlyEquivalent,
  formatCurrency,
  getBillingCycleLabel,
} from '../../utils/cost.js';
import SubscriptionStatusBadge from './SubscriptionStatusBadge.jsx';

export default function SubscriptionCard({ subscription }) {
  const monthlyCost = calculateMonthlyEquivalent(subscription.price, subscription.billingCycle);
  const showMonthlyEquivalent = subscription.billingCycle !== 'monthly';

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-emerald-400/30 hover:bg-white/[0.06]">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-white">{subscription.serviceName}</h3>
              {subscription.serviceWebsiteUrl && (
                <a
                  aria-label={`Visit ${subscription.serviceName} website`}
                  className="text-slate-400 hover:text-emerald-300"
                  href={subscription.serviceWebsiteUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <svg
                    aria-hidden="true"
                    className="h-3.5 w-3.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </a>
              )}
            </div>
            {subscription.planName && (
              <p className="text-xs font-medium text-slate-400">{subscription.planName}</p>
            )}
          </div>
          <SubscriptionStatusBadge
            archivedAt={subscription.archivedAt}
            status={subscription.status}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md bg-white/5 px-2.5 py-1 text-slate-300">
            {subscription.categoryName || 'Uncategorized'}
          </span>
          <span className="text-slate-400">·</span>
          <span className="text-slate-300">{getBillingCycleLabel(subscription.billingCycle)}</span>
        </div>

        <div className="mt-5 border-t border-white/5 pt-4">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-black text-white">
              {formatCurrency(subscription.price, subscription.currencyCode)}
            </span>
            {showMonthlyEquivalent && (
              <span className="text-xs text-slate-400">
                ~{formatCurrency(monthlyCost, subscription.currencyCode)}/mo
              </span>
            )}
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Next Renewal</span>
            <span className="font-medium text-slate-200">
              {subscription.nextRenewalDate || 'None'}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-end gap-2 border-t border-white/5 pt-4">
        <Link
          className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 transition hover:border-white/20 hover:text-white"
          to={`/subscriptions/${subscription.id}/edit`}
        >
          Edit
        </Link>
        <Link
          className="rounded-lg bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20"
          to={`/subscriptions/${subscription.id}`}
        >
          View Details
        </Link>
      </div>
    </div>
  );
}
