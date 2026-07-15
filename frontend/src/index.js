import React from 'react';
import ReactDOM from 'react-dom/client';
import * as Sentry from '@sentry/react';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HRAuthProvider } from './contexts/HRAuthContext';

if (process.env.REACT_APP_GLITCHTIP_DSN) {
  Sentry.init({
    dsn: process.env.REACT_APP_GLITCHTIP_DSN,
    environment: 'react',
    tracesSampleRate: 0.1,
  });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HRAuthProvider>
      <App />
    </HRAuthProvider>
  </React.StrictMode>
);

reportWebVitals();