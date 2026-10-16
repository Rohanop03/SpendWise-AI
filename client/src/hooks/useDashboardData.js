import { useCallback, useEffect, useMemo, useState } from 'react';

import { getDashboard } from '../api/dashboard.js';

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

function widgetsFrom(data, error) {
  return Object.fromEntries(
    WIDGET_NAMES.map((name) => [
      name,
      { data: data ? data[name] : null, error: error || '', loading: !data && !error },
    ]),
  );
}

function errorMessage(reason) {
  if (reason?.name === 'CanceledError' || reason?.name === 'AbortError') return '';
  return reason?.response?.data?.message || 'This dashboard section could not be loaded.';
}

/**
 * Dashboard data from GET /dashboard: one request (the server runs the widget queries in
 * parallel) instead of eight. Widget objects keep the `{ data, error, loading }` shape.
 */
export function useDashboardData({ currencyCode, enabled = true, endDate, startDate }) {
  const [state, setState] = useState({ data: null, error: '' });
  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return undefined;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setState((current) => ({ ...current, error: '' }));
    });
    getDashboard(
      {
        currencyCode: currencyCode || undefined,
        days: 30,
        endDate: endDate || undefined,
        startDate: startDate || undefined,
      },
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, error: '' });
      })
      .catch((reason) => {
        const message = errorMessage(reason);
        if (!controller.signal.aborted && message) setState({ data: null, error: message });
      });
    return () => controller.abort();
  }, [currencyCode, enabled, endDate, reloadKey, startDate]);

  const widgets = useMemo(() => widgetsFrom(state.data, state.error), [state]);
  const isLoading = !state.data && !state.error;
  const failedCount = state.error ? WIDGET_NAMES.length : 0;
  const currencyOptions = useMemo(() => {
    const codes = new Set();
    for (const row of state.data?.overview?.currencySummaries || []) codes.add(row.currencyCode);
    for (const row of state.data?.billingCycles?.billingCycles || []) codes.add(row.currencyCode);
    if (currencyCode) codes.add(currencyCode);
    return [...codes].sort();
  }, [currencyCode, state.data]);

  return {
    currencyOptions,
    failedCount,
    isLoading,
    preferences: state.data?.preferences ?? null,
    recommendations: state.data?.recommendations ?? null,
    retry,
    widgets,
  };
}
