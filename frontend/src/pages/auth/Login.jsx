import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Phone, Lock, Eye, EyeOff, User, Building2, Home } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import toast from 'react-hot-toast';
import BrandLogo from '../../components/BrandLogo';

// ── Animated night-sky building with windows that light up ──────────────────
const BuildingScene = ({ loginSuccess, loginAttempted, userType }) => {
  const FLOORS = 6;
  const COLS = 4;
  const TOTAL = FLOORS * COLS;

  // Each window: initially some lit, some dark (random, stable via ref)
  const initialStates = useRef(
    Array.from({ length: TOTAL }, (_, i) => i % 3 !== 0)
  );
  const [lit, setLit] = useState(initialStates.current);

  // Ambient flicker: randomly toggle one window every ~2s when idle
  useEffect(() => {
    if (loginSuccess || loginAttempted) return;
    const id = setInterval(() => {
      setLit(prev => {
        const next = [...prev];
        const idx = Math.floor(Math.random() * TOTAL);
        next[idx] = !next[idx];
        return next;
      });
    }, 1800);
    return () => clearInterval(id);
  }, [loginSuccess, loginAttempted, TOTAL]);

  // When login attempted: cascade windows lighting up
  useEffect(() => {
    if (!loginAttempted || loginSuccess) return;
    let i = 0;
    const id = setInterval(() => {
      setLit(prev => {
        const next = [...prev];
        next[i] = true;
        return next;
      });
      i++;
      if (i >= TOTAL) clearInterval(id);
    }, 60);
    return () => clearInterval(id);
  }, [loginAttempted, loginSuccess, TOTAL]);

  // All lit on success
  useEffect(() => {
    if (loginSuccess) setLit(Array(TOTAL).fill(true));
  }, [loginSuccess, TOTAL]);

  const windowColor = (isLit) => isLit
    ? (loginSuccess ? '#fde68a' : '#fcd34d')   // warm amber / bright yellow on success
    : '#1e293b';                                 // dark unlit

  const windowGlow = (isLit) => isLit
    ? (loginSuccess ? '0 0 8px 2px rgba(253,230,138,0.6)' : '0 0 6px 1px rgba(252,211,77,0.4)')
    : 'none';

  return (
    <div className="relative w-full h-full flex items-end justify-center pb-4 select-none">
      {/* Stars */}
      {[...Array(20)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            width: i % 3 === 0 ? 3 : 2,
            height: i % 3 === 0 ? 3 : 2,
            top: `${5 + (i * 37) % 55}%`,
            left: `${(i * 53) % 95}%`,
            opacity: 0.6,
          }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 2 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
        />
      ))}

      {/* Moon */}
      <motion.div
        className="absolute top-6 right-10 w-10 h-10 rounded-full bg-yellow-100"
        style={{ boxShadow: '0 0 20px 6px rgba(253,230,138,0.3)' }}
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 5, repeat: Infinity }}
      />

      {/* Ground glow */}
      <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-emerald-900/30 to-transparent" />

      {/* Left small building */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4, duration: 0.8 }}
        className="relative mr-6 mb-0"
        style={{ alignSelf: 'flex-end' }}
      >
        <div
          className="relative rounded-t-lg overflow-hidden"
          style={{ width: 56, height: 100, background: 'linear-gradient(to bottom, #1e3a5f, #0f2540)' }}
        >
          <div className="grid gap-1 p-1.5 pt-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 10,
                  borderRadius: 2,
                  background: lit[i + TOTAL - 8] ? '#fcd34d' : '#1e293b',
                  boxShadow: lit[i + TOTAL - 8] ? '0 0 5px 1px rgba(252,211,77,0.4)' : 'none',
                  transition: 'background 0.4s, box-shadow 0.4s',
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Main tall building */}
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, duration: 0.9, type: 'spring', stiffness: 80 }}
        className="relative"
        style={{ alignSelf: 'flex-end' }}
      >
        {/* Water tank on roof */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2 }}
          className="absolute -top-6 left-1/2 -translate-x-1/2 flex flex-col items-center"
        >
          <div style={{ width: 3, height: 12, background: '#475569' }} />
          <div style={{ width: 20, height: 12, background: '#334155', borderRadius: '3px 3px 0 0' }} />
        </motion.div>

        {/* Antenna */}
        <motion.div
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: 1.4 }}
          className="absolute -top-10 right-4 origin-bottom"
          style={{ width: 2, height: 16, background: '#64748b' }}
        >
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1, repeat: Infinity }}
            style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', marginLeft: -1.5, marginTop: -5 }}
          />
        </motion.div>

        {/* Building body */}
        <div
          className="relative rounded-t-xl overflow-hidden"
          style={{
            width: 100,
            height: 200,
            background: 'linear-gradient(to bottom, #1e3a5f, #0f2540)',
          }}
        >
          {/* Windows grid */}
          <div
            className="grid gap-2 p-3 pt-4"
            style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
          >
            {Array.from({ length: FLOORS * COLS }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 18,
                  borderRadius: 3,
                  background: windowColor(lit[i]),
                  boxShadow: windowGlow(lit[i]),
                  transition: 'background 0.5s ease, box-shadow 0.5s ease',
                }}
              />
            ))}
          </div>

          {/* Door */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2"
            style={{
              width: 20,
              height: 28,
              background: loginSuccess ? '#065f46' : '#1e3a5f',
              borderRadius: '4px 4px 0 0',
              border: '1px solid #334155',
              transition: 'background 0.6s',
            }}
          >
            <div
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: loginSuccess ? '#fcd34d' : '#64748b',
                margin: '10px auto 0',
                transition: 'background 0.4s',
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Right small building */}
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.8 }}
        className="relative ml-4"
        style={{ alignSelf: 'flex-end' }}
      >
        <div
          className="relative rounded-t-lg overflow-hidden"
          style={{ width: 48, height: 80, background: 'linear-gradient(to bottom, #1a3350, #0d1f33)' }}
        >
          <div className="grid gap-1 p-1.5 pt-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 10,
                  borderRadius: 2,
                  background: lit[i + 4] ? '#fcd34d' : '#1e293b',
                  boxShadow: lit[i + 4] ? '0 0 5px 1px rgba(252,211,77,0.4)' : 'none',
                  transition: 'background 0.4s, box-shadow 0.4s',
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>

      {/* Ground */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{ height: 8, background: 'linear-gradient(to right, transparent, #10b981, #10b981, transparent)', opacity: 0.5 }}
      />

      {/* Success celebration */}
      <AnimatePresence>
        {loginSuccess && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 1, y: 0, x: 0 }}
                animate={{ opacity: 0, y: -80 - i * 20, x: (i % 2 === 0 ? 1 : -1) * (20 + i * 15) }}
                transition={{ duration: 1.5, delay: i * 0.1 }}
                className="absolute bottom-16 left-1/2"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 1,
                  background: ['#22c55e', '#fbbf24', '#3b82f6', '#f43f5e'][i % 4],
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── Main Login Component ─────────────────────────────────────────────────────
const Login = () => {
  const [userType, setUserType] = useState('admin');
  const [loginMethod, setLoginMethod] = useState('email');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    viewerUsername: '',
    viewerPassword: '',
  });

  const navigate = useNavigate();
  const { signInWithEmail, signInWithPhone, signInAsResident } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      let result;
      if (loginMethod === 'phone') {
        result = await signInWithPhone(formData.phone, formData.password);
      } else {
        result = await signInWithEmail(formData.email, formData.password);
      }

      if (!result.success) {
        return;
      }

      const role = result.profile?.role;
      if (role === 'super_admin') navigate('/superadmin/dashboard', { replace: true });
      else if (role === 'admin') navigate('/admin/dashboard', { replace: true });
      else if (role === 'resident') navigate('/resident/dashboard', { replace: true });
      else navigate('/signup', { replace: true });
      setLoginSuccess(true);
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleResidentLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await signInAsResident(formData.viewerUsername, formData.viewerPassword);
      if (!result.success) {
        return;
      }
      navigate('/resident/dashboard', { replace: true });
      setLoginSuccess(true);
    } catch {
      toast.error('Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) toast.error(error.message);
  };

  const handleAppleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/login` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="min-h-screen flex">
      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
      `}</style>

      {/* Left: Dark panel with building animation ── */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden flex-col"
      >
        {/* Background blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-blob animation-delay-2000" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 h-full">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <BrandLogo variant="onDark" size="lg" to="/" />
          </motion.div>

          {/* Tagline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Your community,
              <span className="block bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                at your fingertips
              </span>
            </h2>
            <p className="text-slate-400 text-base">
              {loginSuccess
                ? '✓ Welcome back! Lighting up your home...'
                : 'Sign in to manage your apartment finances with ease'}
            </p>
          </motion.div>

          {/* Building animation */}
          <div className="h-64 relative">
            <BuildingScene loginSuccess={loginSuccess} loginAttempted={loading} userType={userType} />
          </div>
        </div>
      </motion.div>

      {/* ── Right: Login form ── */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center">
            <BrandLogo variant="dark" size="lg" to="/" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-white rounded-3xl shadow-xl shadow-gray-200/60 p-8"
          >
            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-gray-500 mt-2">Sign in to continue</p>
            </div>

            {/* Admin / Resident tab */}
            <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
              <button
                onClick={() => setUserType('admin')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                  userType === 'admin' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Building2 size={18} />
                Admin
              </button>
              <button
                onClick={() => setUserType('resident')}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all ${
                  userType === 'resident' ? 'bg-white text-gray-900 shadow-md' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Home size={18} />
                Resident
              </button>
            </div>

            <AnimatePresence mode="wait">
              {userType === 'admin' ? (
                <motion.div
                  key="admin"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  {/* Email / Phone toggle */}
                  <div className="flex gap-2 mb-6">
                    {['email', 'phone'].map((m) => (
                      <button
                        key={m}
                        onClick={() => setLoginMethod(m)}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
                          loginMethod === m
                            ? 'bg-green-100 text-green-700 border-2 border-green-300'
                            : 'bg-gray-50 text-gray-600 border-2 border-transparent'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleAdminLogin} className="space-y-4">
                    {loginMethod === 'email' ? (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            placeholder="Enter your email"
                            className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 border-2 border-gray-100 focus:border-green-500 focus:bg-white focus:outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                          <input
                            type="tel"
                            name="phone"
                            value={formData.phone}
                            onChange={handleChange}
                            placeholder="+91 9876543210"
                            className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 border-2 border-gray-100 focus:border-green-500 focus:bg-white focus:outline-none transition-all"
                            required
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          placeholder="Enter your password"
                          className="w-full bg-gray-50 rounded-xl pl-10 pr-10 py-3 border-2 border-gray-100 focus:border-green-500 focus:bg-white focus:outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    {loginMethod === 'email' && (
                      <div className="text-right">
                        <Link
                          to="/login/forgot-password"
                          className="text-sm text-green-600 hover:text-green-700 font-medium"
                        >
                          Forgot password?
                        </Link>
                      </div>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading || loginSuccess}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : loginSuccess ? (
                        '✓ Signed In!'
                      ) : (
                        'Sign In'
                      )}
                    </motion.button>
                  </form>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200" />
                    </div>
                    <div className="relative flex justify-center">
                      <span className="bg-white px-4 text-sm text-gray-500">Or continue with</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      onClick={handleGoogleLogin}
                      className="flex items-center justify-center gap-2 py-3 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      <span className="text-sm font-medium">Google</span>
                    </button>
                    <button
                      onClick={handleAppleLogin}
                      className="flex items-center justify-center gap-2 py-3 border-2 border-gray-100 rounded-xl hover:bg-gray-50 transition-all"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                      </svg>
                      <span className="text-sm font-medium">Apple</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="resident"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                >
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                    <p className="text-sm text-blue-800">
                      Use the flat credentials provided by your apartment admin
                    </p>
                  </div>

                  <form onSubmit={handleResidentLogin} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type="text"
                          name="viewerUsername"
                          value={formData.viewerUsername}
                          onChange={handleChange}
                          placeholder="e.g. greenvalley_A101"
                          className="w-full bg-gray-50 rounded-xl pl-10 pr-4 py-3 border-2 border-gray-100 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="viewerPassword"
                          value={formData.viewerPassword}
                          onChange={handleChange}
                          placeholder="Enter flat password"
                          className="w-full bg-gray-50 rounded-xl pl-10 pr-10 py-3 border-2 border-gray-100 focus:border-blue-500 focus:bg-white focus:outline-none transition-all"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading || loginSuccess}
                      className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold py-3 rounded-xl hover:shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : loginSuccess ? (
                        '✓ Welcome Home!'
                      ) : (
                        'Login as Resident'
                      )}
                    </motion.button>
                  </form>
                </motion.div>
              )}
            </AnimatePresence>

            {userType === 'admin' && (
              <p className="mt-6 text-center text-sm text-gray-600">
                Don&apos;t have an account?{' '}
                <Link to="/signup" className="font-medium text-green-600 hover:text-green-700 hover:underline">
                  Sign up
                </Link>
              </p>
            )}

            <p className={`text-center text-sm text-gray-500 ${userType === 'admin' ? 'mt-4' : 'mt-6'}`}>
              By signing in, you agree to our{' '}
              <Link to="/terms" className="text-green-600 hover:underline">Terms of Service</Link>
              {' '}and{' '}
              <Link to="/privacy" className="text-green-600 hover:underline">Privacy Policy</Link>
            </p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
