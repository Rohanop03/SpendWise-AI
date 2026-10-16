import { useEffect, useState } from 'react';

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
import {
  BillingCycleDistribution,
  CategoryTable,
  MonthlyTrendTable,
  OverviewCards,
  PaymentStatusSummary,
  SubscriptionSpendingTable,
  TopSubscriptionsCard,
} from '../components/analytics/Reports.jsx';
import { pageIndex } from '../layout/nav.js';
import { CardSkeleton, EmptyState, InlineError } from '../ui/Feedback.jsx';
import { Field, Input, Select } from '../ui/Field.jsx';
import { PageHeader } from '../ui/Page.jsx';
import { Pill, PillLink } from '../ui/Pill.jsx';
import Segmented from '../ui/Segmented.jsx';
import { Card, CardHeader } from '../ui/Surface.jsx';
import { useToast } from '../ui/toastContext.js';
import { useSmoothScroll } from '../ui/useSmoothScroll.js';
import { groupByCurrency } from '../utils/chartFormatters.js';
import { DASHBOARD_PERIODS, getPresetRange } from '../utils/dashboardFilters.js';
import CashFlowChart from '../viz/CashFlowChart.jsx';
import CategoryBreakdown from '../viz/CategoryBreakdown.jsx';

const sections = [
  { label: 'Financial Overview', value: 'overview' },
  { label: 'Monthly Trends', value: 'trends' },
  { label: 'Category Expenses', value: 'categories' },
  { label: 'Subscription Spending', value: 'subscriptions' },
  { label: 'Billing Cycles & Status', value: 'cycles' },
];

function SectionHeading({ description, title }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl">{title}</h2>
      <p className="mt-1 text-sm text-(--graphite)">{description}</p>
    </div>
  );
}

