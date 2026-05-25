import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

/** Supabase recovery emails may land on /login or / with tokens in the hash — send user to reset page. */
(function redirectPasswordRecoveryLink() {
  const { pathname, search, hash } = window.location;
  if (!hash?.includes('type=recovery')) return;
  if (pathname === '/reset-password') return;
  const fromAdmin = search.includes('from=admin') || pathname.startsWith('/login') ? '?from=admin' : search || '';
  window.location.replace(`/reset-password${fromAdmin}${hash}`);
})();

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
