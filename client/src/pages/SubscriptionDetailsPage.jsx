import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import {
  archiveSubscription,
  getSubscription,
  restoreSubscription,
  updateSubscription,
} from '../api/subscriptions.js';
import { pageIndex } from '../layout/nav.js';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import FlipDate from '../ui/FlipDate.jsx';
import Icon from '../ui/Icon.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink, Pill, PillLink } from '../ui/Pill.jsx';
import { SubscriptionStatusChip, Tag } from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { calculateMonthlyEquivalent, formatCurrency, getBillingCycleLabel } from '../utils/cost.js';
import { daysUntil, formatDate, relativeDays } from '../utils/dates.js';

function Row({ children, label }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-(--hairline) py-3 last:border-0">
      <dt className="text-sm text-(--graphite)">{label}</dt>
      <dd className="text-right text-sm font-bold">{children}</dd>
    </div>
  );
}

export default function SubscriptionDetailsPage() {
  const { id } = useParams();
  const { notify } = useToast();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'archive' | 'cancel' | null

  useEffect(() => {
    getSubscription(id)
      .then(setSubscription)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(newStatus) {
    if (!subscription) return;
    setActionLoading(true);
    setError('');
    try {
      const updates = { status: newStatus };
      if (newStatus === 'active' && !subscription.nextRenewalDate) {
        // Same rule as before: default to one month from today when reactivating without a date.
        const nextMonth = new Date();
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        updates.nextRenewalDate = nextMonth.toISOString().split('T')[0];
      }
      const updated = await updateSubscription(subscription.id, updates);
      setSubscription(updated);
      setConfirm(null);
      notify(`Subscription status updated to ${newStatus}.`);
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
      setConfirm(null);
      notify('Subscription has been archived.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    if (!subscription) return;
    setActionLoading(true);
    setError('');
    try {
      const updated = await restoreSubscription(subscription.id);
      setSubscription(updated);
      notify('Subscription has been restored to active list.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="neu-raised mx-auto max-w-4xl rounded-(--radius-card) p-6">
        <CardSkeleton label="subscription details" lines={3} tall />
      </div>
    );
  }

  if (error && !subscription) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          action={
            <PillLink to="/subscriptions" variant="ink">
              Back to Subscriptions
            </PillLink>
          }
          title="Subscription not found"
          titleAs="h1"
        >
          {error}
        </EmptyState>
      </Card>
    );
  }

  const monthlyCost = calculateMonthlyEquivalent(subscription.price, subscription.billingCycle);
  const archived = Boolean(subscription.archivedAt);
  const renewalDays = daysUntil(subscription.nextRenewalDate);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink to="/subscriptions">Back to Subscriptions</BackLink>
      <PageHeader
        actions={
          <>
            {!archived && (
              <PillLink
                icon="receipt"
                to={`/payments/new?subscriptionId=${subscription.id}`}
                variant="ink"
              >
                Record Payment
              </PillLink>
            )}
            {!archived && (
              <PillLink icon="edit" to={`/subscriptions/${subscription.id}/edit`}>
                Edit Details
              </PillLink>
            )}
          </>
        }
        index={pageIndex('/subscriptions')}
        title={subscription.serviceName}
      >
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SubscriptionStatusChip
            archivedAt={subscription.archivedAt}
            status={subscription.status}
          />
          {subscription.planName && (
            <span className="text-(--graphite)">{subscription.planName}</span>
          )}
          {subscription.serviceWebsiteUrl && (
            <a
              aria-label={`Open ${subscription.serviceName} website`}
              className="pill pill-ghost pill-sm"
              href={subscription.serviceWebsiteUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              Website <Icon className="size-4" name="arrowUpRight" />
            </a>
          )}
        </div>
      </PageHeader>

      {error && (
        <div className="mb-6">
          <InlineError message={error} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-5" look="obsidian">
          <p className="eyebrow !text-(--on-ink-soft)">Cost & Billing</p>
          <p className="mt-4 flex flex-wrap items-baseline gap-2">
            <span className="display-num text-[clamp(2.6rem,2rem+2vw,3.6rem)]">
              {formatCurrency(subscription.price, subscription.currencyCode)}
            </span>
            <span className="text-sm font-bold text-soft">
              / {getBillingCycleLabel(subscription.billingCycle).toLowerCase()}
            </span>
          </p>
          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-soft">Monthly Equivalent</dt>
              <dd className="num">
                ~{formatCurrency(monthlyCost, subscription.currencyCode)} / month
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-soft">Annual Run Rate</dt>
              <dd className="num">
                ~{formatCurrency(monthlyCost * 12, subscription.currencyCode)} / year
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-soft">Billing Currency</dt>
              <dd className="num">{subscription.currencyCode}</dd>
            </div>
          </dl>
        </Card>

        <Card className="lg:col-span-7" delay={0.05}>
          <CardHeader title="Timeline & Dates" />
          <dl>
            <Row label="Start Date">
              <span className="num">{formatDate(subscription.startDate)}</span>
            </Row>
            <Row label="Next Renewal Date">
              <FlipDate value={subscription.nextRenewalDate} />
              {renewalDays !== null &&
                ['active', 'trial'].includes(subscription.status) &&
                !archived && (
                  <span className="block text-xs font-normal text-(--graphite)">
                    {renewalDays < 0
                      ? `passed ${Math.abs(renewalDays)} days ago`
                      : relativeDays(renewalDays)}
                  </span>
                )}
            </Row>
            {subscription.trialEndDate && (
              <Row label="Trial End Date">
                <span className="num">{formatDate(subscription.trialEndDate)}</span>
              </Row>
            )}
            {subscription.cancelledAt && (
              <Row label="Cancelled At">
                {new Date(subscription.cancelledAt).toLocaleDateString()}
              </Row>
            )}
            {subscription.archivedAt && (
              <Row label="Archived At">
                {new Date(subscription.archivedAt).toLocaleDateString()}
              </Row>
            )}
          </dl>
        </Card>

        <Card className="lg:col-span-5" delay={0.1}>
          <CardHeader title="Categorization" />
          <dl>
            <Row label="Category">
              <Tag>{subscription.categoryName || 'Uncategorized'}</Tag>
            </Row>
            <Row label="Catalog Source">
              {subscription.serviceId ? 'Catalog Service' : 'Custom Service'}
            </Row>
            <Row label="Created At">{new Date(subscription.createdAt).toLocaleDateString()}</Row>
          </dl>
        </Card>

        <Card className="lg:col-span-7" delay={0.15}>
          <CardHeader title="Notes" />
          {subscription.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{subscription.notes}</p>
          ) : (
            <p className="text-sm text-(--graphite)">No notes recorded for this subscription.</p>
          )}
        </Card>

        <Card className="lg:col-span-12" delay={0.1} look="pressed">
          <CardHeader
            description="Status changes and archiving only change this record in SpendWise. They never cancel the service with the provider."
            title="Manage this subscription"
          />
          <div className="flex flex-wrap gap-3">
            {!archived && subscription.status === 'active' && (
              <>
                <Pill
                  disabled={actionLoading}
                  icon="pause"
                  onClick={() => handleStatusChange('paused')}
                >
                  Pause
                </Pill>
                <Pill disabled={actionLoading} icon="close" onClick={() => setConfirm('cancel')}>
                  Mark Cancelled
                </Pill>
              </>
            )}
            {!archived &&
              (subscription.status === 'paused' || subscription.status === 'cancelled') && (
                <Pill
                  disabled={actionLoading}
                  icon="play"
                  onClick={() => handleStatusChange('active')}
                  variant="ink"
                >
                  Reactivate
                </Pill>
              )}
            {!archived ? (
              <Pill icon="stack" onClick={() => setConfirm('archive')} variant="outline">
                Archive
              </Pill>
            ) : (
              <Pill disabled={actionLoading} icon="undo" onClick={handleRestore} variant="ink">
                Restore Subscription
              </Pill>
            )}
          </div>
        </Card>
      </div>

      <ConfirmDialog
        busy={actionLoading}
        busyLabel="Archiving…"
        confirmLabel="Archive Subscription"
        description={`${subscription.serviceName} moves to your archived list. It will not appear in active spending calculations or renewal reminders, but its history stays preserved and you can restore it at any time.`}
        onConfirm={handleArchive}
        onOpenChange={(open) => setConfirm(open ? 'archive' : null)}
        open={confirm === 'archive'}
        title={`Archive ${subscription.serviceName}?`}
      />
      <ConfirmDialog
        busy={actionLoading}
        busyLabel="Updating…"
        confirmLabel="Mark as cancelled"
        description={`${subscription.serviceName} will be marked cancelled in SpendWise and stop counting toward recurring costs and reminders. This does not cancel it with the provider — do that with them directly.`}
        onConfirm={() => handleStatusChange('cancelled')}
        onOpenChange={(open) => setConfirm(open ? 'cancel' : null)}
        open={confirm === 'cancel'}
        title={`Mark ${subscription.serviceName} as cancelled?`}
      />
    </div>
  );
}
