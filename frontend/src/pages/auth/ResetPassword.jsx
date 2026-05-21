import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';

function parseRecoveryError() {
  const search = new URLSearchParams(window.location.search);
  const qErr = search.get('error_description') || search.get('error');
  if (qErr) {
    return decodeURIComponent(qErr.replace(/\+/g, ' '));
  }
  const hashRaw = window.location.hash?.replace(/^#/, '') || '';
  const hashParams = new URLSearchParams(hashRaw);
  if (!hashParams.get('error') && !hashParams.get('error_code')) return null;
  const desc = hashParams.get('error_description');
  if (desc) return decodeURIComponent(desc.replace(/\+/g, ' '));
  if (hashParams.get('error_code') === 'otp_expired') {
    return 'This reset link has expired. Request a new password reset email and use it within a few minutes.';
  }
  return 'This reset link is invalid. Please request a new one.';
}

/**
 * Supabase password recovery: user arrives from email link with hash tokens.
 * https://supabase.com/docs/guides/auth/password-reset
 */
const ResetPassword = () => {
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromAdmin = searchParams.get('from') === 'admin';
  const loginPath = fromAdmin ? '/login' : '/superadmin';
  const loginLabel = fromAdmin ? 'Admin login' : 'Super Admin login';

  useEffect(() => {
    const errMsg = parseRecoveryError();
    if (errMsg) {
      setLinkError(errMsg);
      toast.error(errMsg, { duration: 6000 });
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      return;
    }

    const hashRaw = window.location.hash?.replace(/^#/, '') || '';
    if (hashRaw.includes('type=recovery')) setReady(true);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setReady(true);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Use at least 8 characters');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success('Password updated. You can sign in now.');
      await supabase.auth.signOut();
      navigate(loginPath, { replace: true });
    } catch (err) {
      toast.error(err.message || 'Could not update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-pink-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Shield className="text-white" size={32} />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Set new password</h1>
          <p className="text-slate-400 text-sm">Use the link from your email. This page opens after you click it.</p>
        </div>

        {linkError ? (
          <div className="bg-amber-500/15 border border-amber-500/40 rounded-2xl p-6 text-left text-slate-200 text-sm space-y-4">
            <div className="flex gap-3">
              <AlertCircle className="text-amber-400 shrink-0 mt-0.5" size={22} />
              <div>
                <p className="font-semibold text-amber-200 mb-1">Reset link problem</p>
                <p>{linkError}</p>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Links expire quickly for security. Request a new link from the login page and open it on this device.
            </p>
            <Link
              to={loginPath}
              className="inline-block w-full text-center py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-medium"
            >
              Back to {loginLabel}
            </Link>
          </div>
        ) : !ready ? (
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-8 text-center text-slate-300 text-sm">
            <p className="mb-4">Waiting for a valid reset session… If nothing happens, request a new link and open it on the same device where the app runs (e.g. if the app is on your PC, open Gmail in the PC browser).</p>
            <p className="mb-4 text-xs text-slate-500 text-left">
              If the email link showed “site can’t be reached”, add your app URL to Supabase → Authentication → URL Configuration → Redirect URLs
              (e.g. <code className="text-slate-400">http://localhost:5173/reset-password</code>) and set <code className="text-slate-400">VITE_APP_URL</code> in <code className="text-slate-400">.env</code> to match.
            </p>
            <Link to={loginPath} className="text-red-400 hover:text-red-300">
              ← {loginLabel}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/10 p-8 space-y-4"
            autoComplete="on"
          >
            {/* Quiet browser warning about password forms; recovery email is the “username”. */}
            <input type="email" name="username" autoComplete="username" className="sr-only" tabIndex={-1} readOnly value="" aria-hidden="true" />
            <div>
              <label className="block text-sm text-white mb-2">New password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-12 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 outline-none"
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                >
                  {show ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-white mb-2">Confirm password</label>
              <input
                type={show ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:ring-2 focus:ring-red-500 outline-none"
                placeholder="Repeat password"
                minLength={8}
                required
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-600 text-white font-semibold rounded-xl hover:from-red-600 hover:to-pink-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save password'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <Link to={loginPath} className="text-slate-400 hover:text-white text-sm">
            ← {loginLabel}
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;
