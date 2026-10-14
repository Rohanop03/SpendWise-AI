import http from './http.js';

export async function createRefund(paymentId, payload) {
  const response = await http.post(`/payments/${paymentId}/refunds`, payload);
  return response.data;
}

export async function getPaymentRefunds(paymentId) {
  const response = await http.get(`/payments/${paymentId}/refunds`);
  return response.data;
}
