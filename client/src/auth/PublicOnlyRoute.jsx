import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './useAuth.js';

/**
 * Login/register stay visible while the session check runs (so prerendered HTML does not
 * jump), then redirect to the dashboard exactly as before once a session is confirmed.
 */
function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (!isInitializing && isAuthenticated) {
    return <Navigate replace to="/dashboard" />;
  }

  return <Outlet />;
}

export default PublicOnlyRoute;
