import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import {
  getAnalyticsOverview,
  getBillingCycleAnalytics,
  getCategoryAnalytics,
  getPaymentStatusAnalytics,
  getRefundAnalytics,
  getSpendingTrends,
  getTopSubscriptions,
} from '../api/analytics.js';
import { getUpcomingRenewals } from '../api/billing.js';

const EMPTY_WIDGET = { data: null, error: '', loading: true };
const WIDGET_NAMES = [
  'overview',
  'trends',
  'categories',
  'topSubscriptions',
  'billingCycles',
  'paymentStatus',
  'refunds',
  'renewals',
];

function initialWidgets() {
  return Object.fromEntries(WIDGET_NAMES.map((name) => [name, { ...EMPTY_WIDGET }]));
}

function errorMessage(reason) {
  if (reason?.name === 'CanceledError' || reason?.name === 'AbortError') return '';
  return reason?.response?.data?.message || 'This dashboard section could not be loaded.';
}

export function useDashboardData({ currencyCode, enabled = true, endDate, startDate }) {
  const [widgets, setWidgets] = useState(initialWidgets);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;

    const controller = new AbortController();
    const currentRequest = ++requestId.current;
    const params = {
      currencyCode: currencyCode || undefined,
      endDate: endDate || undefined,
      startDate: startDate || undefined,
    };
    const options = { signal: controller.signal };

    queueMicrotask(() => {
      if (controller.signal.aborted || currentRequest !== requestId.current) return;
      setWidgets((current) =>
        Object.fromEntries(
          WIDGET_NAMES.map((name) => [name, { ...current[name], error: '', loading: true }]),
        ),
      );
    });

    const requests = [
      // The unfiltered overview doubles as the currency inventory. Each summary remains
      // currency-isolated, while every other historical widget uses the selected currency.
      getAnalyticsOverview(
        { endDate: endDate || undefined, startDate: startDate || undefined },
        options,
      ),
      getSpendingTrends({ ...params, interval: 'monthly' }, options),
      getCategoryAnalytics(params, options),
      currencyCode
        ? getTopSubscriptions({ ...params, limit: 5, type: 'historical' }, options)
        : Promise.resolve({ subscriptions: [] }),
      getBillingCycleAnalytics({ currencyCode: currencyCode || undefined }, options),
      getPaymentStatusAnalytics(params, options),
      getRefundAnalytics({ ...params, limit: 5 }, options),
      getUpcomingRenewals({ days: 30 }, options),
    ];

    Promise.allSettled(requests).then((results) => {
      if (controller.signal.aborted || currentRequest !== requestId.current) return;

      setWidgets(
        Object.fromEntries(
          results.map((result, index) => {
            const name = WIDGET_NAMES[index];
            return [
              name,
              result.status === 'fulfilled'
                ? { data: result.value, error: '', loading: false }
                : { data: null, error: errorMessage(result.reason), loading: false },
            ];
          }),
        ),
      );
    });

    return () => controller.abort();
  }, [currencyCode, enabled, endDate, reloadKey, startDate]);

  const isLoading = WIDGET_NAMES.every((name) => widgets[name].loading);
  const failedCount = WIDGET_NAMES.filter((name) => widgets[name].error).length;
  const currencyOptions = useMemo(() => {
    const codes = new Set();
    for (const row of widgets.overview.data?.currencySummaries || []) codes.add(row.currencyCode);
    for (const row of widgets.billingCycles.data?.billingCycles || []) codes.add(row.currencyCode);
    if (currencyCode) codes.add(currencyCode);
    return [...codes].sort();
  }, [currencyCode, widgets.billingCycles.data, widgets.overview.data]);

  return { currencyOptions, failedCount, isLoading, retry, widgets };
}
