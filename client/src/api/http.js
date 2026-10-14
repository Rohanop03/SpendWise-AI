import axios from 'axios';

const DEFAULT_API_BASE_URL = 'http://localhost:5000/api/v1';
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
let accessToken = null;
let authenticationFailureHandler = () => {};
let refreshRequest = null;

const http = axios.create({
  baseURL: apiBaseUrl,
  headers: {
    Accept: 'application/json',
  },
  timeout: 5000,
  withCredentials: true,
});

export function setAccessToken(token) {
  accessToken = token;
}

export function setAuthenticationFailureHandler(handler) {
  authenticationFailureHandler = handler;
}

export async function requestTokenRefresh() {
  if (!refreshRequest) {
    refreshRequest = axios
      .post(
        `${apiBaseUrl}/auth/refresh`,
        {},
        {
          headers: { 'X-Requested-With': 'XMLHttpRequest' },
          timeout: 5000,
          withCredentials: true,
        },
      )
      .then((response) => {
        setAccessToken(response.data.accessToken);
        return response.data;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

const unrefreshableEndpoints = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isUnrefreshableRequest(url) {
  if (!url) {
    return false;
  }

  try {
    const pathname = new URL(url, 'http://localhost').pathname;
    return unrefreshableEndpoints.some((endpoint) => pathname.endsWith(endpoint));
  } catch {
    return unrefreshableEndpoints.some((endpoint) => url.includes(endpoint));
  }
}

export function getAccessToken() {
  return accessToken;
}

export function resetHttpState() {
  accessToken = null;
  authenticationFailureHandler = () => {};
  refreshRequest = null;
}

http.interceptors.request.use((request) => {
  if (accessToken && request.headers) {
    if (typeof request.headers.set === 'function') {
      request.headers.set('Authorization', `Bearer ${accessToken}`);
    } else {
      request.headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  return request;
});

http.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config;
    const isUnauthorized = error.response?.status === 401;

    if (
      !request ||
      !isUnauthorized ||
      request._retriedAfterRefresh ||
      isUnrefreshableRequest(request.url)
    ) {
      return Promise.reject(error);
    }

    request._retriedAfterRefresh = true;

    try {
      await requestTokenRefresh();
      if (request.headers) {
        if (typeof request.headers.set === 'function') {
          request.headers.set('Authorization', `Bearer ${accessToken}`);
        } else {
          request.headers.Authorization = `Bearer ${accessToken}`;
        }
      }
      return http(request);
    } catch (refreshError) {
      setAccessToken(null);
      authenticationFailureHandler();
      return Promise.reject(refreshError);
    }
  },
);

export function getApiErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || 'The SpendWise API could not be reached.';
  }

  return 'An unexpected connection error occurred.';
}

export default http;
