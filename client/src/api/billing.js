import http from './http.js';

export async function getBillingOverview(params = {}) {
  const response = await http.get('/billing/overview', { params });
  return response.data;
}

export async function getUpcomingRenewals(params = {}) {
  const response = await http.get('/billing/upcoming', { params });
  return response.data;
}
