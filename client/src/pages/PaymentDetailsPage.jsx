import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { getPayment } from '../api/payments.js';
import { EditPaymentDialog, RefundDialog } from '../components/payments/PaymentDialogs.jsx';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState } from '../ui/Feedback.jsx';
import FlipDate from '../ui/FlipDate.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { BackLink, Pill, PillLink } from '../ui/Pill.jsx';
import { PaymentStatusChip, Tag } from '../ui/Status.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { formatCurrency } from '../utils/cost.js';
import { formatDate } from '../utils/dates.js';

/**
 * After a payment is recorded the API returns the subscription as the renewal trigger left
 * it, so the old and new renewal dates are shown without another request.
 */
function RenewalAfterPayment({ previousRenewalDate, renewalDate }) {
  const changed = renewalDate && renewalDate !== previousRenewalDate;
  return (
    <Card className="mb-6" look="pressed">
      <p className="eyebrow">Subscription renewal date</p>
      <p className="mt-2 text-2xl">
        <FlipDate value={renewalDate || previousRenewalDate} />
      </p>
      <p aria-live="polite" className="mt-2 text-sm text-(--graphite)">
        {changed
          ? `Moved forward from ${formatDate(previousRenewalDate)} by this payment.`
          : 'This payment did not move the renewal date (only completed payments on active subscriptions do).'}
      </p>
    </Card>
  );
}

