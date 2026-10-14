export const refreshCookieName = 'spendwise_refresh';

export function createRefreshCookieOptions({ maxAge, secure }) {
  return {
    httpOnly: true,
    maxAge,
    path: '/api/v1/auth',
    sameSite: 'lax',
    secure,
  };
}

export function createClearRefreshCookieOptions({ secure }) {
  return {
    httpOnly: true,
    path: '/api/v1/auth',
    sameSite: 'lax',
    secure,
  };
}
