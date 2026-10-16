import axios from 'axios';

// Same-origin by default: in development Vite proxies /api to the backend (no CORS preflight).
const DEFAULT_API_BASE_URL = '/api/v1';
// Hosting dashboards often provide only the service origin; the API lives under /api/v1.
const configuredBaseUrl = (import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL).replace(
  /\/+$/,
  '',
);
const apiBaseUrl = configuredBaseUrl.endsWith('/api/v1')
  ? configuredBaseUrl
  : `${configuredBaseUrl}/api/v1`;
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

// Identical GETs that are already in flight share one request (e.g. two widgets asking for the
// same list, or React StrictMode mounting an effect twice). Each caller can still abort on its
// own: aborting only detaches that caller from the shared request.
const inflightGets = new Map();
const sendGet = http.get.bind(http);
http.get = function dedupedGet(url, config = {}) {
  const { signal, ...rest } = config;
  const key = JSON.stringify([url, rest.params ?? null, rest.responseType ?? null, accessToken]);
  let shared = inflightGets.get(key);
  if (!shared) {
    shared = sendGet(url, rest).finally(() => inflightGets.delete(key));
    inflightGets.set(key, shared);
  }
  if (!signal) return shared;
  return new Promise((resolve, reject) => {
    const abort = () => reject(new axios.CanceledError('canceled'));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });
    shared.then(resolve, reject);
  });
};

export function getApiErrorMessage(error) {
  if (axios.isAxiosError(error)) {
    // Field-level validation messages are more useful on a form than the generic summary.
    const details = error.response?.data?.details;
    if (Array.isArray(details) && details.length > 0 && details[0].message) {
      return details.map((detail) => detail.message).join(' ');
    }
    return error.response?.data?.message || 'The SpendWise API could not be reached.';
  }

  return 'An unexpected connection error occurred.';
}

export default http;
