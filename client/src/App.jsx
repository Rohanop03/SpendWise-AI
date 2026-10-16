import { MotionConfig } from 'framer-motion';

import AppRoutes from './routes/AppRoutes.jsx';
import Cursor from './ui/Cursor.jsx';
import SvgDefs from './ui/SvgDefs.jsx';
import { OfflineBanner } from './ui/SystemStates.jsx';
import { ToastProvider } from './ui/Toast.jsx';

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ToastProvider>
        <a className="skip-link pill pill-ink" href="#main">
          Skip to content
        </a>
        <AppRoutes />
        <SvgDefs />
        <OfflineBanner />
        <Cursor />
      </ToastProvider>
    </MotionConfig>
  );
}

export default App;
