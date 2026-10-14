import http from './http.js';

export async function getApiHealth(options = {}) {
  const response = await http.get('/health', options);
  return response.data;
}
