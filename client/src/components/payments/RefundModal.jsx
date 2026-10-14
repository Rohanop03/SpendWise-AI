import { useState } from 'react';

import { getApiErrorMessage } from '../../api/http.js';
import { createRefund } from '../../api/refunds.js';
import { formatCurrency } from '../../utils/cost.js';

export default function RefundModal({ isOpen, onClose, onSuccess, payment }) {
  const today = new Date().toISOString().split('T')[0];
  const maxRefundable = Number(payment?.remainingRefundable) || 0;

  const [amount, setAmount] = useState(payment?.remainingRefundable || '');
  const [refundDate, setRefundDate] = useState(today);
  const [refundStatus, setRefundStatus] = useState('completed');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !payment) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError('Refund amount must be greater than zero.');
      return;
    }

    if (numericAmount > maxRefundable) {
      setError(
        `Refund amount cannot exceed remaining refundable balance of ${formatCurrency(
          maxRefundable,
          payment.currencyCode,
        )}.`,
      );
      return;
    }

    setLoading(true);
    try {
      const result = await createRefund(payment.id, {
        amount: numericAmount.toFixed(2),
        reason: reason.trim() || undefined,
        refundDate,
        refundStatus,
      });
      onSuccess(result);
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
        <h2 className="text-xl font-bold text-white">Record Manual Refund</h2>
        <p className="mt-1 text-xs text-slate-400">
          Payment ID #{payment.id} &middot; {payment.serviceName || payment.customServiceName}
        </p>

        {/* Financial Context */}
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/5 bg-slate-950/50 p-3 text-center text-xs">
          <div>
            <span className="block text-slate-500">Paid Amount</span>
            <span className="font-semibold text-white">
              {formatCurrency(payment.amount, payment.currencyCode)}
            </span>
          </div>
          <div>
            <span className="block text-slate-500">Total Refunded</span>
            <span className="font-semibold text-rose-400">
              {formatCurrency(payment.totalRefunded, payment.currencyCode)}
            </span>
          </div>
          <div>
            <span className="block text-slate-500">Max Refundable</span>
            <span className="font-semibold text-emerald-400">
              {formatCurrency(payment.remainingRefundable, payment.currencyCode)}
            </span>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-200">
          <p className="font-semibold">Provider Disclaimer</p>
          <p className="mt-0.5 text-amber-300/80">
            Recording a refund here does not transfer funds or initiate a refund with the
            subscription provider.
          </p>
        </div>

        {error && (
          <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
            {error}
          </div>
        )}

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              htmlFor="refund-amount"
            >
              Refund Amount ({payment.currencyCode})
            </label>
            <input
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
              id="refund-amount"
              max={maxRefundable}
              min="0.01"
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={amount}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="refund-date"
              >
                Refund Date
              </label>
              <input
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="refund-date"
                onChange={(e) => setRefundDate(e.target.value)}
                required
                type="date"
                value={refundDate}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="refund-status"
              >
                Status
              </label>
              <select
                className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="refund-status"
                onChange={(e) => setRefundStatus(e.target.value)}
                value={refundStatus}
              >
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              htmlFor="refund-reason"
            >
              Reason / Notes (Optional)
            </label>
            <textarea
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white focus:border-emerald-400 focus:outline-none"
              id="refund-reason"
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Overcharged, promo discount retroactive, service outage compensation"
              rows={2}
              value={reason}
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
              {loading ? 'Recording...' : 'Record Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
