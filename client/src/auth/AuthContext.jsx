import { useCallback, useEffect, useMemo, useState } from 'react';

import { loginAccount, logoutAccount, registerAccount, restoreSession } from '../api/auth.js';
import { setAccessToken, setAuthenticationFailureHandler } from '../api/http.js';
import { AuthContext } from './authContext.js';

export function AuthProvider({ children }) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [logoutNotice, setLogoutNotice] = useState('');
  const [user, setUser] = useState(null);

  const clearAuthentication = useCallback(() => {
    setAccessToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setAuthenticationFailureHandler(clearAuthentication);

    restoreSession()
      .then((result) => setUser(result.user))
      .catch(() => clearAuthentication())
      .finally(() => setIsInitializing(false));

    return () => setAuthenticationFailureHandler(() => {});
  }, [clearAuthentication]);

  const value = useMemo(
    () => ({
      clearAuthentication,
      clearLogoutNotice: () => setLogoutNotice(''),
      isAuthenticated: Boolean(user),
      isInitializing,
      login: async (credentials) => {
        const result = await loginAccount(credentials);
        setAccessToken(result.accessToken);
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
