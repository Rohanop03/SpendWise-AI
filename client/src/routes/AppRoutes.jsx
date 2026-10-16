import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../auth/ProtectedRoute.jsx';
import PublicOnlyRoute from '../auth/PublicOnlyRoute.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import { CardSkeleton } from '../ui/Feedback.jsx';

// Public pages are eager so they can be prerendered; private pages load per route so
// chart, D3 and table code only downloads where it is used.
const AccountPage = lazy(() => import('../pages/AccountPage.jsx'));
const AddSubscriptionPage = lazy(() => import('../pages/AddSubscriptionPage.jsx'));
const AnalyticsPage = lazy(() => import('../pages/AnalyticsPage.jsx'));
const BillingOverviewPage = lazy(() => import('../pages/BillingOverviewPage.jsx'));
const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));
const EditSubscriptionPage = lazy(() => import('../pages/EditSubscriptionPage.jsx'));
const NotificationsPage = lazy(() => import('../pages/NotificationsPage.jsx'));
const PaymentDetailsPage = lazy(() => import('../pages/PaymentDetailsPage.jsx'));
const PaymentsPage = lazy(() => import('../pages/PaymentsPage.jsx'));
const RecommendationsPage = lazy(() => import('../pages/RecommendationsPage.jsx'));
const RecordPaymentPage = lazy(() => import('../pages/RecordPaymentPage.jsx'));
const SettingsPage = lazy(() => import('../pages/SettingsPage.jsx'));
const SubscriptionDetailsPage = lazy(() => import('../pages/SubscriptionDetailsPage.jsx'));
const SubscriptionsPage = lazy(() => import('../pages/SubscriptionsPage.jsx'));

// Dev-only component kit; `import.meta.env.DEV` is false in production builds, so the
// import is dropped entirely.
const KitPage = import.meta.env.DEV ? lazy(() => import('../pages/KitPage.jsx')) : null;

function Lazy({ children, label }) {
  return (
    <Suspense
      fallback={
        <div className="neu-raised mx-auto max-w-3xl rounded-(--radius-card) p-6">
          <CardSkeleton label={label} lines={3} tall />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const privateRoutes = [
  ['dashboard', DashboardPage, 'dashboard'],
  ['account', AccountPage, 'account'],
  ['settings', SettingsPage, 'settings'],
  ['subscriptions', SubscriptionsPage, 'subscriptions'],
  ['subscriptions/new', AddSubscriptionPage, 'subscription form'],
  ['subscriptions/:id', SubscriptionDetailsPage, 'subscription'],
  ['subscriptions/:id/edit', EditSubscriptionPage, 'subscription form'],
  ['payments', PaymentsPage, 'payments'],
  ['payments/new', RecordPaymentPage, 'payment form'],
  ['payments/:id', PaymentDetailsPage, 'payment'],
  ['billing', BillingOverviewPage, 'billing'],
  ['analytics', AnalyticsPage, 'analytics'],
  ['notifications', NotificationsPage, 'notifications'],
  ['recommendations', RecommendationsPage, 'recommendations'],
];

function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route element={<LoginPage />} path="login" />
          <Route element={<RegisterPage />} path="register" />
        </Route>
        <Route element={<ProtectedRoute />}>
          {privateRoutes.map(([path, Page, label]) => (
            <Route
              element={
                <Lazy label={label}>
                  <Page />
                </Lazy>
              }
              key={path}
              path={path}
            />
          ))}
        </Route>
        {KitPage && (
          <Route
            element={
              <Lazy label="component kit">
                <KitPage />
              </Lazy>
            }
            path="kit"
          />
        )}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
