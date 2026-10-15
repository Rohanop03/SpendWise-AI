import http from './http.js';

export async function getAnalyticsOverview(params = {}, options = {}) {
  const response = await http.get('/analytics/overview', { params, ...options });
  return response.data;
}

export async function getSpendingTrends(params = {}, options = {}) {
  const response = await http.get('/analytics/trends', { params, ...options });
  return response.data;
}

export async function getCategoryAnalytics(params = {}, options = {}) {
  const response = await http.get('/analytics/categories', { params, ...options });
  return response.data;
}

export async function getSubscriptionAnalytics(params = {}, options = {}) {
  const response = await http.get('/analytics/subscriptions', { params, ...options });
  return response.data;
}

export async function getTopSubscriptions(params = {}, options = {}) {
  const response = await http.get('/analytics/top-subscriptions', { params, ...options });
  return response.data;
}

export async function getBillingCycleAnalytics(params = {}, options = {}) {
  const response = await http.get('/analytics/billing-cycles', { params, ...options });
  return response.data;
}

export async function getPaymentStatusAnalytics(params = {}, options = {}) {
  const response = await http.get('/analytics/payment-status', { params, ...options });
  return response.data;
}

export async function getRefundAnalytics(params = {}, options = {}) {
  const response = await http.get('/analytics/refunds', { params, ...options });
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
