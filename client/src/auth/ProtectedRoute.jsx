import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from './useAuth.js';

function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <p className="mx-auto max-w-3xl px-5 py-24 text-center text-slate-300">
        Restoring your session…
      </p>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
