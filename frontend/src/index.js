import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HRAuthProvider } from './contexts/HRAuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HRAuthProvider>
      <App />
    </HRAuthProvider>
  </React.StrictMode>
);

reportWebVitals();
