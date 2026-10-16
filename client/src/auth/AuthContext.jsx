import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

import { loginAccount, logoutAccount, registerAccount, restoreSession } from '../api/auth.js';
import { setAccessToken, setAuthenticationFailureHandler } from '../api/http.js';
import { AuthContext } from './authContext.js';

// A non-secret hint ("this browser had a session") lets public pages skip a refresh call
// that would certainly 401 for first-time visitors. Protected routes always attempt the
// cookie refresh exactly as before.
const SESSION_HINT_KEY = 'spendwise-session-hint';
const PRIVATE_PREFIXES = [
  '/dashboard',
  '/subscriptions',
  '/payments',
  '/billing',
  '/analytics',
  '/notifications',
  '/recommendations',
  '/account',
  '/settings',
];

function isPrivatePath(pathname) {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function readHint() {
  try {
    return window.localStorage.getItem(SESSION_HINT_KEY) === '1';
  } catch {
    return true;
  }
}

function writeHint(present) {
  try {
    if (present) window.localStorage.setItem(SESSION_HINT_KEY, '1');
    else window.localStorage.removeItem(SESSION_HINT_KEY);
  } catch {
    // Storage may be unavailable; the refresh call then simply runs every time.
  }
}

export function AuthProvider({ children }) {
  const { pathname } = useLocation();
  const [shouldRestore] = useState(() => isPrivatePath(pathname) || readHint());
  const [isInitializing, setIsInitializing] = useState(shouldRestore);
  const [logoutNotice, setLogoutNotice] = useState('');
  const [user, setUser] = useState(null);

  const clearAuthentication = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    writeHint(false);
  }, []);

  useEffect(() => {
    setAuthenticationFailureHandler(clearAuthentication);

    if (shouldRestore) {
      restoreSession()
        .then((result) => {
          writeHint(true);
          setUser(result.user);
        })
        .catch(() => clearAuthentication())
        .finally(() => setIsInitializing(false));
    }

    return () => setAuthenticationFailureHandler(() => {});
  }, [clearAuthentication, shouldRestore]);

  const value = useMemo(
    () => ({
      clearAuthentication,
      clearLogoutNotice: () => setLogoutNotice(''),
      isAuthenticated: Boolean(user),
      isInitializing,
      login: async (credentials) => {
        const result = await loginAccount(credentials);
        setAccessToken(result.accessToken);
        writeHint(true);
        setLogoutNotice('');
        setUser(result.user);
        return result.user;
      },
      logout: async () => {
        let confirmed = true;

        try {
          await logoutAccount();
          setLogoutNotice('You have been securely logged out.');
        } catch {
          confirmed = false;
          setLogoutNotice(
            'Local credentials were cleared, but server-side session revocation could not be confirmed.',
          );
        } finally {
          clearAuthentication();
        }

        return confirmed;
      },
      logoutNotice,
      register: async (input) => {
        const result = await registerAccount(input);
        setAccessToken(result.accessToken);
        writeHint(true);
        setLogoutNotice('');
        setUser(result.user);
        return result.user;
      },
      setUser,
      user,
    }),
    [clearAuthentication, isInitializing, logoutNotice, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
