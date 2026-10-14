import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { getPreferences } from '../api/account.js';
import { getCategories, getServices } from '../api/catalog.js';
import { getApiErrorMessage } from '../api/http.js';
import { createSubscription } from '../api/subscriptions.js';

export default function AddSubscriptionPage() {
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Mode: 'catalog' | 'custom'
  const [serviceMode, setServiceMode] = useState('catalog');

  const today = new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    billingCycle: 'monthly',
    categoryId: '',
    currencyCode: 'USD',
    customServiceName: '',
    nextRenewalDate: '',
    notes: '',
    planName: '',
    price: '',
    serviceId: '',
    startDate: today,
    status: 'active',
    trialEndDate: '',
  });

  useEffect(() => {
    Promise.all([getCategories(), getServices(), getPreferences().catch(() => null)])
      .then(([cats, svcs, prefs]) => {
        setCategories(cats);
        setServices(svcs);
        if (prefs?.preferredCurrency) {
          setFormData((prev) => ({ ...prev, currencyCode: prefs.preferredCurrency }));
        }
        if (cats.length > 0) {
          setFormData((prev) => ({ ...prev, categoryId: cats[0].id }));
        }
        if (svcs.length > 0) {
          const firstSvc = svcs[0];
          setFormData((prev) => ({
            ...prev,
            categoryId: firstSvc.defaultCategoryId || prev.categoryId,
            serviceId: firstSvc.id,
          }));
        }
      })
      .catch((err) => setError(getApiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  // When catalog service changes, auto-update category
  function handleCatalogServiceChange(e) {
    const selectedId = e.target.value;
    const selectedService = services.find((s) => s.id === selectedId);
    setFormData((prev) => ({
      ...prev,
      categoryId: selectedService?.defaultCategoryId || prev.categoryId,
      serviceId: selectedId,
    }));
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  // Quick helper to compute default renewal date
  function computeRenewalDate() {
    if (!formData.startDate) return;
    const [year, month, day] = formData.startDate.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (formData.billingCycle === 'monthly') {
      date.setUTCMonth(date.getUTCMonth() + 1);
    } else if (formData.billingCycle === 'quarterly') {
      date.setUTCMonth(date.getUTCMonth() + 3);
    } else if (formData.billingCycle === 'yearly') {
      date.setUTCFullYear(date.getUTCFullYear() + 1);
    }

    setFormData((prev) => ({
      ...prev,
      nextRenewalDate: date.toISOString().split('T')[0],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Pre-flight validation
    if (serviceMode === 'catalog' && !formData.serviceId) {
      setError('Please select a catalog service.');
      return;
    }
    if (serviceMode === 'custom' && !formData.customServiceName.trim()) {
      setError('Please enter a custom service name.');
      return;
    }
    if (!formData.categoryId) {
      setError('Please select a category.');
      return;
    }
    if (Number(formData.price) < 0 || formData.price === '') {
      setError('Price must be 0 or greater.');
      return;
    }
    if (
      (formData.status === 'active' || formData.status === 'trial') &&
      !formData.nextRenewalDate
    ) {
      setError('Next renewal date is required for active or trial subscriptions.');
      return;
    }
    if (formData.status === 'trial' && !formData.trialEndDate) {
      setError('Trial end date is required when status is trial.');
      return;
    }

    const payload = {
      billingCycle: formData.billingCycle,
      categoryId: formData.categoryId,
      currencyCode: formData.currencyCode.toUpperCase(),
      price: Number(formData.price),
      startDate: formData.startDate,
      status: formData.status,
    };

    if (serviceMode === 'catalog') {
      payload.serviceId = formData.serviceId;
    } else {
      payload.customServiceName = formData.customServiceName.trim();
    }

    if (formData.planName.trim()) {
      payload.planName = formData.planName.trim();
    }
    if (formData.nextRenewalDate) {
      payload.nextRenewalDate = formData.nextRenewalDate;
    }
    if (formData.status === 'trial' && formData.trialEndDate) {
      payload.trialEndDate = formData.trialEndDate;
    }
    if (formData.notes.trim()) {
      payload.notes = formData.notes.trim();
    }

    setSubmitting(true);
    try {
      const created = await createSubscription(payload);
      navigate(`/subscriptions/${created.id}`);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <p className="px-5 py-24 text-center text-slate-300">Loading form options…</p>;
  }

  return (
    <section className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8">
        <Link
          className="text-xs font-semibold text-slate-400 transition hover:text-emerald-300"
          to="/subscriptions"
        >
          ← Back to Subscriptions
        </Link>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
          Add New Subscription
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Enter subscription details, pricing, and renewal schedules.
        </p>
      </div>

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      <form
        className="space-y-6 rounded-3xl border border-white/10 bg-white/[0.04] p-6 sm:p-8"
        onSubmit={handleSubmit}
      >
        {/* Service Type Selection */}
        <div>
          <label className="block text-sm font-semibold text-slate-200">Service Provider</label>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                serviceMode === 'catalog'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
              onClick={() => {
                setServiceMode('catalog');
                setFormData((prev) => ({ ...prev, customServiceName: '' }));
              }}
              type="button"
            >
              Popular Catalog Service
            </button>
            <button
              className={`rounded-xl border py-2.5 text-xs font-semibold transition ${
                serviceMode === 'custom'
                  ? 'border-emerald-400 bg-emerald-400/10 text-emerald-300'
                  : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
              }`}
              onClick={() => {
                setServiceMode('custom');
                setFormData((prev) => ({ ...prev, serviceId: '' }));
              }}
              type="button"
            >
              Custom Service
            </button>
          </div>
        </div>

        {/* Catalog or Custom Input */}
        {serviceMode === 'catalog' ? (
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="serviceId">
              Select Service
            </label>
            <select
              className="form-input bg-slate-900"
              id="serviceId"
              name="serviceId"
              onChange={handleCatalogServiceChange}
              required
              value={formData.serviceId}
            >
              {services.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} {svc.categoryName ? `(${svc.categoryName})` : ''}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label
              className="block text-sm font-semibold text-slate-200"
              htmlFor="customServiceName"
            >
              Custom Service Name
            </label>
            <input
              className="form-input"
              id="customServiceName"
              maxLength={120}
              name="customServiceName"
              onChange={handleChange}
              placeholder="e.g. Local Gym, Private Newsletter, Cloud VPS"
              required
              value={formData.customServiceName}
            />
          </div>
        )}

        {/* Plan Name & Category */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="planName">
              Plan / Tier (Optional)
            </label>
            <input
              className="form-input"
              id="planName"
              maxLength={120}
              name="planName"
              onChange={handleChange}
              placeholder="e.g. Standard 4K, Pro, Family"
              value={formData.planName}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="categoryId">
              Category
            </label>
            <select
              className="form-input bg-slate-900"
              id="categoryId"
              name="categoryId"
              onChange={handleChange}
              required
              value={formData.categoryId}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Price, Currency, Billing Cycle */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="price">
              Price
            </label>
            <input
              className="form-input"
              id="price"
              min="0"
              name="price"
              onChange={handleChange}
              placeholder="0.00"
              required
              step="0.01"
              type="number"
              value={formData.price}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="currencyCode">
              Currency (ISO)
            </label>
            <input
              className="form-input uppercase"
              id="currencyCode"
              maxLength={3}
              name="currencyCode"
              onChange={handleChange}
              pattern="[A-Za-z]{3}"
              placeholder="USD"
              required
              value={formData.currencyCode}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="billingCycle">
              Billing Cycle
            </label>
            <select
              className="form-input bg-slate-900"
              id="billingCycle"
              name="billingCycle"
              onChange={handleChange}
              required
              value={formData.billingCycle}
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </div>
        </div>

        {/* Status, Start Date, Renewal Date */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="status">
              Status
            </label>
            <select
              className="form-input bg-slate-900"
              id="status"
              name="status"
              onChange={handleChange}
              required
              value={formData.status}
            >
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="paused">Paused</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="startDate">
              Start Date
            </label>
            <input
              className="form-input"
              id="startDate"
              name="startDate"
              onChange={handleChange}
              required
              type="date"
              value={formData.startDate}
            />
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                className="block text-sm font-semibold text-slate-200"
                htmlFor="nextRenewalDate"
              >
                Next Renewal
              </label>
              <button
                className="text-[11px] font-semibold text-emerald-400 hover:text-emerald-300"
                onClick={computeRenewalDate}
                type="button"
              >
                Auto-fill
              </button>
            </div>
            <input
              className="form-input"
              id="nextRenewalDate"
              min={formData.startDate}
              name="nextRenewalDate"
              onChange={handleChange}
              required={formData.status === 'active' || formData.status === 'trial'}
              type="date"
              value={formData.nextRenewalDate}
            />
          </div>
        </div>

        {/* Trial End Date (if status is trial) */}
        {formData.status === 'trial' && (
          <div>
            <label className="block text-sm font-semibold text-slate-200" htmlFor="trialEndDate">
              Trial End Date
            </label>
            <input
              className="form-input"
              id="trialEndDate"
              min={formData.startDate}
              name="trialEndDate"
              onChange={handleChange}
              required
              type="date"
              value={formData.trialEndDate}
            />
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-semibold text-slate-200" htmlFor="notes">
            Notes (Optional)
          </label>
          <textarea
            className="form-input h-24 resize-y"
            id="notes"
            maxLength={2000}
            name="notes"
            onChange={handleChange}
            placeholder="Account email, special discount notes, cancellation terms…"
            value={formData.notes}
          />
        </div>

        {/* Submit and Cancel */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Link
            className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/5 hover:text-white"
            to="/subscriptions"
          >
            Cancel
          </Link>
          <button
            className="rounded-full bg-emerald-400 px-6 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
            disabled={submitting}
            type="submit"
          >
            {submitting ? 'Creating…' : 'Create Subscription'}
          </button>
        </div>
      </form>
    </section>
  );
}
