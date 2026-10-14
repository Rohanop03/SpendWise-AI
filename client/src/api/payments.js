import http from './http.js';

export async function createPayment(subscriptionId, payload) {
  const response = await http.post(`/subscriptions/${subscriptionId}/payments`, payload);
  return response.data.payment;
}

export async function getPayments(params = {}) {
  const response = await http.get('/payments', { params });
  return response.data;
}

export async function getPayment(id) {
  const response = await http.get(`/payments/${id}`);
  return response.data.payment;
}

export async function updatePayment(id, payload) {
  const response = await http.patch(`/payments/${id}`, payload);
  return response.data.payment;
}

export async function getSubscriptionPayments(subscriptionId, params = {}) {
  const response = await http.get(`/subscriptions/${subscriptionId}/payments`, { params });
  return response.data;
}
