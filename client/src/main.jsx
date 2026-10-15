import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './styles/index.css';
import { applyTheme, getPreferredTheme } from './theme.js';

applyTheme(getPreferredTheme());

createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>,
);
