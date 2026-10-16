import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { getSubscriptionPayments } from '../api/payments.js';
import {
  archiveSubscription,
  cancelSubscription,
  deleteSubscription,
  getSubscription,
  getSubscriptionHistory,
  markSubscriptionUsed,
  restoreSubscription,
  updateSubscription,
} from '../api/subscriptions.js';
import { localToday } from '../forms/renewal.js';
import { cancelSchema } from '../forms/schemas.js';
import { pageIndex } from '../layout/nav.js';
import { ConfirmDialog } from '../ui/Dialog.jsx';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import { Field, Input } from '../ui/Field.jsx';
import FlipDate from '../ui/FlipDate.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink, Pill, PillLink } from '../ui/Pill.jsx';
import { SubscriptionStatusChip, Tag } from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { calculateMonthlyEquivalent, formatCurrency, getBillingCycleLabel } from '../utils/cost.js';
import { daysUntil, formatDate, relativeDays } from '../utils/dates.js';

const UNUSED_THRESHOLD_DAYS = 60;
const fieldLabels = {
  billing_cycle: 'Billing cycle',
  cost: 'Cost',
  renewal_date: 'Renewal date',
  status: 'Status',
};
const valueKeys = {
  billing_cycle: 'billingCycle',
  cost: 'cost',
  renewal_date: 'renewalDate',
  status: 'status',
};

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
  const navigate = useNavigate();
  const { notify } = useToast();
  const [subscription, setSubscription] = useState(null);
  const [history, setHistory] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [confirm, setConfirm] = useState(null); // 'archive' | 'cancel' | 'delete' | null
  const [finalPayment, setFinalPayment] = useState({
    amount: '',
    includePayment: false,
    paymentDate: localToday(),
  });
  const [finalPaymentErrors, setFinalPaymentErrors] = useState({});

  // Record, change history and recent payments load in parallel (one round trip of latency).
  useEffect(() => {
    Promise.all([
      getSubscription(id),
      getSubscriptionHistory(id).catch(() => []),
      getSubscriptionPayments(id, { limit: 5 })
        .then((data) => data.items)
        .catch(() => []),
    ])
      .then(([sub, events, recentPayments]) => {
        setSubscription(sub);
        setHistory(events);
        setPayments(recentPayments);
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  const refreshHistory = () =>
    getSubscriptionHistory(id)
      .then(setHistory)
      .catch(() => {});

  async function handleReactivate() {
    setActionLoading(true);
    setError('');
    try {
      const updated = await updateSubscription(subscription.id, { status: 'Active' });
      setSubscription(updated);
      refreshHistory();
      notify('Subscription reactivated.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    const parsed = cancelSchema.safeParse(finalPayment);
    if (!parsed.success) {
      setFinalPaymentErrors(
        Object.fromEntries(parsed.error.issues.map((issue) => [issue.path[0], issue.message])),
      );
      return;
    }
    setFinalPaymentErrors({});
    setActionLoading(true);
    try {
      const result = await cancelSubscription(
        subscription.id,
        finalPayment.includePayment
          ? {
              amount: Number(finalPayment.amount).toFixed(2),
              paymentDate: finalPayment.paymentDate,
            }
          : undefined,
      );
      setSubscription(result.subscription);
      if (result.payment) setPayments((items) => [result.payment, ...items].slice(0, 5));
      refreshHistory();
      setConfirm(null);
      notify(
        result.payment
          ? `${result.subscription.serviceName} cancelled; final payment recorded.`
          : `${result.subscription.serviceName} cancelled.`,
      );
    } catch (err) {
      setFinalPaymentErrors({ form: getApiErrorMessage(err) });
    } finally {
      setActionLoading(false);
    }
  }

  // Optimistic: the date changes at once and reverts if the server refuses.
  async function handleMarkUsed() {
    const previous = subscription;
    setSubscription({ ...subscription, daysSinceLastUse: 0, lastUsedDate: localToday() });
    try {
      setSubscription(await markSubscriptionUsed(subscription.id));
      notify('Marked as used today.');
    } catch (err) {
      setSubscription(previous);
      notify('Could not record usage.', { description: getApiErrorMessage(err), tone: 'error' });
    }
  }

  async function handleArchive() {
    setActionLoading(true);
    try {
      setSubscription(await archiveSubscription(subscription.id));
      setConfirm(null);
      notify('Subscription has been archived.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRestore() {
    setActionLoading(true);
    setError('');
    try {
      setSubscription(await restoreSubscription(subscription.id));
      notify('Subscription has been restored to active list.');
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete() {
    setActionLoading(true);
    try {
      await deleteSubscription(subscription.id);
      notify(`${subscription.serviceName} deleted.`);
      navigate('/subscriptions', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err));
      setConfirm(null);
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

  const monthlyCost = calculateMonthlyEquivalent(subscription.cost, subscription.billingCycle);
  const archived = Boolean(subscription.archivedAt);
  const active = subscription.status === 'Active';
  const renewalDays = daysUntil(subscription.renewalDate);
  const unused = (subscription.daysSinceLastUse ?? -1) > UNUSED_THRESHOLD_DAYS;

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
          {unused && active && <Tag>Unused {subscription.daysSinceLastUse} days</Tag>}
          {subscription.planName && (
            <span className="text-(--graphite)">{subscription.planName}</span>
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
              {formatCurrency(subscription.cost, subscription.currencyCode)}
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
            <Row label="Renewal Date">
              <FlipDate value={subscription.renewalDate} />
              {renewalDays !== null && active && !archived && (
                <span className="block text-xs font-normal text-(--graphite)">
                  {renewalDays < 0
                    ? `passed ${Math.abs(renewalDays)} days ago`
                    : relativeDays(renewalDays)}
                </span>
              )}
            </Row>
            <Row label="Last Used">
              {subscription.lastUsedDate ? (
                <>
                  <span className="num">{formatDate(subscription.lastUsedDate)}</span>
                  <span className="block text-xs font-normal text-(--graphite)">
                    {subscription.daysSinceLastUse === 0
                      ? 'today'
                      : `${subscription.daysSinceLastUse} days ago`}
                  </span>
                </>
              ) : (
                <span className="font-normal text-(--graphite)">Not recorded</span>
              )}
            </Row>
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
          {!archived && (
            <div className="mt-4">
              <Pill icon="check" onClick={handleMarkUsed} size="sm">
                Mark as used today
              </Pill>
            </div>
          )}
        </Card>

        <Card className="lg:col-span-5" delay={0.1}>
          <CardHeader title="Categorization" />
          <dl>
            <Row label="Category">
              <Tag>{subscription.categoryName || 'Uncategorized'}</Tag>
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

        <Card className="lg:col-span-6" delay={0.1}>
          <CardHeader
            action={
              <PillLink size="sm" to={`/payments?subscriptionId=${subscription.id}`}>
                All payments
              </PillLink>
            }
            title="Recent payments"
          />
          {payments.length === 0 ? (
            <p className="text-sm text-(--graphite)">No payments recorded yet.</p>
          ) : (
            <dl>
              {payments.map((payment) => (
                <Row key={payment.id} label={formatDate(payment.paymentDate)}>
                  <span className="num">
                    {formatCurrency(payment.amount, payment.currencyCode)}
                  </span>
                  <span className="block text-xs font-normal capitalize text-(--graphite)">
                    {payment.paymentStatus}
                  </span>
                </Row>
              ))}
            </dl>
          )}
        </Card>

        <Card className="lg:col-span-6" delay={0.15}>
          <CardHeader
            description="Recorded automatically by the database whenever cost, cycle, status or renewal date changes."
            title="Change history"
          />
          {history.length === 0 ? (
            <p className="text-sm text-(--graphite)">No changes recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {history.map((event) => (
                <li className="border-b border-(--hairline) pb-3 last:border-0" key={event.id}>
                  <p className="text-xs text-(--graphite)">
                    {new Date(event.changedAt).toLocaleString()}
                  </p>
                  {event.changedFields.map((field) => (
                    <p className="text-sm" key={field}>
                      <span className="font-bold">{fieldLabels[field] || field}:</span>{' '}
                      <span className="num">
                        {String(event.oldValues[valueKeys[field]] ?? '—')}
                      </span>
                      {' → '}
                      <span className="num">
                        {String(event.newValues[valueKeys[field]] ?? '—')}
                      </span>
                    </p>
                  ))}
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="lg:col-span-12" delay={0.1} look="pressed">
          <CardHeader
            description="These actions only change this record in SpendWise. They never cancel the service with the provider."
            title="Manage this subscription"
          />
          <div className="flex flex-wrap gap-3">
            {!archived && active && (
              <Pill disabled={actionLoading} icon="close" onClick={() => setConfirm('cancel')}>
                Cancel subscription
              </Pill>
            )}
            {!archived && !active && (
              <Pill disabled={actionLoading} icon="play" onClick={handleReactivate} variant="ink">
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
            <Pill icon="trash" onClick={() => setConfirm('delete')} variant="outline">
              Delete
            </Pill>
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
        busyLabel="Cancelling…"
        confirmLabel="Cancel subscription"
        description={`${subscription.serviceName} will be marked Cancelled and stop counting toward recurring costs and reminders. Its renewal date is kept. This does not cancel it with the provider.`}
        onConfirm={handleCancel}
        onOpenChange={(open) => {
          setConfirm(open ? 'cancel' : null);
          setFinalPaymentErrors({});
        }}
        open={confirm === 'cancel'}
        title={`Cancel ${subscription.serviceName}?`}
      >
        <div className="space-y-4">
          <label className="flex items-center gap-3 text-sm font-bold">
            <input
              checked={finalPayment.includePayment}
              className="size-4"
              onChange={(event) =>
                setFinalPayment((value) => ({ ...value, includePayment: event.target.checked }))
              }
              type="checkbox"
            />
            Record a final payment
          </label>
          {finalPayment.includePayment && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                error={finalPaymentErrors.amount}
                id="finalAmount"
                label={`Amount (${subscription.currencyCode})`}
              >
                {(fieldId, describedBy, invalid) => (
                  <Input
                    aria-describedby={describedBy}
                    className="num"
                    id={fieldId}
                    inputMode="decimal"
                    invalid={invalid}
                    min="0.01"
                    onChange={(event) =>
                      setFinalPayment((value) => ({ ...value, amount: event.target.value }))
                    }
                    step="0.01"
                    type="number"
                    value={finalPayment.amount}
                  />
                )}
              </Field>
              <Field error={finalPaymentErrors.paymentDate} id="finalDate" label="Payment date">
                {(fieldId, describedBy, invalid) => (
                  <Input
                    aria-describedby={describedBy}
                    id={fieldId}
                    invalid={invalid}
                    onChange={(event) =>
                      setFinalPayment((value) => ({ ...value, paymentDate: event.target.value }))
                    }
                    type="date"
                    value={finalPayment.paymentDate}
                  />
                )}
              </Field>
            </div>
          )}
          {finalPaymentErrors.form && (
            <p className="text-sm font-bold text-(--danger,inherit)" role="alert">
              {finalPaymentErrors.form}
            </p>
          )}
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        busy={actionLoading}
        busyLabel="Deleting…"
        confirmLabel="Delete permanently"
        description={`${subscription.serviceName} and all of its payments, refunds and reminders are removed for good. Archive it instead if you might want it back.`}
        onConfirm={handleDelete}
        onOpenChange={(open) => setConfirm(open ? 'delete' : null)}
        open={confirm === 'delete'}
        title={`Delete ${subscription.serviceName}?`}
      />
    </div>
  );
}
