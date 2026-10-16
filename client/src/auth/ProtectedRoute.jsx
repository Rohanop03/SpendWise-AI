import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { CardSkeleton } from '../ui/Feedback.jsx';
import { useAuth } from './useAuth.js';

function ProtectedRoute() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <div className="mx-auto max-w-md px-5 py-24">
        <div className="glass rounded-(--radius-card) p-6">
          <p className="mb-4 text-sm font-bold">Restoring your session…</p>
          <CardSkeleton label="your session" lines={1} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate replace state={{ from: location.pathname }} to="/login" />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
