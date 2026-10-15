import http from './http.js';

export async function getNotifications(parameters = {}) {
  const response = await http.get('/notifications', { params: parameters });
  return response.data;
}

export async function getUnreadNotificationCount() {
  const response = await http.get('/notifications/unread-count');
  return response.data.count;
}

export async function markNotificationRead(id) {
  const response = await http.patch(`/notifications/${id}/read`);
  return response.data.notification;
}

export async function markAllNotificationsRead() {
  const response = await http.patch('/notifications/read-all');
  return response.data;
}

export function notifyNotificationStateChanged() {
  window.dispatchEvent(new Event('spendwise:notifications-changed'));
}
