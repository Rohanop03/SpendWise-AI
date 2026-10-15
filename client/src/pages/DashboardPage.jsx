import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { getPreferences } from '../api/account.js';
import BillingCycleChart from '../components/dashboard/BillingCycleChart.jsx';
import CategorySpendingChart from '../components/dashboard/CategorySpendingChart.jsx';
import DashboardEmptyState from '../components/dashboard/DashboardEmptyState.jsx';
import DashboardFilters from '../components/dashboard/DashboardFilters.jsx';
import FinancialSummaryCards from '../components/dashboard/FinancialSummaryCards.jsx';
import PaymentStatusWidget from '../components/dashboard/PaymentStatusWidget.jsx';
import RefundSummary from '../components/dashboard/RefundSummary.jsx';
import SpendingTrendChart from '../components/dashboard/SpendingTrendChart.jsx';
import TopSubscriptionsChart from '../components/dashboard/TopSubscriptionsChart.jsx';
import UpcomingRenewalsWidget from '../components/dashboard/UpcomingRenewalsWidget.jsx';
import { useDashboardData } from '../hooks/useDashboardData.js';
import { getPresetRange, normalizePreset } from '../utils/dashboardFilters.js';

const quickLinks = [
  ['/subscriptions', 'Manage subscriptions'],
  ['/payments/new', 'Record payment'],
  ['/billing', 'Review billing schedule'],
  ['/analytics', 'Open detailed analytics'],
];

export default function DashboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersReady, setFiltersReady] = useState(searchParams.has('currency'));
  const preset = normalizePreset(searchParams.get('period'));
  const currencyParameter = searchParams.get('currency');
  const currencyCode = currencyParameter === 'ALL' ? '' : currencyParameter || '';
  const presetRange = useMemo(() => getPresetRange(preset), [preset]);
  const startDate =
    preset === 'custom' ? searchParams.get('startDate') || '' : presetRange.startDate;
  const endDate = preset === 'custom' ? searchParams.get('endDate') || '' : presetRange.endDate;

  const updateSearch = useCallback(
    (updates) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  useEffect(() => {
    if (searchParams.has('currency')) return;
    let active = true;
    getPreferences()
      .then((result) => {
        if (active) updateSearch({ currency: result.preferences?.preferredCurrency || 'ALL' });
      })
      .catch(() => {
        if (active) updateSearch({ currency: 'ALL' });
      })
      .finally(() => {
        if (active) setFiltersReady(true);
      });
    return () => {
      active = false;
    };
  }, [searchParams, updateSearch]);

  const { currencyOptions, failedCount, isLoading, retry, widgets } = useDashboardData({
    currencyCode,
    enabled: filtersReady,
    endDate,
    startDate,
  });

  const hasSubscriptions = (widgets.overview.data?.currencySummaries || []).some(
    (summary) => summary.activeSubscriptionCount > 0,
  );
  const hasHistoricalActivity = (widgets.overview.data?.currencySummaries || []).some(
    (summary) =>
      Number(summary.grossPayments) !== 0 ||
      Number(summary.completedRefunds) !== 0 ||
      summary.completedPaymentCount > 0,
  );
  const showNewUserState =
    filtersReady &&
    !isLoading &&
    !widgets.overview.error &&
    !hasSubscriptions &&
    !hasHistoricalActivity;

  function selectPreset(nextPreset) {
    const updates = { endDate: '', period: nextPreset, startDate: '' };
    if (nextPreset === 'custom') {
      updates.startDate = startDate;
      updates.endDate = endDate;
    }
    updateSearch(updates);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300">
            Financial command center
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
            Dashboard
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            Understand realized cash flow, current recurring commitments, and expected renewals from
            your PostgreSQL-backed records.
          </p>
        </div>
        <Link
          className="inline-flex w-fit rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-emerald-200"
          to="/payments/new"
        >
          + Record payment
        </Link>
      </header>

      <DashboardFilters
        currencyCode={currencyCode}
        currencyOptions={currencyOptions}
        endDate={endDate}
        onCurrencyChange={(value) => updateSearch({ currency: value || 'ALL' })}
        onCustomDatesChange={(start, end) =>
          updateSearch({ endDate: end, period: 'custom', startDate: start })
        }
        onPresetChange={selectPreset}
        preset={preset}
        startDate={startDate}
      />

      {failedCount > 0 && (
        <div
          className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm text-amber-100 sm:flex-row sm:items-center sm:justify-between"
          role="status"
        >
          <p>
            {failedCount} dashboard {failedCount === 1 ? 'section' : 'sections'} could not be
            loaded. Available financial data is still shown below.
          </p>
          <button className="font-bold underline underline-offset-4" onClick={retry} type="button">
            Retry failed sections
          </button>
        </div>
      )}

      <div className="mt-6">
        <FinancialSummaryCards
          currencyCode={currencyCode}
          onRetry={retry}
          widget={widgets.overview}
        />
      </div>

      {showNewUserState ? (
        <div className="mt-6">
          <DashboardEmptyState />
        </div>
      ) : (
        <div className="mt-6 grid min-w-0 gap-6 xl:grid-cols-12">
          <div className="min-w-0 xl:col-span-8">
            <SpendingTrendChart onRetry={retry} widget={widgets.trends} />
          </div>
          <div className="min-w-0 xl:col-span-4">
            <UpcomingRenewalsWidget
              currencyCode={currencyCode}
              onRetry={retry}
              widget={widgets.renewals}
            />
          </div>
          <div className="min-w-0 xl:col-span-7">
            <CategorySpendingChart onRetry={retry} widget={widgets.categories} />
          </div>
          <div className="min-w-0 xl:col-span-5">
            <TopSubscriptionsChart
              currencyCode={currencyCode}
              onRetry={retry}
              widget={widgets.topSubscriptions}
            />
          </div>
          <div className="min-w-0 xl:col-span-6">
            <BillingCycleChart onRetry={retry} widget={widgets.billingCycles} />
          </div>
          <div className="min-w-0 xl:col-span-6">
            <PaymentStatusWidget onRetry={retry} widget={widgets.paymentStatus} />
          </div>
          <div className="min-w-0 xl:col-span-5">
            <RefundSummary onRetry={retry} widget={widgets.refunds} />
          </div>
          <section className="min-w-0 rounded-3xl border border-white/10 bg-slate-900/65 p-6 xl:col-span-7">
            <h2 className="text-lg font-bold text-white">Quick actions</h2>
            <p className="mt-1 text-sm text-slate-400">
              Move from insight to accurate record keeping.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {quickLinks.map(([to, label]) => (
                <Link
                  className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-3 text-sm font-bold text-slate-200 hover:border-emerald-300/30 hover:text-emerald-200"
                  key={to}
                  to={to}
                >
                  {label} →
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
