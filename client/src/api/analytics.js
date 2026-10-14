import http from './http.js';

export async function getAnalyticsOverview(params = {}) {
  const response = await http.get('/analytics/overview', { params });
  return response.data;
}

export async function getSpendingTrends(params = {}) {
  const response = await http.get('/analytics/trends', { params });
  return response.data;
}

export async function getCategoryAnalytics(params = {}) {
  const response = await http.get('/analytics/categories', { params });
  return response.data;
}

export async function getSubscriptionAnalytics(params = {}) {
  const response = await http.get('/analytics/subscriptions', { params });
  return response.data;
}

export async function getTopSubscriptions(params = {}) {
  const response = await http.get('/analytics/top-subscriptions', { params });
  return response.data;
}

export async function getBillingCycleAnalytics(params = {}) {
  const response = await http.get('/analytics/billing-cycles', { params });
  return response.data;
}

export async function getPaymentStatusAnalytics(params = {}) {
  const response = await http.get('/analytics/payment-status', { params });
  return response.data;
}

export async function getRefundAnalytics(params = {}) {
  const response = await http.get('/analytics/refunds', { params });
  return response.data;
}

export async function getFinancialReport(params = {}) {
  const response = await http.get('/analytics/report', { params });
  return response.data;
}

export async function downloadReportCsv(params = {}) {
  const response = await http.get('/analytics/report/export', {
    params,
    responseType: 'blob',
  });
  return response.data;
}
