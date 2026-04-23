import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';

// Pages
import Landing from './pages/Landing';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsOfService from './pages/TermsOfService';
import Login from './pages/auth/Login';
import Signup from './pages/auth/Signup';
import SuperAdminLogin from './pages/auth/SuperAdminLogin';
import ResetPassword from './pages/auth/ResetPassword';
import Subscribe from './pages/Subscribe';

// Admin Pages
import AdminDashboard from './pages/admin/Dashboard';
import Apartments from './pages/admin/Apartments';
import Flats from './pages/admin/Flats';
import Income from './pages/admin/Income';
import Expenses from './pages/admin/Expenses';
import Reports from './pages/admin/Reports';
import Maintenance from './pages/admin/Maintenance';
import Announcements from './pages/admin/Announcements';
import MyAccount from './pages/admin/MyAccount';
import ViewerSettings from './pages/admin/ViewerSettings';

// Super Admin Pages
import SADashboard from './pages/superadmin/SADashboard';
import SAApartments from './pages/superadmin/SAApartments';
import SASubscriptions from './pages/superadmin/SASubscriptions';
import SAAnalytics from './pages/superadmin/SAAnalytics';
import SAUsers from './pages/superadmin/SAUsers';

// Resident Pages
import ResDashboard from './pages/resident/ResDashboard';
import ResIncome from './pages/resident/ResIncome';
import ResExpenses from './pages/resident/ResExpenses';
import ResReports from './pages/resident/ResReports';
import ResMaintenance from './pages/resident/ResMaintenance';
import ResAnnouncements from './pages/resident/ResAnnouncements';

const LoadingScreen = () => (
  <div className="min-h-screen bg-gray-100 flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading...</p>
    </div>
  </div>
);

const BootstrapFailedScreen = ({ message, onRetry, onLogin }) => (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
    <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8 text-center">
      <p className="text-gray-900 font-medium mb-2">Couldn’t load your account</p>
      <p className="text-sm text-gray-600 mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          type="button"
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium"
          onClick={onRetry}
        >
          Retry
        </button>
        <button
          type="button"
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-800 hover:bg-gray-50"
          onClick={onLogin}
        >
          Back to login
        </button>
      </div>
    </div>
  </div>
);