function AnalyticsPage() {
  useSmoothScroll(true);
  const { notify } = useToast();
  const [currencyCode, setCurrencyCode] = useState('');
  const [preset, setPreset] = useState('all_time');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [availableCurrencies, setAvailableCurrencies] = useState([]);
  const [activeSection, setActiveSection] = useState('overview');
  const [data, setData] = useState({
    billingCycles: [],
    categories: [],
    overview: [],
    paymentStatuses: [],
    subscriptions: [],
    topHistorical: [],
    topRecurring: [],
    trends: [],
  });
  const [subSortBy, setSubSortBy] = useState('grossPayments');
  const [subSortOrder, setSubSortOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  function handlePresetChange(next) {
    setPreset(next);
    if (next !== 'custom') {
      const range = getPresetRange(next);
      setStartDate(range.startDate);
      setEndDate(range.endDate);
    }
  }

  function handleSubscriptionSort(column) {
    if (subSortBy === column) setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
    else {
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
      notify('CSV report downloaded.');
    } catch {
      setError('Failed to export CSV report. Please try again.');
      notify('Failed to export CSV report.', { tone: 'error' });
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
        if (isCancelled) return;
        setData({
          billingCycles: cyclesRes.billingCycles || [],
          categories: categoriesRes.categories || [],
          overview: overviewRes.currencySummaries || [],
          paymentStatuses: statusRes.statuses || [],
          subscriptions: subsRes.subscriptions || [],
          topHistorical: topHistRes.subscriptions || [],
          topRecurring: topRecRes.subscriptions || [],
          trends: trendsRes.trends || [],
        });
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
        if (!isCancelled) setLoading(false);
      }
    }
    loadAnalytics();
    return () => {
      isCancelled = true;
    };
  }, [currencyCode, startDate, endDate, subSortBy, subSortOrder, reloadKey]);

  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <PageHeader
        actions={
          <>
            <PillLink iconRight="arrowRight" to="/payments">
              Payment History
            </PillLink>
            <PillLink icon="plus" to="/payments/new" variant="ink">
              Record Payment
            </PillLink>
          </>
        }
        description="Database-backed cash flow, category breakdowns and recurring cost analysis. Every chart sits above the exact figures."
        index={pageIndex('/analytics')}
        title="Spending analytics"
      />

      <Card className="mb-6" look="glass">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <Segmented
            label="Period"
            onChange={handlePresetChange}
            options={DASHBOARD_PERIODS.map((period) => ({ label: period.label, value: period.id }))}
            size="sm"
            value={preset}
          />
          <div className="flex flex-wrap items-end gap-3">
            {preset === 'custom' && (
              <>
                <Field className="w-40" id="start-date" label="Start Date">
                  {(id) => (
                    <Input
                      id={id}
                      onChange={(e) => setStartDate(e.target.value)}
                      type="date"
                      value={startDate}
                    />
                  )}
                </Field>
                <Field className="w-40" id="end-date" label="End Date">
                  {(id) => (
                    <Input
                      id={id}
                      onChange={(e) => setEndDate(e.target.value)}
                      type="date"
                      value={endDate}
                    />
                  )}
                </Field>
              </>
            )}
            <Field className="min-w-40" id="analytics-currency" label="Currency">
              {(id) => (
                <Select
                  id={id}
                  onChange={(e) => setCurrencyCode(e.target.value)}
                  value={currencyCode}
                >
                  <option value="">All Currencies</option>
                  {availableCurrencies.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Pill disabled={exporting} icon="download" onClick={handleExportCsv}>
              {exporting ? 'Generating CSV…' : 'Export CSV'}
            </Pill>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-6">
          <InlineError message={error} onRetry={() => setReloadKey((key) => key + 1)} />
        </div>
      )}

      <Segmented
        className="mb-6"
        label="Report section"
        labelHidden
        onChange={setActiveSection}
        options={sections}
        value={activeSection}
      />

      {loading ? (
        <Card>
          <CardSkeleton label="spending analytics" lines={3} tall />
        </Card>
      ) : (
        <div aria-live="polite">
          {activeSection === 'overview' && (
            <div className="space-y-6">
              <OverviewCards summaries={data.overview} />
              <div className="grid gap-6 lg:grid-cols-2">
                <TopSubscriptionsCard
                  historicalSubscriptions={data.topHistorical}
                  recurringSubscriptions={data.topRecurring}
                />
                <PaymentStatusSummary statuses={data.paymentStatuses} />
              </div>
            </div>
          )}

          {activeSection === 'trends' && (
            <section>
              <SectionHeading
                description="Realized payments on payment date minus refunds on refund date"
                title="Monthly Cash Flow Trends"
              />
              {data.trends.length ? (
                <div className="space-y-6">
                  {Object.entries(groupByCurrency(data.trends)).map(([currency, rows]) => (
                    <Card key={currency}>
                      <CashFlowChart currency={currency} rows={rows} withTable={false} />
                    </Card>
                  ))}
                  <MonthlyTrendTable trends={data.trends} />
                </div>
              ) : (
                <Card>
                  <EmptyState title="No monthly trends">
                    No monthly trends found for the selected period.
                  </EmptyState>
                </Card>
              )}
            </section>
          )}

          {activeSection === 'categories' && (
            <section>
              <SectionHeading
                description="Historical completed spending grouped by subscription category"
                title="Category Expense Breakdown"
              />
              {data.categories.length ? (
                <div className="grid gap-6 xl:grid-cols-[22rem_1fr]">
                  <div className="space-y-6">
                    {Object.entries(groupByCurrency(data.categories)).map(([currency, rows]) => (
                      <Card key={currency}>
                        <CardHeader as="h3" title={`${currency} share of gross`} />
                        <CategoryBreakdown currency={currency} rows={rows} showLegend={false} />
                      </Card>
                    ))}
                  </div>
                  <CategoryTable categories={data.categories} />
                </div>
              ) : (
                <Card>
                  <EmptyState title="No category spending">
                    No category spending recorded for this period.
                  </EmptyState>
                </Card>
              )}
            </section>
          )}

          {activeSection === 'subscriptions' && (
            <section>
              <SectionHeading
                description="Historical realized expenditure across all subscriptions (including archived)"
                title="Subscription-Wise Spending"
              />
              <SubscriptionSpendingTable
                onSort={handleSubscriptionSort}
                sortBy={subSortBy}
                sortOrder={subSortOrder}
                subscriptions={data.subscriptions}
              />
            </section>
          )}

          {activeSection === 'cycles' && (
            <div className="space-y-6">
              <BillingCycleDistribution billingCycles={data.billingCycles} />
              <PaymentStatusSummary statuses={data.paymentStatuses} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AnalyticsPage;
