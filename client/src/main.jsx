import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import App from './App.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import './styles/index.css';

// Public routes ship prerendered HTML (scripts/prerender.mjs). Their first client render
// matches the server output (logged out, API status "checking"), so we hydrate and keep
// the painted DOM; private routes get an empty shell and render normally. The static
// head tags are removed first because <Seo/> re-adds them through React.
document.querySelectorAll('[data-prerender]').forEach((node) => node.remove());

const container = document.getElementById('root');
const app = (
  <BrowserRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </BrowserRouter>
);

if (container.firstElementChild) {
  // Let the browser paint the prerendered HTML first, then hydrate on the next frame so
  // hydration work never delays first contentful paint.
  requestAnimationFrame(() => setTimeout(() => hydrateRoot(container, app), 0));
} else {
  createRoot(container).render(app);
}
