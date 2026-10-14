import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import http, {
  getAccessToken,
  getApiErrorMessage,
  resetHttpState,
  setAccessToken,
  setAuthenticationFailureHandler,
} from '../api/http.js';

describe('Axios HTTP client and refresh interceptor', () => {
  let originalAdapter;

  beforeEach(() => {
    resetHttpState();
    vi.restoreAllMocks();
    originalAdapter = http.defaults.adapter;
  });

  afterEach(() => {
    http.defaults.adapter = originalAdapter;
    resetHttpState();
  });

  it('attaches Bearer authorization header when access token is present', async () => {
    setAccessToken('test-token-123');
    let capturedConfig;
    http.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        config,
        data: { ok: true },
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    };

    const response = await http.get('/test');
    expect(response.data).toEqual({ ok: true });
    expect(capturedConfig.headers.Authorization).toBe('Bearer test-token-123');
  });

  it('does not retry unrefreshable requests like /auth/login on 401', async () => {
    const postSpy = vi.spyOn(axios, 'post');
    http.defaults.adapter = async (config) => {
      const error = new Error('Request failed with status code 401');
      error.config = config;
      error.response = { config, data: { message: 'Invalid credentials' }, status: 401 };
      throw error;
    };

    await expect(http.post('/auth/login', { email: 'test@example.com' })).rejects.toThrow();
    expect(postSpy).not.toHaveBeenCalled();
  });

  it('recovers /auth/me from expired access token by refreshing and retrying', async () => {
    setAccessToken('expired-access-token');
    let attemptCount = 0;
    const calls = [];

    vi.spyOn(axios, 'post').mockImplementation(async (url) => {
      if (url.includes('/auth/refresh')) {
        return {
          data: {
            accessToken: 'fresh-new-token',
            user: { displayName: 'Refreshed', id: '1' },
          },
        };
      }
      throw new Error(`Unexpected post url: ${url}`);
    });

    http.defaults.adapter = async (config) => {
      attemptCount += 1;
      calls.push({
        auth: config.headers?.Authorization || config.headers?.get?.('Authorization'),
        url: config.url,
      });

      if (attemptCount === 1) {
        const error = new Error('Request failed with status code 401');
        error.config = config;
        error.response = { config, data: { message: 'Token expired' }, status: 401 };
        throw error;
      }

      return {
        config,
        data: { user: { displayName: 'Refreshed', id: '1' } },
        headers: {},
        status: 200,
        statusText: 'OK',
      };
    };

    const response = await http.get('/auth/me');
    expect(response.status).toBe(200);
    expect(response.data.user.displayName).toBe('Refreshed');
    expect(attemptCount).toBe(2);
    expect(getAccessToken()).toBe('fresh-new-token');
    expect(calls[0].auth).toBe('Bearer expired-access-token');
    expect(calls[1].auth).toBe('Bearer fresh-new-token');
  });

  it('invokes failure handler and clears token when refresh fails', async () => {
    setAccessToken('expired-token');
    const failureHandler = vi.fn();
    setAuthenticationFailureHandler(failureHandler);

    vi.spyOn(axios, 'post').mockRejectedValue(new Error('Refresh session expired'));

    http.defaults.adapter = async (config) => {
      const error = new Error('Request failed with status code 401');
      error.config = config;
      error.response = { config, data: { message: 'Token expired' }, status: 401 };
      throw error;
    };

    await expect(http.get('/auth/me')).rejects.toThrow('Refresh session expired');
    expect(failureHandler).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
  });

  it('formats safe api error messages', () => {
    expect(getApiErrorMessage(null)).toBe('An unexpected connection error occurred.');
    const axiosError = {
      isAxiosError: true,
      response: { data: { message: 'Specific failure' } },
    };
    expect(getApiErrorMessage(axiosError)).toBe('Specific failure');
  });
});
