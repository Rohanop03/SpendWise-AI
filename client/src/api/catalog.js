import http from './http.js';

export async function getCategories() {
  const response = await http.get('/categories');
  return response.data.categories;
}

export async function getServices({ search } = {}) {
  const response = await http.get('/services', {
    params: search ? { search } : undefined,
  });
  return response.data.services;
}
