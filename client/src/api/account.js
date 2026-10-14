import http from './http.js';

export async function updateProfile(input) {
  const response = await http.patch('/users/me', input);
  return response.data.user;
}

export async function getPreferences() {
  const response = await http.get('/users/me/preferences');
  return response.data.preferences;
}

export async function updatePreferences(input) {
  const response = await http.patch('/users/me/preferences', input);
  return response.data.preferences;
}
