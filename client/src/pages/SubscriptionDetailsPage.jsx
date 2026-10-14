import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import {
  archiveSubscription,
  getSubscription,
  restoreSubscription,
  updateSubscription,
} from '../api/subscriptions.js';
import ConfirmArchiveModal from '../components/subscriptions/ConfirmArchiveModal.jsx';
import SubscriptionStatusBadge from '../components/subscriptions/SubscriptionStatusBadge.jsx';
import { calculateMonthlyEquivalent, formatCurrency, getBillingCycleLabel } from '../utils/cost.js';

export default function SubscriptionDetailsPage() {
  const { id } = useParams();

  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  useEffect(() => {
    getSubscription(id)
      .then(setSubscription)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(newStatus) {
    if (!subscription) return;
    setActionLoading(true);
    setNotice('');
    setError('');

    try {
      const updates = { status: newStatus };
      if (newStatus === 'active' && !subscription.nextRenewalDate) {
        // default to 1 month from now if reactivating without a renewal date
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        updates.nextRenewalDate = nextMonth.toISOString().split('T')[0];
      }

      const updated = await updateSubscription(subscription.id, updates);
      setSubscription(updated);
      setNotice(`Subscription status updated to ${newStatus}.`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleArchive() {
    if (!subscription) return;
    setActionLoading(true);
    try {
      const updated = await archiveSubscription(subscription.id);
      setSubscription(updated);
      setIsArchiveModalOpen(false);
      setNotice('Subscription has been archived.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    if (!subscription) return;
    setActionLoading(true);
    setNotice('');
    setError('');
    try {
      const updated = await restoreSubscription(subscription.id);
      setSubscription(updated);
      setNotice('Subscription has been restored to active list.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <p className="px-5 py-24 text-center text-slate-300">Loading subscription details…</p>;
  }

  if (error && !subscription) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-20 text-center">
        <h2 className="text-2xl font-bold text-white">Subscription not found</h2>
        <p className="mt-2 text-sm text-slate-400">{error}</p>
        <div className="mt-6">
          <Link
            className="rounded-full bg-emerald-400 px-5 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300"
            to="/subscriptions"
          >
            Back to Subscriptions
          </Link>
        </div>
      </div>
    );
  }

  const monthlyCost = calculateMonthlyEquivalent(subscription.price, subscription.billingCycle);

  return (
    <section className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      {/* Navigation Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            className="text-xs font-semibold text-slate-400 transition hover:text-emerald-300"
            to="/subscriptions"
          >
            ← Back to Subscriptions
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              {subscription.serviceName}
            </h1>
            {subscription.serviceWebsiteUrl && (
              <a
                aria-label={`Open ${subscription.serviceName} website`}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-400 hover:text-emerald-300"
                href={subscription.serviceWebsiteUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
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
            <SubscriptionStatusBadge
              archivedAt={subscription.archivedAt}
              status={subscription.status}
            />
          </div>
          {subscription.planName && (
            <p className="mt-1 text-base text-slate-300">{subscription.planName}</p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {!subscription.archivedAt && (
            <Link
              className="rounded-xl border border-white/15 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/30 hover:bg-white/5"
              to={`/subscriptions/${subscription.id}/edit`}
            >
              Edit Details
            </Link>
          )}

          {/* Status Quick-Actions */}
          {!subscription.archivedAt && (
            <>
              {subscription.status === 'active' && (
                <>
                  <button
                    className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50"
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('paused')}
                    type="button"
                  >
                    Pause
                  </button>
                  <button
                    className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-50"
                    disabled={actionLoading}
                    onClick={() => handleStatusChange('cancelled')}
                    type="button"
                  >
                    Mark Cancelled
                  </button>
                </>
              )}
              {subscription.status === 'paused' && (
                <button
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('active')}
                  type="button"
                >
                  Reactivate
                </button>
              )}
              {subscription.status === 'cancelled' && (
                <button
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
                  disabled={actionLoading}
                  onClick={() => handleStatusChange('active')}
                  type="button"
                >
                  Reactivate
                </button>
              )}
            </>
          )}

          {/* Archival Actions */}
          {!subscription.archivedAt ? (
            <button
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-400 transition hover:border-slate-600 hover:text-white"
              onClick={() => setIsArchiveModalOpen(true)}
              type="button"
            >
              Archive
            </button>
          ) : (
            <button
              className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
              disabled={actionLoading}
              onClick={handleRestore}
              type="button"
            >
              Restore Subscription
            </button>
          )}
        </div>
      </div>

      {/* Notices & Errors */}
      {notice && (
        <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Detail Cards Grid */}
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {/* Cost & Cycle Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Cost & Billing
          </h2>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-4xl font-black text-white">
              {formatCurrency(subscription.price, subscription.currencyCode)}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              / {getBillingCycleLabel(subscription.billingCycle).toLowerCase()}
            </span>
          </div>

          <div className="mt-6 space-y-3 border-t border-white/5 pt-4 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Monthly Equivalent</span>
              <span className="font-semibold text-emerald-300">
                ~{formatCurrency(monthlyCost, subscription.currencyCode)} / month
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Annual Run Rate</span>
              <span className="font-semibold text-white">
                ~{formatCurrency(monthlyCost * 12, subscription.currencyCode)} / year
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Billing Currency</span>
              <span className="font-semibold text-white">{subscription.currencyCode}</span>
            </div>
          </div>
        </div>

        {/* Schedule & Renewal Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Timeline & Dates
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Start Date</span>
              <span className="font-semibold text-white">{subscription.startDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Next Renewal Date</span>
              <span className="font-semibold text-emerald-300">
                {subscription.nextRenewalDate || 'None'}
              </span>
            </div>
            {subscription.trialEndDate && (
              <div className="flex justify-between">
                <span className="text-slate-400">Trial End Date</span>
                <span className="font-semibold text-cyan-300">{subscription.trialEndDate}</span>
              </div>
            )}
            {subscription.cancelledAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Cancelled At</span>
                <span className="font-semibold text-rose-300">
                  {new Date(subscription.cancelledAt).toLocaleDateString()}
                </span>
              </div>
            )}
            {subscription.archivedAt && (
              <div className="flex justify-between">
                <span className="text-slate-400">Archived At</span>
                <span className="font-semibold text-slate-400">
                  {new Date(subscription.archivedAt).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Metadata & Service Source Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Categorization
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Category</span>
              <span className="font-semibold text-white">
                {subscription.categoryName || 'Uncategorized'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Catalog Source</span>
              <span className="font-semibold text-white">
                {subscription.serviceId ? 'Catalog Service' : 'Custom Service'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Created At</span>
              <span className="text-slate-300">
                {new Date(subscription.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Notes Card */}
        <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">Notes</h2>
          <div className="mt-4 text-sm text-slate-300">
            {subscription.notes ? (
              <p className="whitespace-pre-wrap">{subscription.notes}</p>
            ) : (
              <p className="italic text-slate-500">No notes recorded for this subscription.</p>
            )}
          </div>
        </div>
      </div>

      <ConfirmArchiveModal
        isOpen={isArchiveModalOpen}
        isSubmitting={actionLoading}
        onClose={() => setIsArchiveModalOpen(false)}
        onConfirm={handleArchive}
        subscription={subscription}
      />
    </section>
  );
}
