import http from './http.js';

export async function getRecommendations(params = {}) {
  const response = await http.get('/recommendations', { params });
  return response.data;
}

export async function getRecommendationSummary() {
  const response = await http.get('/recommendations/summary');
  return response.data;
}

export async function generateRecommendations() {
  const response = await http.post('/recommendations/generate');
  return response.data;
}

export async function updateRecommendation(id, status) {
  const response = await http.patch(`/recommendations/${id}`, { status });
  return response.data;
}

export async function explainRecommendation(id) {
  const response = await http.post(`/recommendations/${id}/explain`);
  return response.data;
}
