import { useState } from 'react';
import { Link } from 'react-router-dom';

import { formatCurrency, getBillingCycleLabel } from '../../utils/cost.js';

function TopSubscriptionsCard({ historicalSubscriptions = [], recurringSubscriptions = [] }) {
  const [activeTab, setActiveTab] = useState('recurring');

  const list = activeTab === 'recurring' ? recurringSubscriptions : historicalSubscriptions;

  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-6 backdrop-blur">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-white">Top Expensive Subscriptions</h3>
          <p className="text-xs text-slate-400">
            {activeTab === 'recurring'
              ? 'Ranked by normalized monthly recurring equivalent (Active & Trial)'
              : 'Ranked by total historical gross payments recorded in period'}
          </p>
        </div>

        <div className="inline-flex rounded-full bg-slate-950 p-1 border border-white/5">
          <button
            type="button"
            onClick={() => setActiveTab('recurring')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'recurring'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Recurring Cost
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('historical')}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              activeTab === 'historical'
                ? 'bg-emerald-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Historical Total
          </button>
        </div>
      </div>

      {!list || list.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 p-6 text-center text-xs text-slate-400">
          No subscription rankings available.
        </div>
      ) : (
        <div className="space-y-3">
          {list.map((sub, idx) => (
            <div
              key={sub.subscriptionId}
              className="flex items-center justify-between rounded-2xl border border-white/5 bg-slate-950/40 p-3.5 hover:bg-slate-800/30 transition"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-300">
                  {idx + 1}
                </span>
                <div>
                  <Link
                    to={`/subscriptions/${sub.subscriptionId}`}
                    className="text-sm font-semibold text-white hover:text-emerald-400"
                  >
                    {sub.serviceName}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span>{sub.categoryName}</span>
                    <span>•</span>
                    <span>{getBillingCycleLabel(sub.billingCycle)}</span>
                  </div>
                </div>
              </div>

              <div className="text-right">
                {activeTab === 'recurring' ? (
                  <>
                    <span className="block text-sm font-bold text-emerald-400">
                      {formatCurrency(sub.normalizedMonthlyCost, sub.currencyCode)}
                      <span className="text-[11px] font-normal text-slate-400">/mo</span>
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      Plan: {formatCurrency(sub.currentPrice, sub.currencyCode)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="block text-sm font-bold text-white">
                      {formatCurrency(sub.grossPayments, sub.currencyCode)}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {sub.completedPaymentCount} payments
                    </span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TopSubscriptionsCard;
