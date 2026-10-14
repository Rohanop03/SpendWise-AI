import http, { requestTokenRefresh } from './http.js';

const csrfHeaders = { 'X-Requested-With': 'XMLHttpRequest' };

export async function registerAccount(input) {
  const response = await http.post('/auth/register', input, { headers: csrfHeaders });
  return response.data;
}

export async function loginAccount(input) {
  const response = await http.post('/auth/login', input, { headers: csrfHeaders });
  return response.data;
}

export function restoreSession() {
  return requestTokenRefresh();
}

export async function logoutAccount() {
  const response = await http.post('/auth/logout', {}, { headers: csrfHeaders });
  return response.data;
}

export async function changePassword(input) {
  const response = await http.post('/auth/change-password', input, { headers: csrfHeaders });
  return response.data;
}

export async function getCurrentUser() {
  const response = await http.get('/auth/me');
  return response.data.user;
}
