import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import BrandLogo from '../components/BrandLogo';
import {
  IndianRupee,
  Receipt,
  Clock,
  Shield,
  BarChart3,
  Users,
  Check,
  ArrowRight,
  Building2,
  Mail,
  Phone,
  ChevronDown,
  Sparkles,
  TrendingUp,
  Bell,
  FileText,
  CreditCard,
  Zap,
  Play,
  Menu,
  X,
  Twitter,
  Facebook,
  Linkedin,
  Instagram,
} from 'lucide-react';

const socialIcons = {
    twitter: Twitter,
    facebook: Facebook,
    linkedin: Linkedin,
    instagram: Instagram,
  };

  const Landing = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll();
  const y = useTransform(scrollYProgress, [0, 1], ['0%', '50%']);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const stats = [
    { number: '5+', label: 'Apartments', icon: Building2 },
    { number: '150+', label: 'Users', icon: Users },
    { number: '45', label: 'Days Free Trial', icon: Clock },
    { number: '99.9%', label: 'Uptime', icon: TrendingUp },
  ];

  const fadeInUp = {
    hidden: { opacity: 0, y: 60 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const fadeInLeft = {
    hidden: { opacity: 0, x: -60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const fadeInRight = {
    hidden: { opacity: 0, x: 60 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.6, ease: 'easeOut' } },
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.1 },
    },
  };

  const scaleIn = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: 'easeOut' } },
  };

  const features = [
    {
      icon: IndianRupee,
      title: 'Income Tracking',
      description: 'Record and track all maintenance payments, rental income, and other sources of revenue with ease.',
      color: 'from-green-500 to-emerald-600',
      bgColor: 'bg-green-50',
    },
    {
      icon: Receipt,
      title: 'Expense Management',
      description: 'Manage all apartment expenses with categorization, bill attachments, and detailed reporting.',
      color: 'from-red-500 to-rose-600',
      bgColor: 'bg-red-50',
    },
    {
      icon: Clock,
      title: 'Maintenance Tracking',
      description: 'Track pending maintenance payments, send reminders, and manage collections efficiently.',
      color: 'from-amber-500 to-orange-600',
      bgColor: 'bg-amber-50',
    },
    {
      icon: BarChart3,
      title: 'Financial Reports',
      description: 'Generate comprehensive financial reports with PDF and Excel export capabilities.',
      color: 'from-blue-500 to-indigo-600',
      bgColor: 'bg-blue-50',
    },
    {
      icon: Users,
      title: 'Resident Access',
      description: 'Give residents read-only access to view financial data and announcements transparently.',
      color: 'from-purple-500 to-violet-600',
      bgColor: 'bg-purple-50',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description: 'Bank-level security with role-based access control to protect your financial data.',
      color: 'from-slate-600 to-slate-800',
      bgColor: 'bg-slate-50',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Sign Up & Setup',
      description: 'Create your account, add your apartment details, and configure your flats in minutes.',
      icon: Building2,
    },
    {
      number: '02',
      title: 'Record Transactions',
      description: 'Start recording income and expenses with easy-to-use forms and bulk operations.',
      icon: FileText,
    },
    {
      number: '03',
      title: 'Review & Share',
      description: 'Generate reports, track pending payments, and share access with residents.',
      icon: TrendingUp,
    },
  ];

  const plans = [
    {
      name: 'Complete',
      price: '499',
      period: '/month',
      description: 'All features for apartment societies',
      features: [
        'Unlimited flats',
        'Income & Expense tracking',
        'Advanced reports & analytics',
        'Resident viewer access',
        'Bulk operations',
        'Priority support',
        'Announcement system',
        'Custom categories',
        'Maintenance tracking',
        'Pending management reports',
        'File attachments',
        'Email notifications',
        'Data export',
        'Mobile responsive',
        'Secure backups',
      ],
      popular: true,
      gradient: 'from-green-500 to-emerald-600',
    },
  ];

  const AnimatedSection = ({ children, className = '' }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-100px' });

    return (
      <motion.div
        ref={ref}
        initial="hidden"
        animate={isInView ? 'visible' : 'hidden'}
        variants={fadeInUp}
        className={className}
      >
        {children}
      </motion.div>
    );
  };

  const CountUp = ({ end, suffix = '' }) => {
    const [count, setCount] = useState(0);
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true });

    useEffect(() => {
      if (isInView) {
        const duration = 2000;
        const steps = 60;
        const increment = end / steps;
        let current = 0;
        const timer = setInterval(() => {
          current += increment;
          if (current >= end) {
            setCount(end);
            clearInterval(timer);
          } else {
            setCount(Math.floor(current));
          }
        }, duration / steps);
        return () => clearInterval(timer);
      }
    }, [isInView, end]);

    return <span ref={ref}>{count}{suffix}</span>;
  };

  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      {/* Animated Background Gradient */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-green-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob" />
        <div className="absolute top-40 -left-40 w-96 h-96 bg-emerald-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000" />
        <div className="absolute bottom-40 right-40 w-96 h-96 bg-teal-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-4000" />
      </div>

      {/* Header */}
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.6 }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white/90 backdrop-blur-lg shadow-lg' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link to="/" className="inline-flex">
                <BrandLogo variant="landing" size="lg" />
              </Link>
            </motion.div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {['Features', 'How it Works', 'Pricing', 'Contact'].map((item) => (
                <a
                  key={item}
                  href={`#${item.toLowerCase().replace(' ', '-')}`}
                  className="text-gray-600 hover:text-green-600 font-medium transition-colors relative group"
                >
                  {item}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-green-500 group-hover:w-full transition-all duration-300" />
                </a>
              ))}
            </nav>

            <div className="hidden md:flex items-center gap-4">
              <Link to="/login">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2.5 text-gray-700 font-medium hover:text-green-600 transition-colors"
                >
                  Login
                </motion.button>
              </Link>
              <Link to="/signup">
                <motion.button
                  whileHover={{ scale: 1.05, boxShadow: '0 20px 40px rgba(34, 197, 94, 0.3)' }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-full shadow-lg shadow-green-500/30 flex items-center gap-2"
                >
                  Start 45-Days Free Trial
                  <ArrowRight size={18} />
                </motion.button>
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="md:hidden p-2"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <motion.div
          initial={false}
          animate={{ height: isMenuOpen ? 'auto' : 0, opacity: isMenuOpen ? 1 : 0 }}
          className="md:hidden overflow-hidden bg-white border-t"
        >
          <div className="px-4 py-6 space-y-4">
            {['Features', 'How it Works', 'Pricing', 'Contact'].map((item) => (
              <a
                key={item}
                href={`#${item.toLowerCase().replace(' ', '-')}`}
                className="block text-gray-600 hover:text-green-600 font-medium py-2"
                onClick={() => setIsMenuOpen(false)}
              >
                {item}
              </a>
            ))}
            <div className="pt-4 flex flex-col gap-3">
              <Link to="/login" className="w-full">
                <button className="w-full py-3 text-gray-700 font-medium border border-gray-200 rounded-xl">
                  Login
                </button>
              </Link>
              <Link to="/signup" className="w-full">
                <button className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl">
                  Start 45-Days Free Trial
                </button>
              </Link>
            </div>
          </div>
        </motion.div>
      </motion.header>

      {/* Hero Section */}
      <section ref={heroRef} className="relative pt-32 pb-20 lg:pt-44 lg:pb-32 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-6"
              >
                <Sparkles size={16} />
                <span>Trusted by 500+ apartment societies</span>
              </motion.div>

              <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold text-gray-900 leading-tight">
                <span className="block mb-2">Transform Your</span>
                <span className="bg-gradient-to-r from-green-500 via-emerald-500 to-teal-500 bg-clip-text text-transparent">
                  Apartment Management
                </span>
              </h1>

              <p className="mt-6 text-xl text-gray-600 leading-relaxed max-w-xl">
                The all-in-one financial management platform designed for modern apartment societies. 
                <span className="block mt-2 text-green-600 font-semibold">Track expenses, manage maintenance, and keep residents informed - all in one place.</span>
              </p>

              <div className="mt-10 flex flex-col sm:flex-row gap-4">
                <Link to="/signup">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 25px 50px rgba(34, 197, 94, 0.4)' }}
                    whileTap={{ scale: 0.95 }}
                    className="px-8 py-4 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-2xl shadow-xl shadow-green-500/30 flex items-center justify-center gap-2 w-full sm:w-auto"
                  >
                    Start 45-Days Free Trial
                    <ArrowRight size={20} />
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-8 py-4 bg-white border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl flex items-center justify-center gap-2 hover:border-green-500 hover:text-green-600 transition-colors w-full sm:w-auto"
                >
                  <Play size={20} className="fill-current" />
                  Watch Demo
                </motion.button>
              </div>

            </motion.div>

            {/* Hero Image/Dashboard Preview */}
            <motion.div
              initial={{ opacity: 0, x: 60 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.4 }}
              className="relative"
            >
              <div className="relative">
                {/* Floating Elements */}
                <motion.div
                  animate={{ y: [0, -20, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="absolute -top-8 -left-8 bg-white rounded-2xl shadow-xl p-4 z-10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                      <IndianRupee className="text-green-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Monthly Income</p>
                      <p className="text-xl font-bold text-gray-900">₹4,25,000</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, 20, 0] }}
                  transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                  className="absolute -bottom-4 -right-4 bg-white rounded-2xl shadow-xl p-4 z-10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Building2 className="text-blue-600" size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Total Flats</p>
                      <p className="text-xl font-bold text-gray-900">248</p>
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
                  className="absolute top-1/2 -right-12 bg-white rounded-2xl shadow-xl p-3 z-10"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                      <Check className="text-emerald-600" size={16} />
                    </div>
                    <p className="text-sm font-medium text-gray-700">Maintenance Paid</p>
                  </div>
                </motion.div>

                {/* Main Dashboard Card */}
                <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl p-6 shadow-2xl">
                  <div className="flex items-center justify-between mb-6 gap-2">
                    <div className="min-w-0">
                      <BrandLogo variant="onDark" size="xs" />
                      <p className="text-slate-400 text-xs mt-1.5">Dashboard</p>
                    </div>
                    <Bell className="text-slate-400 shrink-0" size={20} />
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-slate-700/50 rounded-2xl p-4">
                      <p className="text-slate-400 text-sm">Income</p>
                      <p className="text-2xl font-bold text-green-400">₹8.5L</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp size={14} className="text-green-400" />
                        <span className="text-green-400 text-xs">+12.5%</span>
                      </div>
                    </div>
                    <div className="bg-slate-700/50 rounded-2xl p-4">
                      <p className="text-slate-400 text-sm">Expenses</p>
                      <p className="text-2xl font-bold text-red-400">₹3.2L</p>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp size={14} className="text-red-400" />
                        <span className="text-red-400 text-xs">-5.2%</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-700/50 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-white font-medium">Maintenance Status</p>
                      <span className="text-green-400 text-sm">85% Collected</span>
                    </div>
                    <div className="w-full bg-slate-600 rounded-full h-3">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: '85%' }}
                        transition={{ duration: 1.5, delay: 1 }}
                        className="bg-gradient-to-r from-green-400 to-emerald-400 h-3 rounded-full"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:block"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-gray-400"
          >
            <span className="text-sm">Scroll to explore</span>
            <ChevronDown size={24} />
          </motion.div>
        </motion.div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className="grid grid-cols-2 lg:grid-cols-4 gap-8"
          >
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={index}
                  variants={scaleIn}
                  className="text-center"
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/30">
                    <Icon className="text-white" size={28} />
                  </div>
                  <p className="text-4xl font-bold text-white mb-1">
                    {stat.number.includes('+') ? (
                      <>
                        <CountUp end={parseInt(stat.number)} />
                        {stat.number.includes('K') ? 'K' : ''}+
                      </>
                    ) : stat.number.includes('%') ? (
                      <>
                        <CountUp end={parseFloat(stat.number)} suffix="%" />
                      </>
                    ) : (
                      stat.number
                    )}
                  </p>
                  <p className="text-slate-400">{stat.label}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium mb-4">
              Features
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              Everything you need to manage
              <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent"> apartment finances</span>
            </h2>
            <p className="mt-4 text-xl text-gray-600 max-w-2xl mx-auto">
              A complete solution designed specifically for apartment societies and housing communities.
            </p>
          </AnimatedSection>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-100px' }}
            variants={staggerContainer}
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-8"
          >
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={index}
                  variants={fadeInUp}
                  whileHover={{ y: -10, transition: { duration: 0.3 } }}
                  className="group relative bg-white p-8 rounded-3xl border border-gray-100 hover:border-transparent hover:shadow-2xl transition-all duration-500"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative">
                    <div className={`w-14 h-14 ${feature.bgColor} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                      <Icon className={`bg-gradient-to-r ${feature.color} bg-clip-text`} size={28} style={{ color: feature.color.includes('green') ? '#22c55e' : feature.color.includes('red') ? '#ef4444' : feature.color.includes('amber') ? '#f59e0b' : feature.color.includes('blue') ? '#3b82f6' : feature.color.includes('purple') ? '#a855f7' : '#475569' }} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
                    <p className="text-gray-600 leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* How it Works Section */}
      <section id="how-it-works" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
              How it Works
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              Get started in <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">3 simple steps</span>
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Up and running in less than 10 minutes
            </p>
          </AnimatedSection>

          <div className="relative">
            {/* Connection Line */}
            <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-1 bg-gradient-to-r from-green-200 via-blue-200 to-purple-200 -translate-y-1/2" />

            <motion.div
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={staggerContainer}
              className="grid md:grid-cols-3 gap-8 relative"
            >
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <motion.div
                    key={index}
                    variants={fadeInUp}
                    className="relative"
                  >
                    <div className="bg-white p-8 rounded-3xl shadow-xl hover:shadow-2xl transition-shadow duration-300 relative z-10">
                      <div className="absolute -top-6 left-8 w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                        {step.number}
                      </div>
                      <div className="mt-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-slate-100 to-slate-200 rounded-2xl flex items-center justify-center mb-6">
                          <Icon className="text-slate-600" size={32} />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{step.title}</h3>
                        <p className="text-gray-600">{step.description}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <AnimatedSection className="text-center mb-16">
            <span className="inline-block px-4 py-2 bg-emerald-100 text-emerald-700 rounded-full text-sm font-medium mb-4">
              Pricing
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900">
              Simple, transparent <span className="bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">pricing</span>
            </h2>
            <p className="mt-4 text-xl text-gray-600">
              Choose the plan that fits your community size
            </p>
          </AnimatedSection>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={staggerContainer}
            className={`grid gap-8 max-w-5xl mx-auto items-stretch ${
              plans.length === 1 ? 'md:grid-cols-1 justify-items-center' : 'md:grid-cols-3'
            }`}
          >
            {plans.map((plan, index) => (
              <motion.div
                key={index}
                variants={scaleIn}
                whileHover={{ y: -10, transition: { duration: 0.3 } }}
                className={`relative bg-white rounded-3xl p-8 ${
                  plan.popular
                    ? 'border-2 border-green-500 shadow-2xl shadow-green-500/20 scale-105'
                    : 'border border-gray-200 shadow-lg'
                } ${plans.length === 1 ? 'w-full max-w-xl' : ''}`}
              >
                {plan.popular && (
                  <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                    <span className="bg-gradient-to-r from-green-500 to-emerald-600 text-white text-sm font-semibold px-6 py-2 rounded-full shadow-lg">
                      Most Popular
                    </span>
                  </div>
                )}
                
                <div className="text-center mb-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-xl font-semibold text-gray-900">₹</span>
                    <span className="text-5xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-gray-500">{plan.period}</span>
                  </div>
                  <p className="mt-2 text-gray-600">{plan.description}</p>
                </div>

                <ul className="space-y-4 mb-8 md:columns-2 md:gap-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3 break-inside-avoid">
                      <div className={`w-6 h-6 rounded-full bg-gradient-to-r ${plan.gradient} flex items-center justify-center flex-shrink-0`}>
                        <Check size={14} className="text-white" />
                      </div>
                      <span className="text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Link to="/signup">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-4 rounded-2xl font-semibold transition-all duration-300 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg shadow-green-500/30 hover:shadow-xl hover:shadow-green-500/40'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    Start 45-Days Free Trial
                  </motion.button>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="relative overflow-hidden bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 rounded-3xl p-12 lg:p-16 text-center"
          >
            {/* Animated Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0" style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }} />
            </div>

            <div className="relative">
              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6"
              >
                Ready to simplify your apartment finances?
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3 }}
                className="text-xl text-green-100 mb-10 max-w-2xl mx-auto"
              >
                Join hundreds of apartment communities already using Societrack to manage their finances transparently.
              </motion.p>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex flex-col sm:flex-row gap-4 justify-center"
              >
                <Link to="/signup">
                  <motion.button
                    whileHover={{ scale: 1.05, boxShadow: '0 25px 50px rgba(0, 0, 0, 0.3)' }}
                    whileTap={{ scale: 0.95 }}
                    className="px-10 py-4 bg-white text-green-600 font-bold rounded-2xl shadow-xl flex items-center justify-center gap-2"
                  >
                    Start 45-Days Free Trial
                    <ArrowRight size={20} />
                  </motion.button>
                </Link>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-10 py-4 bg-transparent border-2 border-white text-white font-semibold rounded-2xl flex items-center justify-center gap-2"
                >
                  <Phone size={20} />
                  Schedule a Demo
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer id="contact" className="bg-slate-900 text-white py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div className="lg:col-span-1">
              <div className="mb-6">
                <BrandLogo variant="footer" size="lg" />
              </div>
              <p className="text-slate-400 leading-relaxed mb-6">
                Simplifying apartment finance management with transparent, easy-to-use tools for societies of all sizes.
              </p>
              <div className="flex gap-4">
                {Object.entries(socialIcons).map(([social, Icon]) => (
                    <a
                      key={social}
                      href={social === 'instagram' ? 'https://www.instagram.com/societrack?igsh=cjUwdXFwYTRjYTAz' : `#${social}`}
                      className="w-10 h-10 bg-slate-800 rounded-lg flex items-center justify-center hover:bg-green-500 transition-colors"
                    >
                      <Icon size={18} className="text-slate-400" />
                    </a>
                  ))}
              </div>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-6">Product</h4>
              <ul className="space-y-4">
                {['Features', 'Pricing', 'Integrations', 'Updates'].map((item) => (
                  <li key={item}>
                    <a href={`#${item.toLowerCase()}`} className="text-slate-400 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-6">Company</h4>
              <ul className="space-y-4">
                {['About', 'Blog', 'Careers', 'Press'].map((item) => (
                  <li key={item}>
                    <a href={`#${item.toLowerCase()}`} className="text-slate-400 hover:text-white transition-colors">
                      {item}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-6">Contact</h4>
              <ul className="space-y-4">
                <li>
                  <a href="mailto:support@societrack.com" className="text-slate-400 hover:text-white transition-colors flex items-center gap-3">
                    <Mail size={18} />
                    support@societrack.com
                  </a>
                </li>
                <li>
                  <a href="tel:+918142112121" className="text-slate-400 hover:text-white transition-colors flex items-center gap-3">
                    <Phone size={18} />
                    +91 8142112121
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-400 text-sm">
              © 2026 Societrack. All rights reserved.
            </p>
            <div className="flex gap-6">
              <Link to="/privacy" className="text-slate-400 hover:text-white text-sm transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="text-slate-400 hover:text-white text-sm transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* CSS for blob animation */}
      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
};

export default Landing;
