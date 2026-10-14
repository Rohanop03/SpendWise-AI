import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { getPayment } from '../api/payments.js';
import EditPaymentModal from '../components/payments/EditPaymentModal.jsx';
import PaymentStatusBadge from '../components/payments/PaymentStatusBadge.jsx';
import RefundModal from '../components/payments/RefundModal.jsx';
import { formatCurrency } from '../utils/cost.js';

export default function PaymentDetailsPage() {
  const { id } = useParams();

  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [isRefundModalOpen, setIsRefundModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  useEffect(() => {
    getPayment(id)
      .then(setPayment)
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [id]);

  function handleRefundSuccess(result) {
    setNotice(
      `Refund of ${formatCurrency(result.refund.amount, payment.currencyCode)} recorded successfully.`,
    );
    // Reload payment details to reflect updated sums and new refund item
    getPayment(id).then(setPayment);
  }

  function handleEditSuccess(updated) {
    setPayment((prev) => ({ ...prev, ...updated }));
    setNotice('Payment record updated successfully.');
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent mb-4" />
        <p className="text-sm text-slate-400">Loading payment details...</p>
      </div>
    );
  }

  if (error || !payment) {
    return (
      <div className="mx-auto max-w-4xl px-5 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/10 text-2xl text-rose-400">
          !
        </div>
        <h2 className="mt-4 text-xl font-bold text-white">Payment Record Not Found</h2>
        <p className="mt-2 text-sm text-slate-400">
          {error || 'This payment does not exist or you do not have permission to view it.'}
        </p>
        <div className="mt-6">
          <Link
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
            to="/payments"
          >
            &larr; Return to Payment History
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = payment.paymentStatus === 'completed';
  const remainingRefundableNum = Number(payment.remainingRefundable) || 0;
  const canRefund = isCompleted && remainingRefundableNum > 0;

  return (
    <section className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      {/* Back and Subtitle */}
      <div className="flex items-center justify-between">
        <Link
          className="text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:text-white"
          to="/payments"
        >
          &larr; Back to Payments
        </Link>
        <span className="text-xs text-slate-500">Record ID: #{payment.id}</span>
      </div>

      {notice && (
        <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {/* Main Header Card */}
      <div className="mt-4 flex flex-col gap-6 rounded-3xl border border-white/10 bg-slate-900/60 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {payment.serviceName || payment.customServiceName}
            </h1>
            <PaymentStatusBadge status={payment.paymentStatus} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {payment.planName ? `${payment.planName} · ` : ''}
            {payment.categoryName || 'Subscription'} &middot; Paid on {payment.paymentDate}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:bg-white/5"
            onClick={() => setIsEditModalOpen(true)}
            type="button"
          >
            Correct Entry
          </button>
          <button
            className="rounded-xl bg-emerald-400 px-4 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
            disabled={!canRefund}
            onClick={() => setIsRefundModalOpen(true)}
            title={
              !isCompleted
                ? 'Only completed payments can be refunded'
                : remainingRefundableNum <= 0
                  ? 'Payment is fully refunded'
                  : 'Record a manual refund'
            }
            type="button"
          >
            Record Refund
          </button>
        </div>
      </div>

      {/* Financial Breakdown Cards */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Recorded Amount
          </span>
          <p className="mt-2 text-xl font-bold text-white sm:text-2xl">
            {formatCurrency(payment.amount, payment.currencyCode)}
          </p>
          <span className="text-[11px] text-slate-500">{payment.currencyCode}</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Completed Refunds
          </span>
          <p className="mt-2 text-xl font-bold text-rose-400 sm:text-2xl">
            -{formatCurrency(payment.totalRefunded, payment.currencyCode)}
          </p>
          <span className="text-[11px] text-slate-500">
            {payment.refundCount || 0} {payment.refundCount === 1 ? 'refund' : 'refunds'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Net Realized
          </span>
          <p className="mt-2 text-xl font-bold text-emerald-400 sm:text-2xl">
            {isCompleted ? formatCurrency(payment.netAmount, payment.currencyCode) : '—'}
          </p>
          <span className="text-[11px] text-slate-500">
            {isCompleted ? 'Net realized expenditure' : 'Unrealized (non-completed)'}
          </span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Remaining Refundable
          </span>
          <p className="mt-2 text-xl font-bold text-cyan-300 sm:text-2xl">
            {isCompleted ? formatCurrency(payment.remainingRefundable, payment.currencyCode) : '—'}
          </p>
          <span className="text-[11px] text-slate-500">Maximum eligible refund</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Billing & Subscription Metadata */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Billing Context
          </h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-400">Subscription</span>
              <Link
                className="font-medium text-emerald-400 hover:underline"
                to={`/subscriptions/${payment.subscriptionId}`}
              >
                {payment.serviceName || payment.customServiceName} &rarr;
              </Link>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Payment Date</span>
              <span className="text-white">{payment.paymentDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Billing Coverage</span>
              <span className="text-white">
                {payment.billingPeriodStart && payment.billingPeriodEnd ? (
                  `${payment.billingPeriodStart} → ${payment.billingPeriodEnd}`
                ) : (
                  <span className="text-slate-500">Not recorded</span>
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Recorded In System</span>
              <span className="text-slate-400">
                {new Date(payment.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/40 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Notes & Comments
          </h2>
          <div className="mt-4 text-sm text-slate-300">
            {payment.notes ? (
              <p className="whitespace-pre-wrap">{payment.notes}</p>
            ) : (
              <p className="italic text-slate-500">No notes recorded for this payment.</p>
            )}
          </div>
        </div>
      </div>

      {/* Associated Refund History */}
      <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/40 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Refund History</h2>
            <p className="text-xs text-slate-400">
              Historical refunds manually credited against this payment.
            </p>
          </div>
          {canRefund && (
            <button
              className="text-xs font-semibold text-emerald-400 hover:underline"
              onClick={() => setIsRefundModalOpen(true)}
              type="button"
            >
              + Add Refund
            </button>
          )}
        </div>

        <div className="mt-6">
          {payment.refunds && payment.refunds.length > 0 ? (
            <div className="divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
              {payment.refunds.map((refund) => (
                <div
                  className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between"
                  key={refund.id}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-rose-400">
                        -{formatCurrency(refund.amount, payment.currencyCode)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                        {refund.refundStatus}
                      </span>
                    </div>
                    {refund.reason && (
                      <p className="mt-1 text-xs text-slate-400">{refund.reason}</p>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 sm:text-right">
                    <span>Refunded on {refund.refundDate}</span>
                    <span className="block text-[11px] text-slate-600">ID #{refund.id}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-6 text-center text-xs italic text-slate-500">
              No refunds have been recorded for this payment.
            </p>
          )}
        </div>
      </div>

      {/* Modals */}
      <RefundModal
        isOpen={isRefundModalOpen}
        onClose={() => setIsRefundModalOpen(false)}
        onSuccess={handleRefundSuccess}
        payment={payment}
      />

      <EditPaymentModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSuccess={handleEditSuccess}
        payment={payment}
      />
    </section>
  );
}
