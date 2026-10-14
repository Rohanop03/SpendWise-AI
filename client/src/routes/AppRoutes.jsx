import { Route, Routes } from 'react-router-dom';

import ProtectedRoute from '../auth/ProtectedRoute.jsx';
import PublicOnlyRoute from '../auth/PublicOnlyRoute.jsx';
import AppLayout from '../layouts/AppLayout.jsx';
import AccountPage from '../pages/AccountPage.jsx';
import HomePage from '../pages/HomePage.jsx';
import LoginPage from '../pages/LoginPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';
import RegisterPage from '../pages/RegisterPage.jsx';
import SettingsPage from '../pages/SettingsPage.jsx';

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
          <Route element={<AccountPage />} path="account" />
          <Route element={<SettingsPage />} path="settings" />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRoutes;
