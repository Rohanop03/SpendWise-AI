import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import {
  downloadReportCsv,
  getAnalyticsOverview,
  getBillingCycleAnalytics,
  getCategoryAnalytics,
  getPaymentStatusAnalytics,
  getSpendingTrends,
  getSubscriptionAnalytics,
  getTopSubscriptions,
} from '../api/analytics.js';
import AnalyticsFilters from '../components/analytics/AnalyticsFilters.jsx';
import AnalyticsOverviewCards from '../components/analytics/AnalyticsOverviewCards.jsx';
import BillingCycleDistribution from '../components/analytics/BillingCycleDistribution.jsx';
import CategorySpendingTable from '../components/analytics/CategorySpendingTable.jsx';
import MonthlyTrendTable from '../components/analytics/MonthlyTrendTable.jsx';
import PaymentStatusSummary from '../components/analytics/PaymentStatusSummary.jsx';
import SubscriptionSpendingTable from '../components/analytics/SubscriptionSpendingTable.jsx';
import TopSubscriptionsCard from '../components/analytics/TopSubscriptionsCard.jsx';

function AnalyticsPage() {
  const [currencyCode, setCurrencyCode] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availableCurrencies, setAvailableCurrencies] = useState([]);

  const [activeSection, setActiveSection] = useState('overview'); // 'overview' | 'categories' | 'subscriptions' | 'cycles'

  const [overview, setOverview] = useState([]);
  const [trends, setTrends] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [topRecurring, setTopRecurring] = useState([]);
  const [topHistorical, setTopHistorical] = useState([]);
  const [billingCycles, setBillingCycles] = useState([]);
  const [paymentStatuses, setPaymentStatuses] = useState([]);

  const [subSortBy, setSubSortBy] = useState('grossPayments');
  const [subSortOrder, setSubSortOrder] = useState('desc');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);

  function handleDateChange(newStart, newEnd) {
    setStartDate(newStart);
    setEndDate(newEnd);
  }

  function handleCurrencyChange(newCurrency) {
    setCurrencyCode(newCurrency);
  }

  function handleSubscriptionSort(column) {
    if (subSortBy === column) {
      setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSubSortBy(column);
      setSubSortOrder('desc');
    }
  }

  async function handleExportCsv() {
    setExporting(true);
    try {
      const blob = await downloadReportCsv({
        currencyCode: currencyCode || undefined,
        endDate: endDate || undefined,
        startDate: startDate || undefined,
      });

      const url = window.URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `spendwise-report-${new Date().toISOString().slice(0, 10)}.csv`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch {
      setError('Failed to export CSV report. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    let isCancelled = false;

    async function loadAnalytics() {
      setLoading(true);
      setError(null);

      const params = {
        currencyCode: currencyCode || undefined,
        endDate: endDate || undefined,
        startDate: startDate || undefined,
      };

      try {
        const [
          overviewRes,
          trendsRes,
          categoriesRes,
          subsRes,
          topRecRes,
          topHistRes,
          cyclesRes,
          statusRes,
        ] = await Promise.all([
          getAnalyticsOverview(params),
          getSpendingTrends({ ...params, interval: 'monthly' }),
          getCategoryAnalytics(params),
          getSubscriptionAnalytics({
            ...params,
            limit: 50,
            sortBy: subSortBy,
            sortOrder: subSortOrder,
          }),
          getTopSubscriptions({ ...params, limit: 5, type: 'recurring' }),
          getTopSubscriptions({ ...params, limit: 5, type: 'historical' }),
          getBillingCycleAnalytics({ currencyCode: currencyCode || undefined }),
          getPaymentStatusAnalytics(params),
        ]);

        if (isCancelled) {
          return;
        }

        setOverview(overviewRes.currencySummaries || []);
        setTrends(trendsRes.trends || []);
        setCategories(categoriesRes.categories || []);
        setSubscriptions(subsRes.subscriptions || []);
        setTopRecurring(topRecRes.subscriptions || []);
        setTopHistorical(topHistRes.subscriptions || []);
        setBillingCycles(cyclesRes.billingCycles || []);
        setPaymentStatuses(statusRes.statuses || []);

        // Populate available currencies from overview if not already selected
        if (overviewRes.currencySummaries) {
          const codes = overviewRes.currencySummaries.map((s) => s.currencyCode);
          setAvailableCurrencies((prev) => Array.from(new Set([...prev, ...codes])).sort());
        }
      } catch (err) {
        if (!isCancelled) {
          setError(
            err.response?.data?.message || 'Failed to load spending analytics. Please try again.',
          );
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadAnalytics();

    return () => {
      isCancelled = true;
    };
  }, [currencyCode, startDate, endDate, subSortBy, subSortOrder]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Spending Analytics & SQL Reporting
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Database-backed financial cash flow, category breakdowns, and recurring cost analysis
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/payments/new"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-400"
          >
            Record Payment
          </Link>
          <Link
            to="/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-slate-800 hover:text-white"
          >
            Payment History
          </Link>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="mb-6">
        <AnalyticsFilters
          availableCurrencies={availableCurrencies}
          currencyCode={currencyCode}
          endDate={endDate}
          onCurrencyChange={handleCurrencyChange}
          onDateChange={handleDateChange}
          onExportCsv={handleExportCsv}
          startDate={startDate}
        />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-300">
          {error}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading ? (
        <div className="space-y-6">
          <div className="h-44 w-full animate-pulse rounded-3xl bg-slate-900/60" />
          <div className="h-64 w-full animate-pulse rounded-3xl bg-slate-900/60" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
            {[
              { id: 'overview', label: 'Financial Overview' },
              { id: 'trends', label: 'Monthly Trends' },
              { id: 'categories', label: 'Category Expenses' },
              { id: 'subscriptions', label: 'Subscription Spending' },
              { id: 'cycles', label: 'Billing Cycles & Status' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id)}
                className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                  activeSection === tab.id
                    ? 'bg-slate-100 text-slate-950 shadow-sm'
                    : 'bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab 1: Financial Overview */}
          {activeSection === 'overview' && (
            <div className="space-y-8">
              <AnalyticsOverviewCards summaries={overview} />
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                <TopSubscriptionsCard
                  recurringSubscriptions={topRecurring}
                  historicalSubscriptions={topHistorical}
                />
                <PaymentStatusSummary statuses={paymentStatuses} />
              </div>
            </div>
          )}

          {/* Tab 2: Monthly Trends */}
          {activeSection === 'trends' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Monthly Cash Flow Trends</h2>
                  <p className="text-xs text-slate-400">
                    Realized payments on payment date minus refunds on refund date
                  </p>
                </div>
              </div>
              <MonthlyTrendTable trends={trends} />
            </div>
          )}

          {/* Tab 3: Category Expenses */}
          {activeSection === 'categories' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Category Expense Breakdown</h2>
                  <p className="text-xs text-slate-400">
                    Historical completed spending grouped by subscription category
                  </p>
                </div>
              </div>
              <CategorySpendingTable categories={categories} />
            </div>
          )}

          {/* Tab 4: Subscription Spending */}
          {activeSection === 'subscriptions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Subscription-Wise Spending</h2>
                  <p className="text-xs text-slate-400">
                    Historical realized expenditure across all subscriptions (including archived)
                  </p>
                </div>
              </div>
              <SubscriptionSpendingTable
                subscriptions={subscriptions}
                sortBy={subSortBy}
                sortOrder={subSortOrder}
                onSort={handleSubscriptionSort}
              />
            </div>
          )}

          {/* Tab 5: Billing Cycles & Status */}
          {activeSection === 'cycles' && (
            <div className="space-y-8">
              <BillingCycleDistribution billingCycles={billingCycles} />
              <PaymentStatusSummary statuses={paymentStatuses} />
            </div>
          )}
        </div>
      )}

      {/* Exporting Indicator */}
      {exporting && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-slate-900 px-4 py-3 shadow-2xl backdrop-blur">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
          <span className="text-xs font-semibold text-white">Generating CSV export...</span>
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
