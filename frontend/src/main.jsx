import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import { isNativeApp } from './lib/nativeApp';
import './index.css';

/** Supabase recovery emails may land on /, /login, or elsewhere — send user to reset page. */
(function redirectPasswordRecoveryLink() {
  const { pathname, search, hash } = window.location;
  if (pathname === '/reset-password') return;

  const params = new URLSearchParams(search);
  const hasRecoveryCode = params.has('code');
  const hasRecoveryHash = hash?.includes('type=recovery');

  if (!hasRecoveryCode && !hasRecoveryHash) return;

  const qs = new URLSearchParams(search);
  if (!qs.has('from') && pathname.startsWith('/login')) {
    qs.set('from', 'admin');
  }
  const query = qs.toString() ? `?${qs.toString()}` : '';

  if (hasRecoveryHash) {
    window.location.replace(`/reset-password${query}${hash}`);
    return;
  }

  if (hasRecoveryCode) {
    window.location.replace(`/reset-password${query}`);
  }
})();

/** Android/iOS app opens at / — send straight to login (no marketing landing page). */
if (isNativeApp() && (window.location.pathname === '/' || window.location.pathname === '')) {
  window.history.replaceState(null, '', '/login');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#333',
              color: '#fff',
              borderRadius: '10px',
              padding: '16px',
            },
            success: {
              iconTheme: {
                primary: '#22c55e',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
