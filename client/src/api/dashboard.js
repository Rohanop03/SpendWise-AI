import http from './http.js';

/** Every dashboard widget, recommendation previews and preferences in one round trip. */
export async function getDashboard(params = {}, options = {}) {
  const response = await http.get('/dashboard', { params, ...options });
  return response.data;
}
