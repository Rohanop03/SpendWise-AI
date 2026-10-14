import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api/v1';

const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL,
  headers: {
    Accept: 'application/json',
  },
  timeout: 5000,
});

export function getApiErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || 'The SpendWise API could not be reached.';
  }

  return 'An unexpected connection error occurred.';
}

export default http;
