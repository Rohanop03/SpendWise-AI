import { Navigate, Outlet } from 'react-router-dom';

import { useAuth } from './useAuth.js';

function PublicOnlyRoute() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <p className="mx-auto max-w-3xl px-5 py-24 text-center text-slate-300">
        Checking your session…
      </p>
    );
  }

  return isAuthenticated ? <Navigate replace to="/account" /> : <Outlet />;
}

export default PublicOnlyRoute;