const ProtectedRoute = ({ children, allowedRoles = [] }) => {
  const {
    user,
    userProfile,
    loading,
    profileLoaded,
    isResident,
    checkSubscription,
    bootstrapError,
    retryBootstrap,
    saManagedApartmentId,
  } = useAuth();
  const location = useLocation();

  console.log('[ProtectedRoute] render:', {
    hasUser: !!user,
    hasProfile: !!userProfile,
    loading,
    profileLoaded,
    isResident,
    hasBootstrapError: !!bootstrapError,
    allowedRoles
  });

  if (user && bootstrapError) {
    console.log('[ProtectedRoute] showing bootstrap error screen');
    return (
      <BootstrapFailedScreen
        message={bootstrapError.message}
        onRetry={() => retryBootstrap()}
        onLogin={() => {
          window.location.href = '/login';
        }}
      />
    );
  }

  // Wait until auth check + profile load are complete
  if (loading) {
    console.log('[ProtectedRoute] showing loading (loading=true)');
    return <LoadingScreen />;
  }
  
  // If we have a user but profile is still loading and no bootstrap error, show loading
  if (user && !profileLoaded && !bootstrapError) {
    console.log('[ProtectedRoute] showing loading (user exists but profile not loaded)');
    return <LoadingScreen />;
  }

  console.log('[ProtectedRoute] proceeding to route protection');

  // Resident session
  if (isResident) {
    if (allowedRoles.includes('resident')) return children;
    return <Navigate to="/resident/dashboard" replace />;
  }

  // Not logged in
  if (!user) {
    console.log('[ProtectedRoute] redirecting to login (no user)');
    return <Navigate to="/login" replace />;
  }

  // Logged in but no profile (e.g. first-time Google OAuth user — send to signup to complete setup)
  if (!userProfile) {
    console.log('[ProtectedRoute] redirecting to signup (no profile)');
    return <Navigate to="/signup" replace />;
  }

  const roleAllowed =
    allowedRoles.length === 0 ||
    allowedRoles.includes(userProfile.role) ||
    (allowedRoles.includes('admin') &&
      userProfile.role === 'super_admin' &&
      !!saManagedApartmentId);

  if (allowedRoles.length > 0 && !roleAllowed) {
    console.log('[ProtectedRoute] wrong role, redirecting:', userProfile.role);
    if (userProfile.role === 'super_admin') {
      return <Navigate to="/superadmin/apartments" replace />;
    }
    if (userProfile.role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/login" replace />;
  }

  /* Admin with lapsed trial/subscription: read-only — dashboard, reports, account, subscribe only */
  if (userProfile.role === 'admin' && !saManagedApartmentId) {
    const sub = checkSubscription();
    if (sub.adminAccess === 'read_only') {
      const path = location.pathname;
      const allowed =
        path.startsWith('/admin/dashboard') ||
        path.startsWith('/admin/reports') ||
        path.startsWith('/admin/account') ||
        path.startsWith('/subscribe');
      if (!allowed) {
        return <Navigate to="/admin/dashboard" replace />;
      }
    }
  }

  console.log('[ProtectedRoute] rendering children');
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, userProfile, profileLoaded, isResident, bootstrapError, retryBootstrap } = useAuth();
  const location = useLocation();

  if (isResident) return <Navigate to="/resident/dashboard" replace />;

  if (user && bootstrapError) {
    return (
      <BootstrapFailedScreen
        message={bootstrapError.message}
        onRetry={() => retryBootstrap()}
        onLogin={() => {
          window.location.href = '/login';
        }}
      />
    );
  }

  // Avoid flashing /signup while the profile row is still loading after session restore.
  // Never block /login or /signup: after signup, signOut + navigate can leave stale `user`
  // with profileLoaded=false briefly — that caused infinite "Loading..." on the login page.
  const onLoginOrSignup = location.pathname === '/login' || location.pathname === '/signup';
  if (user && !profileLoaded && !bootstrapError && !onLoginOrSignup) return <LoadingScreen />;

  if (user && userProfile) {
    if (userProfile.role === 'super_admin') return <Navigate to="/superadmin/dashboard" replace />;
    return <Navigate to="/admin/dashboard" replace />;
  }

  // Google/Apple OAuth user — authenticated but no profile yet, send to signup
  if (user && !userProfile && profileLoaded) {
    if (window.location.pathname !== '/signup') return <Navigate to="/signup" replace />;
  }

  return children;
};

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/signup" element={<PublicRoute><Signup /></PublicRoute>} />
      <Route path="/superadmin" element={<SuperAdminLogin />} />
      <Route path="/setup-superadmin" element={<Navigate to="/superadmin" replace />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Subscription */}
      <Route path="/subscribe" element={<ProtectedRoute allowedRoles={['admin']}><Subscribe /></ProtectedRoute>} />

      {/* Admin */}
      <Route path="/admin/dashboard"      element={<ProtectedRoute allowedRoles={['admin']}><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/apartments"     element={<ProtectedRoute allowedRoles={['admin']}><Apartments /></ProtectedRoute>} />
      <Route path="/admin/flats"          element={<ProtectedRoute allowedRoles={['admin']}><Flats /></ProtectedRoute>} />
      <Route path="/admin/income"         element={<ProtectedRoute allowedRoles={['admin']}><Income /></ProtectedRoute>} />
      <Route path="/admin/expenses"       element={<ProtectedRoute allowedRoles={['admin']}><Expenses /></ProtectedRoute>} />
      <Route path="/admin/reports"        element={<ProtectedRoute allowedRoles={['admin']}><Reports /></ProtectedRoute>} />
      <Route path="/admin/maintenance"    element={<ProtectedRoute allowedRoles={['admin']}><Maintenance /></ProtectedRoute>} />
      <Route path="/admin/announcements"  element={<ProtectedRoute allowedRoles={['admin']}><Announcements /></ProtectedRoute>} />
      <Route path="/admin/account"        element={<ProtectedRoute allowedRoles={['admin']}><MyAccount /></ProtectedRoute>} />
      <Route path="/admin/viewer-settings" element={<ProtectedRoute allowedRoles={['admin']}><ViewerSettings /></ProtectedRoute>} />

      {/* Super Admin */}
      <Route path="/superadmin/dashboard"     element={<ProtectedRoute allowedRoles={['super_admin']}><SADashboard /></ProtectedRoute>} />
      <Route path="/superadmin/apartments"    element={<ProtectedRoute allowedRoles={['super_admin']}><SAApartments /></ProtectedRoute>} />
      <Route path="/superadmin/subscriptions" element={<ProtectedRoute allowedRoles={['super_admin']}><SASubscriptions /></ProtectedRoute>} />
      <Route path="/superadmin/analytics" element={<ProtectedRoute allowedRoles={['super_admin']}><SAAnalytics /></ProtectedRoute>} />
      <Route path="/superadmin/users" element={<ProtectedRoute allowedRoles={['super_admin']}><SAUsers /></ProtectedRoute>} />

      {/* Resident */}
      <Route path="/resident/dashboard"     element={<ProtectedRoute allowedRoles={['resident']}><ResDashboard /></ProtectedRoute>} />
      <Route path="/resident/income"        element={<ProtectedRoute allowedRoles={['resident']}><ResIncome /></ProtectedRoute>} />
      <Route path="/resident/expenses"      element={<ProtectedRoute allowedRoles={['resident']}><ResExpenses /></ProtectedRoute>} />
      <Route path="/resident/reports"       element={<ProtectedRoute allowedRoles={['resident']}><ResReports /></ProtectedRoute>} />
      <Route path="/resident/maintenance"   element={<ProtectedRoute allowedRoles={['resident']}><ResMaintenance /></ProtectedRoute>} />
      <Route path="/resident/announcements" element={<ProtectedRoute allowedRoles={['resident']}><ResAnnouncements /></ProtectedRoute>} />

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
