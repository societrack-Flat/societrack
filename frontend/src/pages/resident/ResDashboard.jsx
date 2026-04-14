import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { IndianRupee, TrendingUp, TrendingDown, Clock, BarChart3, ArrowRight, Calendar, FileText, Plus, Megaphone } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, getSignedUrl, formatDate } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import toast from 'react-hot-toast';
import MonthlyIncomeExpenseChart from '../../components/MonthlyIncomeExpenseChart';

const DASHBOARD_STATS_MS = 20000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DASHBOARD_STATS_TIMEOUT')), ms);
    }),
  ]);
}

/** Chart + stat cards: same range semantics as MonthlyIncomeExpenseChart */
function getRangeBounds(timeRange, customFrom, customTo) {
  const now = new Date();
  let from = null;
  let to = null;
  if (timeRange === 'month') {
    const m = now.getMonth() + 1;
    const y = now.getFullYear();
    from = `${y}-${String(m).padStart(2, '0')}-01`;
    to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  } else if (timeRange === 'custom') {
    if (customFrom) from = customFrom;
    if (customTo) {
      const d = new Date(customTo);
      d.setDate(d.getDate() + 1);
      to = d.toISOString().split('T')[0];
    }
  }
  return { from, to };
}

const StatCard = ({ icon: Icon, label, value, subValue, gradient, iconBg, iconColor }) => (
  <div className={`rounded-2xl p-6 shadow-sm min-h-[140px] flex flex-col ${gradient}`}>
    <div className="flex items-center justify-between mb-4 shrink-0">
      <div className={`p-2.5 rounded-xl ${iconBg}`}>
        <Icon className={iconColor} size={22} />
      </div>
    </div>
    <p className="text-sm font-medium text-gray-500">{label}</p>
    <p className="text-2xl font-bold text-gray-900 mt-1 break-all">{value}</p>
    {subValue && (
      <p className="text-xs text-gray-500 mt-1 leading-snug line-clamp-2 break-words" title={typeof subValue === 'string' ? subValue : ''}>
        {subValue}
      </p>
    )}
  </div>
);

const ResDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [recentIncome, setRecentIncome] = useState([]);
  const [recentExpenses, setRecentExpenses] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartItems, setChartItems] = useState([]);
  const [announcementPreview, setAnnouncementPreview] = useState([]);
  const [timeRange, setTimeRange] = useState('all'); // all | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [stats, setStats] = useState({
    totalIncomeThisMonth: 0,
    totalExpensesThisMonth: 0,
    currentBalance: 0,
    maintenanceCollected: 0,
    maintenancePending: 0,
    totalFlats: 0,
    totalIncome: 0,
    totalExpenses: 0,
    otherMaintenanceOnFlats: 0,
    openingBalance: 0,
    totalFlatPendingMaintenance: 0,
  });

  const { apartment, userProfile, checkSubscription, profileLoaded, residentApartmentId } = useAuth();

  const residentFirstName = () => {
    const n = userProfile?.name?.split(' ')[0];
    if (n) return n;
    try {
      const s = JSON.parse(localStorage.getItem('resident_session') || '{}');
      return s.username || 'Resident';
    } catch {
      return 'Resident';
    }
  };

  useEffect(() => {
    if (selectedApartmentId) {
      fetchDashboardStats();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [selectedApartmentId, profileLoaded, timeRange, customFrom, customTo]);

  useEffect(() => {
    const aid = apartment?.id || residentApartmentId;
    if (aid) setSelectedApartmentId(aid);
  }, [apartment, residentApartmentId]);

  useEffect(() => {
    if (!selectedApartmentId) return;
    fetchChartAndTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedApartmentId, timeRange, customFrom, customTo]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const currentMonth = now.getMonth() + 1;
      const currentYear = now.getFullYear();

      const { from, to } = getRangeBounds(timeRange, customFrom, customTo);

      let periodIncomeQ = supabase.from('income').select('amount').eq('apartment_id', selectedApartmentId);
      let periodExpenseQ = supabase.from('expenses').select('amount').eq('apartment_id', selectedApartmentId);
      if (from) {
        periodIncomeQ = periodIncomeQ.gte('date', from);
        periodExpenseQ = periodExpenseQ.gte('date', from);
      }
      if (to) {
        periodIncomeQ = periodIncomeQ.lt('date', to);
        periodExpenseQ = periodExpenseQ.lt('date', to);
      }

      const [
        { data: flatRows },
        { data: periodIncomeRows },
        { data: periodExpenseRows },
        { data: totalIncomeData },
        { data: totalExpensesData },
        { data: maintenancePaidData },
        { data: maintenancePendingData },
        { data: recentIncomeData },
        { data: recentExpenseData },
        { data: aptOpeningRow },
      ] = await withTimeout(
        Promise.all([
          supabase
            .from('flats')
            .select('id, monthly_maintenance, pending_maintenance, other_maintenance')
            .eq('apartment_id', selectedApartmentId),
          periodIncomeQ,
          periodExpenseQ,
          supabase.from('income').select('amount').eq('apartment_id', selectedApartmentId),
          supabase.from('expenses').select('amount').eq('apartment_id', selectedApartmentId),
          supabase.from('maintenance').select('paid_amount').eq('apartment_id', selectedApartmentId).eq('month', currentMonth).eq('year', currentYear).eq('status', 'paid'),
          supabase.from('maintenance').select('amount').eq('apartment_id', selectedApartmentId).eq('month', currentMonth).eq('year', currentYear).eq('status', 'pending'),
          supabase.from('income').select('*').eq('apartment_id', selectedApartmentId).order('date', { ascending: false }).limit(4),
          supabase.from('expenses').select('*').eq('apartment_id', selectedApartmentId).order('date', { ascending: false }).limit(4),
          supabase.from('apartments').select('opening_balance').eq('id', selectedApartmentId).maybeSingle(),
        ]),
        DASHBOARD_STATS_MS
      );

      let announcementRows = [];
      const { data: ann, error: annErr } = await supabase
        .from('announcements')
        .select('id, title, message, priority, created_at')
        .eq('apartment_id', selectedApartmentId)
        .order('created_at', { ascending: false })
        .limit(4);
      if (!annErr) announcementRows = ann || [];

      const flatsList = flatRows || [];
      const totalFlats = flatsList.length;
      const totalFlatPendingMaintenance = flatsList.reduce((s, row) => {
        const m = Number(row?.monthly_maintenance ?? 0);
        const p = Number(row?.pending_maintenance ?? 0);
        return s + m + p;
      }, 0);
      const otherMaintenanceOnFlats = flatsList.reduce((s, row) => s + Number(row?.other_maintenance ?? 0), 0) || 0;
      const openingBal = Number(aptOpeningRow?.opening_balance ?? 0);

      const periodIncome = periodIncomeRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodExpense = periodExpenseRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const allIncomeSum = totalIncomeData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const allExpenseSum = totalExpensesData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodNetIncomeExpense = periodIncome - periodExpense;

      setRecentIncome(recentIncomeData || []);
      setRecentExpenses(recentExpenseData || []);
      setAnnouncementPreview(announcementRows || []);

      setStats({
        totalIncomeThisMonth: periodIncome,
        totalExpensesThisMonth: periodExpense,
        totalIncome: allIncomeSum,
        totalExpenses: allExpenseSum,
        currentBalance: timeRange === 'all' ? openingBal + periodNetIncomeExpense : periodNetIncomeExpense,
        openingBalance: openingBal,
        maintenanceCollected: maintenancePaidData?.reduce((s, i) => s + Number(i.paid_amount), 0) || 0,
        maintenancePending: maintenancePendingData?.reduce((s, i) => s + Number(i.amount), 0) || 0,
        totalFlats,
        totalFlatPendingMaintenance,
        otherMaintenanceOnFlats,
      });
    } catch (error) {
      const isTimeout = String(error?.message) === 'DASHBOARD_STATS_TIMEOUT';
      if (isTimeout) {
        console.warn('[Dashboard] fetchDashboardStats timed out', {
          apartmentId: apartment?.id,
          hypothesisId: 'H-R1',
        });
        toast.error('Dashboard took too long. Check your connection and try again.');
      } else {
        console.error('Error fetching dashboard stats:', error);
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchChartAndTransactions = async () => {
    try {
      const now = new Date();

      let from = null;
      let to = null;
      if (timeRange === 'month') {
        const m = now.getMonth() + 1;
        const y = now.getFullYear();
        from = `${y}-${String(m).padStart(2, '0')}-01`;
        to = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
      } else if (timeRange === 'custom') {
        if (customFrom) from = customFrom;
        if (customTo) {
          // treat customTo as inclusive end date in UI; convert to exclusive by +1 day
          const d = new Date(customTo);
          d.setDate(d.getDate() + 1);
          to = d.toISOString().split('T')[0];
        }
      }

      const buildQuery = (table) => {
        let q = supabase.from(table).select('date,amount,category,description,payment_mode').eq('apartment_id', selectedApartmentId);
        if (from) q = q.gte('date', from);
        if (to) q = q.lt('date', to);
        return q;
      };

      const [{ data: incomeRows }, { data: expenseRows }] = await Promise.all([
        buildQuery('income'),
        buildQuery('expenses'),
      ]);

      // Chart buckets (YYYY-MM)
      const buckets = new Map();
      const add = (ym, type, amt) => {
        if (!buckets.has(ym)) buckets.set(ym, { month: ym, income: 0, expense: 0 });
        buckets.get(ym)[type] += amt;
      };

      (incomeRows || []).forEach((r) => {
        const ym = (r.date || '').slice(0, 7);
        if (!ym) return;
        add(ym, 'income', Number(r.amount || 0));
      });
      (expenseRows || []).forEach((r) => {
        const ym = (r.date || '').slice(0, 7);
        if (!ym) return;
        add(ym, 'expense', Number(r.amount || 0));
      });

      const items = Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month));
      const last12 = items.slice(-12);
      setChartItems(last12);

      // Last 30 days (all types) — for sidebar with View Bill
      const since = new Date();
      since.setDate(since.getDate() - 30);
      const from30 = since.toISOString().split('T')[0];

      const [{ data: inc30 }, { data: exp30 }] = await Promise.all([
        supabase
          .from('income')
          .select('id,date,amount,category,description,payment_mode,attachment_url')
          .eq('apartment_id', selectedApartmentId)
          .gte('date', from30),
        supabase
          .from('expenses')
          .select('id,date,amount,category,description,payment_mode,attachment_url')
          .eq('apartment_id', selectedApartmentId)
          .gte('date', from30),
      ]);

      const tx = [
        ...(inc30 || []).map((r) => ({
          kind: 'income',
          id: r.id,
          type: 'Income',
          title: r.description || r.category || 'Income',
          amount: Number(r.amount || 0),
          date: r.date,
          paymentMode: r.payment_mode || '-',
          attachmentUrl: r.attachment_url || null,
          sortKey: `${r.date || ''}-1-${r.id}`,
        })),
        ...(exp30 || []).map((r) => ({
          kind: 'expense',
          id: r.id,
          type: 'Expense',
          title: r.description || r.category || 'Expense',
          amount: Number(r.amount || 0),
          date: r.date,
          paymentMode: r.payment_mode || '-',
          attachmentUrl: r.attachment_url || null,
          sortKey: `${r.date || ''}-0-${r.id}`,
        })),
      ]
        .sort((a, b) => (b.sortKey || '').localeCompare(a.sortKey || ''))
        .slice(0, 25);

      setRecentTransactions(tx);
    } catch (e) {
      console.error('Failed to load chart/transactions', e);
    }
  };

  const subscription = userProfile ? checkSubscription() : { valid: true, status: null, daysLeft: null };

  const incomeStatLabel =
    timeRange === 'all' ? 'Total Income' : timeRange === 'month' ? 'Income (this month)' : 'Income (period)';
  const expenseStatLabel =
    timeRange === 'all' ? 'Total Expenses' : timeRange === 'month' ? 'Expenses (this month)' : 'Expenses (period)';
  const netStatLabel =
    timeRange === 'all'
      ? 'Net (all time, incl. opening)'
      : timeRange === 'month'
        ? 'Net (this month)'
        : 'Net (period)';

  const periodNet =
    timeRange === 'all'
      ? stats.openingBalance + stats.totalIncomeThisMonth - stats.totalExpensesThisMonth
      : stats.totalIncomeThisMonth - stats.totalExpensesThisMonth;

  const handleViewBill = async (attachmentUrl) => {
    if (!attachmentUrl) return;
    try {
      const url = await getSignedUrl(attachmentUrl);
      if (url) window.open(url, '_blank');
    } catch (e) {
      console.error(e);
      toast.error('Could not open bill');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role="resident" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Dashboard" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">

          {loading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading dashboard…</p>
            </div>
          ) : (
            <>
              {userProfile && subscription?.status === 'trial' && subscription?.daysLeft <= 3 && (
                <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 mb-6 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                      <Clock className="text-amber-600" size={20} />
                    </div>
                    <div>
                      <p className="font-semibold text-amber-900">Trial ends in {subscription?.daysLeft} days</p>
                      <p className="text-sm text-amber-700">Subscribe to keep access to all features</p>
                    </div>
                  </div>
                  <Link to="/subscribe" className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium whitespace-nowrap transition-colors">
                    Subscribe Now
                  </Link>
                </div>
              )}

              <div className="bg-gradient-to-r from-slate-700 via-slate-600 to-slate-700 rounded-xl p-4 mb-4 text-white relative overflow-hidden border border-slate-600/50">
                <div className="absolute top-0 right-0 w-48 h-48 bg-lime-400/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-0.5">
                    <div className="w-1.5 h-1.5 bg-lime-300 rounded-full animate-pulse" />
                    <span className="text-lime-200/90 text-xs font-medium">{apartment?.name}</span>
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold">Welcome back, {residentFirstName()}!</h1>
                  <p className="text-slate-300 mt-0.5 text-xs">Society financial summary (read-only)</p>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium text-gray-500">Period</span>
                  <select
                    value={timeRange}
                    onChange={(e) => setTimeRange(e.target.value)}
                    className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-lime-400"
                  >
                    <option value="all">All Time</option>
                    <option value="month">This Month</option>
                    <option value="custom">Custom</option>
                  </select>
                  {timeRange === 'custom' && (
                    <>
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="date"
                          value={customFrom}
                          onChange={(e) => setCustomFrom(e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                        />
                      </div>
                      <div className="relative">
                        <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                        <input
                          type="date"
                          value={customTo}
                          onChange={(e) => setCustomTo(e.target.value)}
                          className="bg-white border border-gray-200 rounded-lg pl-7 pr-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-lime-400"
                        />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link
                    to="/resident/income"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-emerald-900 bg-emerald-100 border border-emerald-200/80"
                  >
                    <Plus size={16} />
                    Income
                  </Link>
                  <Link
                    to="/resident/expenses"
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs sm:text-sm font-semibold text-rose-800 bg-rose-50 border border-rose-200/90"
                  >
                    <Plus size={16} />
                    Expenses
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                <StatCard icon={TrendingUp} label={incomeStatLabel} value={formatCurrency(stats.totalIncomeThisMonth)} gradient="bg-white border border-lime-200/80" iconBg="bg-lime-100" iconColor="text-lime-700" />
                <StatCard icon={TrendingDown} label={expenseStatLabel} value={formatCurrency(stats.totalExpensesThisMonth)} gradient="bg-white border border-rose-200/80" iconBg="bg-rose-100" iconColor="text-rose-700" />
                <StatCard icon={IndianRupee} label={netStatLabel} value={formatCurrency(periodNet)} subValue={periodNet >= 0 ? 'Surplus' : 'Deficit'} gradient={`bg-white border ${periodNet >= 0 ? 'border-sky-200' : 'border-amber-200'}`} iconBg={periodNet >= 0 ? 'bg-sky-100' : 'bg-amber-100'} iconColor={periodNet >= 0 ? 'text-sky-700' : 'text-amber-800'} />
                <StatCard icon={Clock} label="Pending maintenance (flats)" value={formatCurrency(stats.totalFlatPendingMaintenance)} subValue={`${stats.totalFlats} flat(s) · Society-wide`} gradient="bg-white border border-violet-200/80" iconBg="bg-violet-100" iconColor="text-violet-700" />
              </div>

              <div className="grid lg:grid-cols-12 gap-4 mb-6">
                <div className="lg:col-span-7 xl:col-span-8">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="text-lime-600" size={16} />
                    <p className="text-xs font-semibold text-gray-800">Income vs expenses by month</p>
                  </div>
                  <MonthlyIncomeExpenseChart items={chartItems} />
                </div>
                <div className="lg:col-span-5 xl:col-span-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Megaphone className="text-lime-600" size={16} />
                      <p className="text-xs font-semibold text-gray-800">Announcements</p>
                    </div>
                    <Link to="/resident/announcements" className="text-xs font-medium text-lime-700 flex items-center gap-0.5">
                      View <ArrowRight size={12} />
                    </Link>
                  </div>
                  <div className="bg-white rounded-xl border border-gray-200/90 shadow-sm p-4 min-h-[160px]">
                    {announcementPreview.length === 0 ? (
                      <p className="text-xs text-gray-500 text-center py-6">No announcements</p>
                    ) : (
                      <ul className="space-y-2">
                        {announcementPreview.map((a) => (
                          <li key={a.id} className="border-b border-gray-100 last:border-0 pb-2 last:pb-0">
                            <p className="text-sm font-medium text-gray-900 line-clamp-1">{a.title || 'Announcement'}</p>
                            <p className="text-xs text-gray-500 line-clamp-2">{a.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Recent Income</h3>
                    <Link to="/resident/income" className="text-sm text-lime-700 hover:text-lime-800 font-medium flex items-center gap-1">
                      View all <ArrowRight size={14} />
                    </Link>
                  </div>
                  {recentIncome.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No income records yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentIncome.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.description || item.category}</p>
                            <p className="text-xs text-gray-500">{item.date}</p>
                          </div>
                          <span className="text-sm font-semibold text-lime-700">+{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Recent Expenses</h3>
                    <Link to="/resident/expenses" className="text-sm text-red-600 hover:text-red-700 font-medium flex items-center gap-1">
                      View all <ArrowRight size={14} />
                    </Link>
                  </div>
                  {recentExpenses.length === 0 ? (
                    <p className="text-sm text-gray-400 text-center py-6">No expense records yet</p>
                  ) : (
                    <div className="space-y-3">
                      {recentExpenses.map(item => (
                        <div key={item.id} className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900">{item.description || item.category}</p>
                            <p className="text-xs text-gray-500">{item.date}</p>
                          </div>
                          <span className="text-sm font-semibold text-red-600">-{formatCurrency(item.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">Recent (30 days)</h3>
                    <p className="text-sm text-gray-500 mt-1">Includes income and expenses from the last 30 days.</p>
                  </div>
                  <Link to="/resident/reports" className="text-sm text-lime-700 hover:text-lime-800 font-medium flex items-center gap-1 shrink-0">
                    Reports <ArrowRight size={14} />
                  </Link>
                </div>

                {recentTransactions.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-12">No transactions in the last 30 days</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px]">
                      <thead className="text-xs text-gray-500 border-b border-gray-100">
                        <tr>
                          <th className="text-left py-3 pr-4 font-medium">Type</th>
                          <th className="text-left py-3 pr-4 font-medium">Title</th>
                          <th className="text-right py-3 px-4 font-medium w-28">Amount</th>
                          <th className="text-left py-3 px-4 font-medium w-32">Date</th>
                          <th className="text-right py-3 pl-4 font-medium w-24">Bill</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {recentTransactions.map((t) => (
                          <tr key={t.sortKey} className="text-sm">
                            <td className="py-3 pr-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                t.type === 'Income' ? 'bg-lime-100 text-lime-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-900 max-w-md truncate" title={t.title}>{t.title}</td>
                            <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${t.type === 'Income' ? 'text-lime-700' : 'text-red-600'}`}>
                              {t.type === 'Income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </td>
                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{t.date ? formatDate(t.date) : '-'}</td>
                            <td className="py-3 pl-4 text-right">
                              {t.attachmentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewBill(t.attachmentUrl)}
                                  className="text-lime-700 hover:text-lime-900 text-xs font-medium inline-flex items-center gap-1"
                                >
                                  <FileText size={14} />
                                  View
                                </button>
                              ) : (
                                <span className="text-gray-300">—</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default ResDashboard;

