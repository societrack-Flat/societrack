import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import BrandLogo from '../../components/BrandLogo';
import { requestAdminPasswordReset } from '../../lib/apiClient';
import toast from 'react-hot-toast';

const ForgotPasswordAdmin = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) {
      toast.error('Enter your admin email');
      return;
    }
    setLoading(true);
    try {
      try {
        sessionStorage.setItem('societrack_reset_from', 'admin');
      } catch {
        /* ignore */
      }
      await requestAdminPasswordReset(trimmed);
      setSent(true);
      toast.success('Check your email for the reset link');
    } catch (err) {
      toast.error(err?.message || 'Could not send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex justify-center">
          <BrandLogo variant="dark" size="lg" to="/" />
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 p-8">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-900 mb-6"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>

          <h1 className="text-2xl font-bold text-gray-900">Forgot password</h1>
          <p className="text-gray-500 mt-2 text-sm">
            For society admins who sign in with <strong>email and password</strong>. Enter the same email you use on the admin login page.
          </p>
          <p className="text-gray-400 mt-2 text-xs">
            If you use Google or Apple to sign in, reset your password through that provider instead.
          </p>

          {sent ? (
            <p className="mt-6 text-sm text-gray-700 bg-green-50 border border-green-200 rounded-xl p-4">
              If this email is registered as an admin, you will receive a reset link shortly. Open it on this device and set a new password, then sign in at the admin login page.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 border-2 border-gray-100 focus:border-green-500 focus:bg-white focus:outline-none transition-all"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-60"
              >
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordAdmin;
