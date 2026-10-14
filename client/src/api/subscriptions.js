import http from './http.js';

export async function createSubscription(payload) {
  const response = await http.post('/subscriptions', payload);
  return response.data.subscription;
}

export async function getSubscriptions(params = {}) {
  const response = await http.get('/subscriptions', { params });
  return response.data;
}

export async function getSubscription(id) {
  const response = await http.get(`/subscriptions/${id}`);
  return response.data.subscription;
}

export async function updateSubscription(id, payload) {
  const response = await http.patch(`/subscriptions/${id}`, payload);
  return response.data.subscription;
}

export async function archiveSubscription(id) {
  const response = await http.post(`/subscriptions/${id}/archive`);
  return response.data.subscription;
}

export async function restoreSubscription(id) {
  const response = await http.post(`/subscriptions/${id}/restore`);
  return response.data.subscription;
}
