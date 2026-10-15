import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../auth/ProtectedRoute.jsx';
import PublicOnlyRoute from '../auth/PublicOnlyRoute.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import AccountPage from '../pages/AccountPage.jsx';
import AddSubscriptionPage from '../pages/AddSubscriptionPage.jsx';
import AnalyticsPage from '../pages/AnalyticsPage.jsx';
import BillingOverviewPage from '../pages/BillingOverviewPage.jsx';
import EditSubscriptionPage from '../pages/EditSubscriptionPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import NotificationsPage from '../pages/NotificationsPage.jsx';
import PaymentDetailsPage from '../pages/PaymentDetailsPage.jsx';
import PaymentsPage from '../pages/PaymentsPage.jsx';
import RecordPaymentPage from '../pages/RecordPaymentPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';
import SubscriptionDetailsPage from '../pages/SubscriptionDetailsPage.jsx';
import SubscriptionsPage from '../pages/SubscriptionsPage.jsx';

const DashboardPage = lazy(() => import('../pages/DashboardPage.jsx'));

function DashboardRoute() {
  return (
    <Suspense
      fallback={
        <p className="mx-auto max-w-7xl px-5 py-24 text-center text-slate-300" role="status">
          Loading dashboard…
        </p>
      }
    >
      <DashboardPage />
    </Suspense>
  );
}

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
          <Route element={<DashboardRoute />} path="dashboard" />
          <Route element={<AccountPage />} path="account" />
          <Route element={<SettingsPage />} path="settings" />
          <Route element={<SubscriptionsPage />} path="subscriptions" />
          <Route element={<AddSubscriptionPage />} path="subscriptions/new" />
          <Route element={<SubscriptionDetailsPage />} path="subscriptions/:id" />
          <Route element={<EditSubscriptionPage />} path="subscriptions/:id/edit" />
          <Route element={<PaymentsPage />} path="payments" />
          <Route element={<RecordPaymentPage />} path="payments/new" />
          <Route element={<PaymentDetailsPage />} path="payments/:id" />
          <Route element={<BillingOverviewPage />} path="billing" />
          <Route element={<AnalyticsPage />} path="analytics" />
          <Route element={<NotificationsPage />} path="notifications" />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
