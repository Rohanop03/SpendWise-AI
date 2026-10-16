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

/** FR2 delete: removes the subscription with its payments and reminders. */
export async function deleteSubscription(id) {
  await http.delete(`/subscriptions/${id}`);
}

/** Cancels, optionally recording a final payment in the same transaction. */
export async function cancelSubscription(id, finalPayment) {
  const response = await http.post(
    `/subscriptions/${id}/cancel`,
    finalPayment ? { finalPayment } : {},
  );
  return response.data;
}

/** Records use today (the user's local date on the server) or on `lastUsedDate`. */
export async function markSubscriptionUsed(id, lastUsedDate) {
  const response = await http.patch(
    `/subscriptions/${id}/used`,
    lastUsedDate ? { lastUsedDate } : {},
  );
  return response.data.subscription;
}

export async function getSubscriptionHistory(id) {
  const response = await http.get(`/subscriptions/${id}/history`);
  return response.data.items;
}
