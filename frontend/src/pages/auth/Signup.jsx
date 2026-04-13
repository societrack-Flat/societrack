import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mail, Phone, Lock, User, ArrowRight, ArrowLeft,
  Eye, EyeOff, Building2, MapPin, CheckCircle,
  Shield, Zap, Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import BrandLogo from '../../components/BrandLogo';
import { supabase } from '../../lib/supabaseClient';

const Signup = () => {
  const { signUp, completeSetup, user, userProfile, profileLoaded } = useAuth();

  const isOAuthCompletion = !!(user && profileLoaded && !userProfile);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupSuccess, setSignupSuccess] = useState(false);

  const [formData, setFormData] = useState({
    name: user?.user_metadata?.full_name || user?.user_metadata?.name || '',
    email: user?.email || '',
    phone: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) setErrors({ ...errors, [name]: '' });
  };

  const validate = () => {
    const e = {};
    if (!formData.name.trim()) e.name = 'Name is required';
    const phoneRaw = (formData.phone || '').trim();
    const digits = phoneRaw.replace(/\D/g, '');
    if (!phoneRaw) e.phone = 'Phone number is required';
    else if (phoneRaw.startsWith('+')) {
      if (digits.length < 11 || digits.length > 15) e.phone = 'Phone number is invalid';
    } else if (digits.length !== 10) {
      e.phone = 'Enter a 10-digit phone number';
    }
    if (!isOAuthCompletion) {
      if (!formData.email.trim()) e.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = 'Email is invalid';
      if (!formData.password) e.password = 'Password is required';
      else if (formData.password.length < 8) e.password = 'Password must be at least 8 characters';
      if (formData.password !== formData.confirmPassword) e.confirmPassword = 'Passwords do not match';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      let result;
      if (isOAuthCompletion) {
        if (typeof completeSetup !== 'function') {
          toast.error('Complete setup is not available. Refresh the page and try again.');
          return;
        }
        result = await completeSetup({
          name: formData.name,
          phone: formData.phone,
        });
      } else {
        result = await signUp(formData.email, formData.password, {
          name: formData.name,
          phone: formData.phone,
        });
      }

      if (result?.success) {
        setSignupSuccess(true);
        if (isOAuthCompletion) {
          window.location.replace('/admin/dashboard');
        } else {
          // Full page navigation after sign-out so AuthContext isn't stuck with stale `user`
          // (PublicRoute used to show infinite Loading when user && !profileLoaded).
          (async () => {
            try {
              await supabase.auth.signOut();
            } catch {
              /* ignore */
            }
            window.location.replace('/login');
          })();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Building Construction Animation ──────────────────────────────────────
  const BuildingConstruction = () => {
    // Single-page signup: keep animation stable (no step-based flow).
    const step = 1;
    const winColor = (active) => signupSuccess ? '#fde68a' : active ? '#a7f3d0' : '#065f46';
    const floors = [
      'from-emerald-400 to-emerald-500',
      'from-emerald-500 to-emerald-600',
      'from-emerald-500 to-emerald-600',
      'from-emerald-600 to-emerald-700',
    ];
    return (
      <div className="relative w-full h-full flex items-end justify-center pb-2 overflow-hidden">
        {/* Ground glow */}
        <div className="absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-emerald-500/20 to-transparent" />
        {/* Ground line */}
        <motion.div
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="absolute bottom-2 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent origin-center"
        />

        {/* Single-step indicator */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-20">
          <motion.div
            animate={{ backgroundColor: '#22C55E', scale: 1.1 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
          ><User className="text-white" size={16} /></motion.div>
          <span className="text-sm font-semibold text-emerald-200">Create account</span>
        </div>

        {/* Crane */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute left-5 bottom-2"
        >
          <div className="relative" style={{ width: 10 }}>
            <div className="bg-gradient-to-b from-yellow-400 to-yellow-600 rounded-sm mx-auto" style={{ width: 10, height: 88 }} />
            <motion.div
              animate={{ rotate: 0 }}
              transition={{ duration: 2.5, repeat: 0, ease: 'easeInOut' }}
              className="absolute origin-left"
              style={{ top: 0, left: 10, width: 52, height: 3, background: '#eab308' }}
            >
              <motion.div
                animate={{ y: 0 }}
                transition={{ duration: 2, repeat: 0 }}
                className="absolute right-0 top-3 flex flex-col items-center"
              >
                <div style={{ width: 1, height: 18, background: '#9ca3af' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', border: '2px solid #9ca3af' }} />
              </motion.div>
            </motion.div>
          </div>
        </motion.div>

        {/* Buildings */}
        <div className="flex items-end gap-2 z-10 mb-2">
          {/* Side building */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 0.85 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <div className="rounded-t-lg overflow-hidden"
              style={{ width: 40, height: 65, background: 'linear-gradient(to bottom,#3b82f6,#2563eb)' }}>
              <div className="grid grid-cols-2 gap-1 p-1.5 pt-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{
                    height: 9, borderRadius: 2,
                    background: signupSuccess ? '#fde68a' : '#60a5fa',
                    opacity: signupSuccess ? 1 : 0.5, transition: 'all 0.4s'
                  }} />
                ))}
              </div>
            </div>
          </motion.div>

          {/* Main building */}
          <div className="relative" style={{ width: 80 }}>
            {/* Antenna */}
            <motion.div
              initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: 0.9 }}
              className="absolute -top-7 left-1/2 -translate-x-1/2 origin-bottom flex flex-col items-center"
            >
              <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 2, height: 16, background: '#6b7280' }} />
            </motion.div>

            {/* Floors */}
            {floors.map((gradient, fi) => {
              const show = true;
              const delay = 0.3 + fi * 0.2;
              return (
                <motion.div key={fi}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: show ? 0 : 20, opacity: show ? 1 : 0 }}
                  transition={{ duration: 0.5, delay: show ? delay : 0 }}
                  className={`bg-gradient-to-b ${gradient} relative overflow-hidden`}
                  style={{ height: 36, marginBottom: 1, borderRadius: fi === 3 ? '6px 6px 0 0' : 0 }}
                >
                  <div className="grid grid-cols-3 gap-1.5 px-2 pt-2">
                    {Array.from({ length: 3 }).map((_, wi) => (
                      <div key={wi} style={{
                        height: 12, borderRadius: 3,
                        background: winColor(show),
                        boxShadow: show && signupSuccess ? '0 0 6px 1px rgba(253,230,138,0.5)' : 'none',
                        transition: 'all 0.5s',
                      }} />
                    ))}
                  </div>
                </motion.div>
              );
            })}

            {/* Foundation */}
            <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.2 }}
              className="h-2 bg-gradient-to-r from-gray-500 via-gray-400 to-gray-500 origin-center" />

            {/* Door */}
            <motion.div initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
              transition={{ delay: 0.8, duration: 0.3 }}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 origin-bottom"
              style={{ width: 15, height: 20, background: '#064e3b', borderRadius: '3px 3px 0 0' }}
            >
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#fcd34d', margin: '6px auto 0' }} />
            </motion.div>
          </div>
        </div>

        {/* Tree */}
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0, type: 'spring' }}
          className="absolute bottom-2 right-8 text-2xl select-none">🌳</motion.div>

        {/* Success */}
        <AnimatePresence>
          {signupSuccess && (
            <>
              {[...Array(14)].map((_, i) => (
                <motion.div key={i}
                  initial={{ opacity: 1, y: 0, x: 0 }}
                  animate={{ opacity: [1, 1, 0], y: -100 - (i % 4) * 25, x: (i % 2 === 0 ? 1 : -1) * (15 + i * 10) }}
                  transition={{ duration: 1.8, delay: 0.1 + i * 0.08 }}
                  className="absolute bottom-20" style={{ left: `${25 + (i * 4)}%` }}
                >
                  <div style={{
                    width: 7, height: 7,
                    borderRadius: i % 2 === 0 ? '50%' : 2,
                    background: ['#22c55e', '#fbbf24', '#3b82f6', '#f43f5e', '#a855f7'][i % 5]
                  }} />
                </motion.div>
              ))}
              <motion.div
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-white/95 backdrop-blur-sm px-5 py-3 rounded-2xl shadow-2xl whitespace-nowrap z-30"
              >
                <div className="flex items-center gap-3">
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 0.5 }}
                    className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle className="text-green-500" size={20} />
                  </motion.div>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Welcome to Societrack!</p>
                    <p className="text-xs text-gray-500">Your apartment is ready...</p>
                  </div>
                </div>
              </motion.div>
              <motion.div className="absolute bottom-4 left-1/3 text-xl"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <motion.span animate={{ y: [0, -4, 0] }} transition={{ duration: 0.5, repeat: Infinity }}>🎉</motion.span>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: dark branding panel */}
      <motion.div
        initial={{ opacity: 0, x: -50 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative overflow-hidden"
      >
        <div className="absolute inset-0">
          <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-500/20 rounded-full blur-3xl animate-blob" />
          <div className="absolute bottom-20 right-20 w-72 h-72 bg-green-500/20 rounded-full blur-3xl animate-blob animation-delay-2000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl animate-blob animation-delay-4000" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <BrandLogo variant="onDark" size="lg" to="/" />
          </motion.div>

          {/* Tagline */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }} className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Build your
              <span className="block bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
                Community Today
              </span>
            </h1>
            <p className="text-slate-400 text-lg max-w-md">
              Start managing your apartment finances transparently in just 1 simple step
            </p>
            <div className="space-y-4 pt-4">
              {[
                { icon: Sparkles, text: '7-day free trial, no card required' },
                { icon: Shield, text: 'Bank-level security' },
                { icon: Zap, text: 'Setup in under 5 minutes' },
              ].map((item, index) => (
                <motion.div key={index}
                  initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.7 + index * 0.1 }}
                  className="flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <item.icon className="text-green-400" size={20} />
                  </div>
                  <span className="text-slate-300">{item.text}</span>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Building Animation */}
          <div className="h-72 relative">
            <BuildingConstruction />
          </div>
        </div>
      </motion.div>

      {/* Right: signup form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-gray-50">
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8 }}
          className="w-full max-w-md"
        >
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8 flex justify-center">
            <BrandLogo variant="dark" size="lg" to="/" />
          </div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 p-8"
          >
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">
                {isOAuthCompletion ? 'Complete your profile' : 'Create your account'}
              </h2>
              <p className="text-gray-500 mt-2">
                {isOAuthCompletion ? 'Just confirm your details to continue' : 'Enter your details to get started'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { label: 'Full Name', name: 'name', type: 'text', placeholder: 'Enter your full name', Icon: User },
                ...(!isOAuthCompletion ? [{ label: 'Email Address', name: 'email', type: 'email', placeholder: 'Enter your email', Icon: Mail }] : []),
                { label: 'Phone Number', name: 'phone', type: 'tel', placeholder: '+91 9876543210', Icon: Phone },
              ].map(({ label, name, type, placeholder, Icon }) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                  <div className="relative">
                    <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type={type}
                      name={name}
                      placeholder={placeholder}
                      value={formData[name]}
                      onChange={handleChange}
                      disabled={isOAuthCompletion && name === 'email'}
                      className={`w-full bg-gray-50 border-2 rounded-xl pl-12 pr-4 py-3.5 focus:outline-none focus:bg-white transition-all ${
                        errors[name] ? 'border-red-300 focus:border-red-500' : 'border-gray-100 focus:border-green-500'
                      }`}
                    />
                  </div>
                  {errors[name] && <p className="text-red-500 text-sm mt-1">{errors[name]}</p>}
                </div>
              ))}

              {!isOAuthCompletion && (
                <>
                  {[
                    { label: 'Password', name: 'password', placeholder: 'Create a password' },
                    { label: 'Confirm Password', name: 'confirmPassword', placeholder: 'Confirm your password' },
                  ].map(({ label, name, placeholder }) => (
                    <div key={name}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name={name}
                          placeholder={placeholder}
                          value={formData[name]}
                          onChange={handleChange}
                          className={`w-full bg-gray-50 border-2 rounded-xl pl-12 pr-12 py-3.5 focus:outline-none focus:bg-white transition-all ${
                            errors[name] ? 'border-red-300 focus:border-red-500' : 'border-gray-100 focus:border-green-500'
                          }`}
                        />
                        {name === 'password' && (
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                          </button>
                        )}
                      </div>
                      {errors[name] && <p className="text-red-500 text-sm mt-1">{errors[name]}</p>}
                    </div>
                  ))}
                </>
              )}

              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-5">
                <h4 className="font-semibold text-green-900 mb-3 flex items-center gap-2">
                  <Sparkles size={18} /> What happens next?
                </h4>
                <ul className="space-y-2">
                  {['7-day free trial starts immediately', 'No credit card required', 'Full access to all features', 'You can edit apartment details later'].map((item, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.08 * i }}
                      className="flex items-center gap-2 text-sm text-green-700"
                    >
                      <CheckCircle size={16} className="text-green-500" /> {item}
                    </motion.li>
                  ))}
                </ul>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading || signupSuccess}
                className="w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-green-500/30 flex items-center justify-center gap-2 disabled:opacity-70"
              >
                {loading ? (
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : signupSuccess ? (
                  <><CheckCircle size={20} /> Account Created!</>
                ) : (
                  <>Create Account <ArrowRight size={20} /></>
                )}
              </motion.button>
            </form>

            <p className="mt-8 text-center text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-green-600 hover:text-green-700 font-semibold">Sign in</Link>
            </p>
          </motion.div>

          <p className="mt-6 text-center text-sm text-gray-500">
            By signing up, you agree to our{' '}
            <a href="#" className="text-green-600 hover:underline">Terms of Service</a>
            {' '}and{' '}
            <a href="#" className="text-green-600 hover:underline">Privacy Policy</a>
          </p>
        </motion.div>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
      `}</style>
    </div>
  );
};

export default Signup;
