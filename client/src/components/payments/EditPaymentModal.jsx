import { useState } from 'react';

import { getApiErrorMessage } from '../../api/http.js';
import { updatePayment } from '../../api/payments.js';

export default function EditPaymentModal({ isOpen, onClose, onSuccess, payment }) {
  const [notes, setNotes] = useState(payment?.notes || '');
  const [billingPeriodStart, setBillingPeriodStart] = useState(payment?.billingPeriodStart || '');
  const [billingPeriodEnd, setBillingPeriodEnd] = useState(payment?.billingPeriodEnd || '');
  const [paymentStatus, setPaymentStatus] = useState(payment?.paymentStatus || 'completed');
  const [amount, setAmount] = useState(payment?.amount || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !payment) return null;

  const hasRefunds = Number(payment.totalRefunded) > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const updates = {};
    if (notes !== (payment.notes || '')) updates.notes = notes;
    if (billingPeriodStart !== (payment.billingPeriodStart || '')) {
      updates.billingPeriodStart = billingPeriodStart || null;
    }
    if (billingPeriodEnd !== (payment.billingPeriodEnd || '')) {
      updates.billingPeriodEnd = billingPeriodEnd || null;
    }
    if (paymentStatus !== payment.paymentStatus) {
      updates.paymentStatus = paymentStatus;
    }
    if (Number(amount) !== Number(payment.amount)) {
      updates.amount = Number(amount).toFixed(2);
    }

    if (Object.keys(updates).length === 0) {
      onClose();
      return;
    }

    setLoading(true);
    try {
      const updated = await updatePayment(payment.id, updates);
      onSuccess(updated);
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white">Correct Payment Entry</h2>
        <p className="mt-1 text-xs text-slate-400">
          Payment ID #{payment.id} &middot; {payment.serviceName || payment.customServiceName}
        </p>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="edit-amount"
              >
                Amount ({payment.currencyCode})
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="edit-amount"
                min="0.01"
                onChange={(e) => setAmount(e.target.value)}
                required
                step="0.01"
                type="number"
                value={amount}
              />
              {hasRefunds && (
                <p className="mt-1 text-[11px] text-amber-300">
                  Cannot be lower than refunded {payment.currencyCode} {payment.totalRefunded}.
                </p>
              )}
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="edit-status"
              >
                Status
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none disabled:opacity-50"
                disabled={hasRefunds}
                id="edit-status"
                onChange={(e) => setPaymentStatus(e.target.value)}
                value={paymentStatus}
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              {hasRefunds && (
                <p className="mt-1 text-[11px] text-slate-500">
                  Locked to completed due to active refunds.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="edit-period-start"
              >
                Billing Start
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="edit-period-start"
                onChange={(e) => setBillingPeriodStart(e.target.value)}
                type="date"
                value={billingPeriodStart}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="edit-period-end"
              >
                Billing End
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="edit-period-end"
                onChange={(e) => setBillingPeriodEnd(e.target.value)}
                type="date"
                value={billingPeriodEnd}
              />
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              htmlFor="edit-notes"
            >
              Notes
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
              id="edit-notes"
              maxLength={2000}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              value={notes}
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              className="rounded-xl border border-white/10 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/5"
              disabled={loading}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-xl bg-emerald-400 px-5 py-2 text-xs font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
              disabled={loading}
              type="submit"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
