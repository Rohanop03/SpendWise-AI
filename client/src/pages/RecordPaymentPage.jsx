import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import { getApiErrorMessage } from '../api/http.js';
import { createPayment } from '../api/payments.js';
import { getSubscriptions } from '../api/subscriptions.js';
import { calculateEstimatedPeriodEnd, formatCurrency } from '../utils/cost.js';

export default function RecordPaymentPage() {
  const [searchParams] = useSearchParams();
  const preselectedSubId = searchParams.get('subscriptionId');

  const navigate = useNavigate();
  const today = new Date().toISOString().split('T')[0];

  const [subscriptions, setSubscriptions] = useState([]);
  const [selectedSubId, setSelectedSubId] = useState(preselectedSubId || '');
  const [amount, setAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState('USD');
  const [paymentDate, setPaymentDate] = useState(today);
  const [paymentStatus, setPaymentStatus] = useState('completed');
  const [billingPeriodStart, setBillingPeriodStart] = useState('');
  const [billingPeriodEnd, setBillingPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');

  const [loadingSubs, setLoadingSubs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Fetch active and paused subscriptions
  useEffect(() => {
    getSubscriptions({ archived: 'false', limit: 100 })
      .then((data) => {
        const items = data.items || [];
        setSubscriptions(items);
        if (preselectedSubId) {
          const match = items.find((s) => String(s.id) === String(preselectedSubId));
          if (match) {
            setSelectedSubId(String(match.id));
            setAmount(String(match.price));
            setCurrencyCode(match.currencyCode);
            const baseDate = match.nextRenewalDate || match.startDate || today;
            setBillingPeriodStart(baseDate);
            setBillingPeriodEnd(calculateEstimatedPeriodEnd(baseDate, match.billingCycle));
          }
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoadingSubs(false));
  }, [preselectedSubId, today]);

  function handleSubscriptionSelect(sub) {
    setSelectedSubId(String(sub.id));
    setAmount(String(sub.price));
    setCurrencyCode(sub.currencyCode);

    // Compute suggested billing period dates based on subscription renewal date or start date
    const baseDate = sub.nextRenewalDate || sub.startDate || today;
    setBillingPeriodStart(baseDate);
    const estimatedEnd = calculateEstimatedPeriodEnd(baseDate, sub.billingCycle);
    setBillingPeriodEnd(estimatedEnd);
  }

  function onSelectChange(e) {
    const subId = e.target.value;
    setSelectedSubId(subId);
    if (!subId) {
      setAmount('');
      setBillingPeriodStart('');
      setBillingPeriodEnd('');
      return;
    }
    const match = subscriptions.find((s) => String(s.id) === subId);
    if (match) {
      handleSubscriptionSelect(match);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!selectedSubId) {
      setError('Please select a subscription.');
      return;
    }

    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }

    if (billingPeriodStart && billingPeriodEnd && billingPeriodEnd < billingPeriodStart) {
      setError('Billing period end date must be on or after start date.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        amount: numAmount.toFixed(2),
        currencyCode: currencyCode.toUpperCase(),
        notes: notes.trim() || undefined,
        paymentDate,
        paymentStatus,
      };

      if (billingPeriodStart && billingPeriodEnd) {
        payload.billingPeriodStart = billingPeriodStart;
        payload.billingPeriodEnd = billingPeriodEnd;
      }

      const created = await createPayment(selectedSubId, payload);
      navigate(`/payments/${created.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
      setSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-10 sm:px-8">
      <div className="flex items-center justify-between">
        <Link
          className="text-xs font-semibold uppercase tracking-wider text-slate-400 transition hover:text-white"
          to="/payments"
        >
          &larr; Back to Payments
        </Link>
      </div>

      <div className="mt-4">
        <h1 className="text-3xl font-extrabold tracking-tight text-white">Record Payment</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manually log a subscription payment that occurred with your external service provider.
        </p>
      </div>

      {/* Manual Tracking Disclaimer */}
      <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-200">
        <div className="flex gap-2">
          <span className="font-bold">Manual Financial Entry:</span>
          <p className="text-emerald-300/90">
            SpendWise AI does not process cards or initiate external charges. Recorded payments
            represent historical entries you manually confirm.
          </p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
        {/* Subscription Selection */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Target Subscription
          </h2>
          <div className="mt-4">
            <label
              className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
              htmlFor="sub-select"
            >
              Select Subscription *
            </label>
            <select
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
              disabled={loadingSubs}
              id="sub-select"
              onChange={onSelectChange}
              required
              value={selectedSubId}
            >
              <option value="">
                {loadingSubs ? 'Loading your subscriptions...' : '-- Choose a subscription --'}
              </option>
              {subscriptions.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.serviceName || sub.customServiceName}
                  {sub.planName ? ` (${sub.planName})` : ''} —{' '}
                  {formatCurrency(sub.price, sub.currencyCode)} / {sub.billingCycle}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Payment Values & Currency */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Payment Details
          </h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="pay-amount"
              >
                Amount Paid *
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="pay-amount"
                min="0.01"
                onChange={(e) => setAmount(e.target.value)}
                placeholder="499.00"
                required
                step="0.01"
                type="number"
                value={amount}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Defaults to subscription price, but can be modified for historical variations.
              </p>
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="pay-currency"
              >
                Currency Code (ISO) *
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm uppercase text-white focus:border-emerald-400 focus:outline-none"
                id="pay-currency"
                maxLength={3}
                onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
                pattern="^[A-Z]{3}$"
                required
                type="text"
                value={currencyCode}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="pay-date"
              >
                Payment Date *
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="pay-date"
                onChange={(e) => setPaymentDate(e.target.value)}
                required
                type="date"
                value={paymentDate}
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="pay-status"
              >
                Recorded Status *
              </label>
              <select
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="pay-status"
                onChange={(e) => setPaymentStatus(e.target.value)}
                value={paymentStatus}
              >
                <option value="completed">Completed (Successfully paid)</option>
                <option value="pending">Pending (Unconfirmed)</option>
                <option value="failed">Failed (Declined / Unsuccessful)</option>
                <option value="cancelled">Cancelled (Voided)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Billing Period */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400">
            Billing Coverage Period
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Optional period covered by this payment (e.g. monthly billing cycle).
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="period-start"
              >
                Period Start Date
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="period-start"
                onChange={(e) => setBillingPeriodStart(e.target.value)}
                type="date"
                value={billingPeriodStart}
              />
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
                htmlFor="period-end"
              >
                Period End Date
              </label>
              <input
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
                id="period-end"
                onChange={(e) => setBillingPeriodEnd(e.target.value)}
                type="date"
                value={billingPeriodEnd}
              />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-3xl border border-white/10 bg-slate-900/50 p-6">
          <label
            className="block text-xs font-semibold uppercase tracking-wider text-slate-400"
            htmlFor="pay-notes"
          >
            Notes & Reference (Optional)
          </label>
          <textarea
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-2.5 text-sm text-white focus:border-emerald-400 focus:outline-none"
            id="pay-notes"
            maxLength={2000}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Invoice number, payment method reference, or provider confirmation receipt notes"
            rows={3}
            value={notes}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5"
            to="/payments"
          >
            Cancel
          </Link>
          <button
            className="rounded-xl bg-emerald-400 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            disabled={submitting || !selectedSubId}
            type="submit"
          >
            {submitting ? 'Recording Payment...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </section>
  );
}
