import http from './http.js';

export async function getBillingOverview(params = {}) {
  const response = await http.get('/billing/overview', { params });
  return response.data;
}

export async function getUpcomingRenewals(params = {}, options = {}) {
  const response = await http.get('/billing/upcoming', { params, ...options });
  return response.data;
}