export default function PaymentDetailsPage() {
  const { id } = useParams();
  const location = useLocation();
  const { notify } = useToast();
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    getPayment(id)
      .then(setPayment)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  function handleRefundSuccess(result) {
    notify(
      `Refund of ${formatCurrency(result.refund.amount, payment.currencyCode)} recorded successfully.`,
    );
    getPayment(id).then(setPayment);
  }

  function handleEditSuccess(updated) {
    setPayment((prev) => ({ ...prev, ...updated }));
    notify('Payment record updated successfully.');
  }

  if (loading) {
    return (
      <div className="neu-raised mx-auto max-w-4xl rounded-(--radius-card) p-6">
        <CardSkeleton label="payment details" lines={3} tall />
      </div>
    );
  }

  if (error || !payment) {
    return (
      <Card className="mx-auto max-w-xl">
        <EmptyState
          action={
            <PillLink icon="arrowLeft" to="/payments">
              Return to Payment History
            </PillLink>
          }
          title="Payment Record Not Found"
          titleAs="h1"
        >
          {error || 'This payment does not exist or you do not have permission to view it.'}
        </EmptyState>
      </Card>
    );
  }

  const name = payment.serviceName;
  const isCompleted = payment.paymentStatus === 'completed';
  const remainingRefundableNum = Number(payment.remainingRefundable) || 0;
  const canRefund = isCompleted && remainingRefundableNum > 0;
  const refundHint = !isCompleted
    ? 'Only completed payments can be refunded'
    : remainingRefundableNum <= 0
      ? 'Payment is fully refunded'
      : 'Record a manual refund';

  return (
    <div className="mx-auto w-full max-w-6xl">
      <BackLink to="/payments">Back to Payments</BackLink>
      <PageHeader
        actions={
          <>
            <Pill icon="edit" onClick={() => setIsEditModalOpen(true)}>
              Correct Entry
            </Pill>
            <Pill
              disabled={!canRefund}
              icon="undo"
              onClick={() => setIsRefundModalOpen(true)}
              title={refundHint}
              variant="ink"
            >
              Record Refund
            </Pill>
          </>
        }
        index={`${pageIndex('/payments')} · #${payment.id}`}
        title={name}
      >
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-(--graphite)">
          <PaymentStatusChip status={payment.paymentStatus} />
          <span>
            {payment.planName ? `${payment.planName} · ` : ''}
            {payment.categoryName || 'Subscription'} · Paid on {formatDate(payment.paymentDate)}
          </span>
        </div>
        {!canRefund && <p className="mt-2 text-xs text-(--graphite)">{refundHint}.</p>}
      </PageHeader>

      {location.state?.recorded && payment.subscriptionId && (
        <RenewalAfterPayment
          previousRenewalDate={location.state.previousRenewalDate}
          renewalDate={location.state.renewalDate}
          subscriptionId={payment.subscriptionId}
        />
      )}

      <dl className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          [
            'Recorded Amount',
            formatCurrency(payment.amount, payment.currencyCode),
            payment.currencyCode,
            'obsidian',
          ],
          [
            'Completed Refunds',
            `−${formatCurrency(payment.totalRefunded, payment.currencyCode)}`,
            `${payment.refundCount || 0} ${payment.refundCount === 1 ? 'refund' : 'refunds'}`,
            'raised',
          ],
          [
            'Net Realized',
            isCompleted ? formatCurrency(payment.netAmount, payment.currencyCode) : '—',
            isCompleted ? 'Net realized expenditure' : 'Unrealized (non-completed)',
            'raised',
          ],
          [
            'Remaining Refundable',
            isCompleted ? formatCurrency(payment.remainingRefundable, payment.currencyCode) : '—',
            'Maximum eligible refund',
            'pressed',
          ],
        ].map(([label, value, help, look], index) => (
          <Card as="div" delay={index * 0.04} key={label} look={look}>
            <dt
              className={`text-sm font-bold ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
            >
              {label}
            </dt>
            <dd className="display-num mt-2 break-words text-[clamp(1.6rem,1.2rem+1vw,2.2rem)]">
              {value}
            </dd>
            <dd
              className={`mt-1 text-xs ${look === 'obsidian' ? 'text-soft' : 'text-(--graphite)'}`}
            >
              {help}
            </dd>
          </Card>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card delay={0.1}>
          <CardHeader title="Billing Context" />
          <dl className="divide-y divide-(--hairline) text-sm">
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-(--graphite)">Subscription</dt>
              <dd>
                <Link
                  className="font-bold underline underline-offset-4"
                  to={`/subscriptions/${payment.subscriptionId}`}
                >
                  {name} →
                </Link>
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-(--graphite)">Payment Date</dt>
              <dd className="num">{payment.paymentDate}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-(--graphite)">Billing Coverage</dt>
              <dd className="num text-right">
                {payment.billingPeriodStart && payment.billingPeriodEnd
                  ? `${payment.billingPeriodStart} → ${payment.billingPeriodEnd}`
                  : 'Not recorded'}
              </dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-(--graphite)">Recorded In System</dt>
              <dd>{payment.createdAt ? new Date(payment.createdAt).toLocaleDateString() : '—'}</dd>
            </div>
          </dl>
        </Card>
        <Card delay={0.15}>
          <CardHeader title="Notes & Comments" />
          {payment.notes ? (
            <p className="whitespace-pre-wrap text-sm leading-6">{payment.notes}</p>
          ) : (
            <p className="text-sm text-(--graphite)">No notes recorded for this payment.</p>
          )}
        </Card>

        <Card className="lg:col-span-2" delay={0.1}>
          <CardHeader
            action={
              canRefund && (
                <Pill icon="plus" onClick={() => setIsRefundModalOpen(true)} size="sm">
                  Add Refund
                </Pill>
              )
            }
            description="Historical refunds manually credited against this payment."
            title="Refund History"
          />
          {payment.refunds && payment.refunds.length > 0 ? (
            <ul className="divide-y divide-(--hairline)">
              {payment.refunds.map((refund) => (
                <li
                  className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between"
                  key={refund.id}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="num font-medium">
                        −{formatCurrency(refund.amount, payment.currencyCode)}
                      </span>
                      <Tag>{refund.refundStatus}</Tag>
                    </div>
                    {refund.reason && (
                      <p className="mt-1 text-xs text-(--graphite)">{refund.reason}</p>
                    )}
                  </div>
                  <div className="text-xs text-(--graphite) sm:text-right">
                    <span>Refunded on {refund.refundDate}</span>
                    <span className="block">ID #{refund.id}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed border-(--hairline-strong) p-5 text-center text-sm text-(--graphite)">
              No refunds have been recorded for this payment.
            </p>
          )}
        </Card>
      </div>

      <RefundDialog
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSuccess={handleRefundSuccess}
        payment={payment}
      />
      <EditPaymentDialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        payment={payment}
      />
    </div>
  );
}
