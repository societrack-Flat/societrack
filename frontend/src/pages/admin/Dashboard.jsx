import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  TrendingDown,
  Clock,
  Megaphone,
  Calendar,
  Plus,
  Wallet,
  Receipt,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import toast from 'react-hot-toast';
import DashboardMonthlyBarChart from '../../components/DashboardMonthlyBarChart';
import ExpenseDonutChart from '../../components/ExpenseDonutChart';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';
import { getMaintenanceMonthOptions } from '../../utils/maintenanceMonthOptions';

/** Primary green — use consistently on admin dashboard (matches mock “Add Receipt”) */
const DASH_GREEN = '#22c55e';
const DASH_GREEN_HOVER = '#16a34a';

const DASHBOARD_STATS_MS = 20000;

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error('DASHBOARD_STATS_TIMEOUT')), ms);
    }),
  ]);
}

/** Chart + stat cards: same range semantics as monthly chart data */
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

/** Pad months so the bar chart shows every period (zeros where missing). */
function padChartItems(items, timeRange, customFrom, customTo) {
  const map = new Map((items || []).map((it) => [it.month, it]));
  if (timeRange === 'month') {
    const list = Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    if (list.length) return list;
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    return [{ month: ym, income: 0, expense: 0 }];
  }
  if (timeRange === 'custom' && customFrom && customTo) {
    const out = [];
    const start = new Date(`${customFrom.slice(0, 7)}-01`);
    const end = new Date(`${customTo.slice(0, 7)}-01`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const ex = map.get(ym);
      out.push(ex || { month: ym, income: 0, expense: 0 });
    }
    return out;
  }
  const out = [];
  const now = new Date();
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    out.push(map.get(ym) || { month: ym, income: 0, expense: 0 });
  }
  return out;
}

function sumMaintenanceCollectedForPeriod(rows, timeRange, customFrom, customTo) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const { from, to } = getRangeBounds(timeRange, customFrom, customTo);
  return (rows || []).reduce((sum, m) => {
    let ok = false;
    if (timeRange === 'all') ok = true;
    else if (timeRange === 'month') ok = m.month === currentMonth && m.year === currentYear;
    else if (timeRange === 'custom' && from && to) {
      if (m.paid_date) {
        const pd = String(m.paid_date).split('T')[0];
        ok = pd >= from && pd < to;
      } else {
        const mid = `${m.year}-${String(m.month).padStart(2, '0')}-15`;
        ok = mid >= from && mid < to;
      }
    }
    return ok ? sum + Number(m.paid_amount || 0) : sum;
  }, 0);
}

function sumPendingMaintenanceForPeriod(rows, timeRange, customFrom, customTo) {
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  return (rows || []).reduce((sum, m) => {
    if (m.status !== 'pending') return sum;
    const amt = Number(m.amount ?? 0);
    if (timeRange === 'all') return sum + amt;
    if (timeRange === 'month') {
      return m.month === currentMonth && m.year === currentYear ? sum + amt : sum;
    }
    if (timeRange === 'custom' && customFrom && customTo) {
      const rowYm = `${m.year}-${String(m.month).padStart(2, '0')}`;
      const fromYm = customFrom.slice(0, 7);
      const toYm = customTo.slice(0, 7);
      return rowYm >= fromYm && rowYm <= toYm ? sum + amt : sum;
    }
    return sum;
  }, 0);
}

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartItems, setChartItems] = useState([]);
  const [announcementPreview, setAnnouncementPreview] = useState([]);
  const [expenseByCategory, setExpenseByCategory] = useState([]);
  const [timeRange, setTimeRange] = useState('all'); // all | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [modalFlats, setModalFlats] = useState([]);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [receiptForm, setReceiptForm] = useState({
    amount: '',
    category: '',
    description: '',
    date: todayStr,
    payment_mode: 'cash',
    flat_id: '',
    maintenance_month: '',
  });

  const receiptMaintenanceMonthOptions = useMemo(() => {
    const base = getMaintenanceMonthOptions();
    const v = receiptForm.maintenance_month;
    if (v && /^\d{4}-\d{2}$/.test(String(v)) && !base.some((o) => o.value === v)) {
      const [y, mo] = String(v).split('-').map(Number);
      const d = new Date(y, mo - 1, 1);
      const label = d.toLocaleString('en-IN', { month: 'short', year: 'numeric' });
      return [{ value: v, label }, ...base].sort((a, b) => a.value.localeCompare(b.value));
    }
    return base;
  }, [receiptForm.maintenance_month]);

  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    category: '',
    description: '',
    date: todayStr,
    payment_mode: 'cash',
  });
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

  const { apartment, userProfile, checkSubscription, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchDashboardStats();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded, timeRange, customFrom, customTo]);

  useEffect(() => {
    if (!activeApartmentId) return;
    fetchChartAndTransactions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApartmentId, timeRange, customFrom, customTo]);

  useEffect(() => {
    if (!activeApartmentId || (!showReceiptModal && !showExpenseModal)) return;
    let cancelled = false;
    (async () => {
      const [{ data: ic }, { data: ec }, { data: fl }] = await Promise.all([
        supabase.from('income_categories').select('id, name').eq('apartment_id', activeApartmentId).eq('is_active', true).order('name'),
        supabase.from('expense_categories').select('id, name').eq('apartment_id', activeApartmentId).eq('is_active', true).order('name'),
        supabase.from('flats').select('id, flat_number, monthly_maintenance').eq('apartment_id', activeApartmentId).order('flat_number'),
      ]);
      if (cancelled) return;
      setIncomeCategories(ic || []);
      setExpenseCategories(ec || []);
      setModalFlats(fl || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeApartmentId, showReceiptModal, showExpenseModal]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);

      const { from, to } = getRangeBounds(timeRange, customFrom, customTo);

      let periodIncomeQ = supabase.from('income').select('amount').eq('apartment_id', activeApartmentId);
      let periodExpenseQ = supabase.from('expenses').select('amount, category').eq('apartment_id', activeApartmentId);
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
        { data: maintenanceRows },
        { data: aptOpeningRow },
        { data: announcementRows },
      ] = await withTimeout(
        Promise.all([
          supabase
            .from('flats')
            .select('id, monthly_maintenance, pending_maintenance, other_maintenance')
            .eq('apartment_id', activeApartmentId),
          periodIncomeQ,
          periodExpenseQ,
          supabase.from('income').select('amount').eq('apartment_id', activeApartmentId),
          supabase.from('expenses').select('amount').eq('apartment_id', activeApartmentId),
          supabase
            .from('maintenance')
            .select('amount, paid_amount, paid_date, month, year, status')
            .eq('apartment_id', activeApartmentId),
          supabase.from('apartments').select('opening_balance').eq('id', activeApartmentId).maybeSingle(),
          supabase
            .from('announcements')
            .select('id, title, message, priority, created_at')
            .eq('apartment_id', activeApartmentId)
            .order('created_at', { ascending: false })
            .limit(4),
        ]),
        DASHBOARD_STATS_MS
      );

      const flatsList = flatRows || [];
      const totalFlats = flatsList.length;
      const maintenancePaidRows = (maintenanceRows || []).filter((m) => m.status === 'paid');
      const totalFlatPendingMaintenance = sumPendingMaintenanceForPeriod(
        maintenanceRows || [],
        timeRange,
        customFrom,
        customTo
      );
      const otherMaintenanceOnFlats = flatsList.reduce((s, row) => s + Number(row?.other_maintenance ?? 0), 0) || 0;

      setAnnouncementPreview(announcementRows || []);

      const periodIncome = periodIncomeRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodExpense = periodExpenseRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;

      const catMap = {};
      (periodExpenseRows || []).forEach((row) => {
        const c = String(row.category || 'Uncategorized').trim() || 'Uncategorized';
        catMap[c] = (catMap[c] || 0) + Number(row.amount || 0);
      });
      setExpenseByCategory(
        Object.entries(catMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
      );
      const allIncomeSum = totalIncomeData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const allExpenseSum = totalExpensesData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const openingBal = Number(aptOpeningRow?.opening_balance ?? 0);
      const periodNetIncomeExpense = periodIncome - periodExpense;

      setStats({
        totalIncomeThisMonth: periodIncome,
        totalExpensesThisMonth: periodExpense,
        totalIncome: allIncomeSum,
        totalExpenses: allExpenseSum,
        currentBalance: timeRange === 'all' ? openingBal + periodNetIncomeExpense : periodNetIncomeExpense,
        openingBalance: openingBal,
        maintenanceCollected: sumMaintenanceCollectedForPeriod(
          maintenancePaidRows,
          timeRange,
          customFrom,
          customTo
        ),
        maintenancePending: 0,
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
        let q = supabase.from(table).select('date,amount,category,description,payment_mode').eq('apartment_id', activeApartmentId);
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
    } catch (e) {
      console.error('Failed to load chart/transactions', e);
    }
  };

  const subscription = userProfile ? checkSubscription() : { valid: true, status: null, daysLeft: null };

  const periodNet =
    timeRange === 'all'
      ? stats.openingBalance + stats.totalIncomeThisMonth - stats.totalExpensesThisMonth
      : stats.totalIncomeThisMonth - stats.totalExpensesThisMonth;

  const barChartItems = useMemo(
    () => padChartItems(chartItems || [], timeRange, customFrom, customTo),
    [chartItems, timeRange, customFrom, customTo]
  );

  const submitReceipt = async (e) => {
    e.preventDefault();
    if (!activeApartmentId || !userProfile?.id) return;
    if (!receiptForm.amount || parseFloat(receiptForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!receiptForm.category) {
      toast.error('Please select a category');
      return;
    }
    try {
      setReceiptSaving(true);
      const mm =
        receiptForm.maintenance_month && /^\d{4}-\d{2}$/.test(receiptForm.maintenance_month)
          ? receiptForm.maintenance_month
          : null;
      const row = {
        apartment_id: activeApartmentId,
        flat_id: receiptForm.flat_id || null,
        amount: parseFloat(receiptForm.amount),
        category: receiptForm.category,
        description: receiptForm.description || null,
        date: receiptForm.date,
        payment_mode: receiptForm.payment_mode,
        ...(mm ? { maintenance_month: mm } : { maintenance_month: null }),
        created_by: userProfile.id,
      };
      const { error } = await supabase.from('income').insert(row);
      if (error) throw error;
      toast.success('Receipt added');
      setShowReceiptModal(false);
      setReceiptForm({
        amount: '',
        category: '',
        description: '',
        date: todayStr,
        payment_mode: 'cash',
        flat_id: '',
        maintenance_month: '',
      });
      fetchDashboardStats();
      fetchChartAndTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Could not add receipt');
    } finally {
      setReceiptSaving(false);
    }
  };

  const submitExpenseQuick = async (e) => {
    e.preventDefault();
    if (!activeApartmentId || !userProfile?.id) return;
    if (!expenseForm.amount || parseFloat(expenseForm.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }
    if (!expenseForm.category) {
      toast.error('Please select a category');
      return;
    }
    try {
      setExpenseSaving(true);
      const { error } = await supabase.from('expenses').insert({
        apartment_id: activeApartmentId,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description || null,
        date: expenseForm.date,
        payment_mode: expenseForm.payment_mode,
        created_by: userProfile.id,
      });
      if (error) throw error;
      toast.success('Expense added');
      setShowExpenseModal(false);
      setExpenseForm({
        amount: '',
        category: '',
        description: '',
        date: todayStr,
        payment_mode: 'cash',
      });
      fetchDashboardStats();
      fetchChartAndTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Could not add expense');
    } finally {
      setExpenseSaving(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="" hideTitle />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">

          {loading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Loading dashboard…</p>
            </div>
          ) : (
            <>
              {/* Trial Warning */}
              {subscription?.status === 'trial' && subscription?.daysLeft <= 3 && (
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

              {/* Title row + actions (matches mock) */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-sm">
                    {(apartment?.name || 'S').trim().charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-gray-900 tracking-tight">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Financial Overview</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReceiptModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-colors"
                    style={{ backgroundColor: DASH_GREEN }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = DASH_GREEN_HOVER;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = DASH_GREEN;
                    }}
                  >
                    <Plus size={18} strokeWidth={2.5} />
                    Add Receipt
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExpenseModal(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-white border border-gray-300 text-gray-800 hover:bg-gray-50 shadow-sm"
                  >
                    <Receipt size={18} />
                    Add Expense
                  </button>
                </div>
              </div>

              {/* Period */}
              <div className="flex flex-wrap items-center gap-2 mb-5">
                <span className="text-xs font-medium text-gray-500">Period</span>
                <select
                  value={timeRange}
                  onChange={(e) => setTimeRange(e.target.value)}
                  className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
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
                        className="bg-white border border-gray-200 rounded-lg pl-8 pr-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                    <div className="relative">
                      <Calendar className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg pl-8 pr-2 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </>
                )}
              </div>

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-green-50">
                      <IndianRupee className="text-[#16a34a]" size={20} strokeWidth={2} />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-500">Total maintenance collected</p>
                  <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatCurrency(stats.maintenanceCollected)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-red-50">
                      <TrendingDown className="text-red-600" size={20} />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-500">Total Expenses</p>
                  <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatCurrency(stats.totalExpensesThisMonth)}</p>
                </div>
                <div className="rounded-xl border border-blue-600 bg-blue-600 p-4 shadow-sm text-white">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-white/20">
                      <Wallet className="text-white" size={20} />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-blue-100">Current Balance</p>
                  <p className="text-lg font-bold mt-1 tabular-nums">{formatCurrency(periodNet)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-2 rounded-lg bg-amber-50">
                      <Clock className="text-amber-600" size={20} />
                    </div>
                  </div>
                  <p className="text-xs font-medium text-gray-500">Pending maintenance</p>
                  <p className="text-lg font-bold text-gray-900 mt-1 tabular-nums">{formatCurrency(stats.totalFlatPendingMaintenance)}</p>
                </div>
              </div>

              {/* Latest announcement */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="text-[#16a34a]" size={18} />
                    <h2 className="text-sm font-semibold text-gray-900">Latest Announcement</h2>
                  </div>
                  <Link
                    to="/admin/announcements"
                    className="text-xs font-medium flex items-center gap-0.5 hover:underline"
                    style={{ color: DASH_GREEN }}
                  >
                    Manage <ArrowRight size={12} />
                  </Link>
                </div>
                {announcementPreview.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No announcements available.</p>
                ) : (
                  <ul className="space-y-3">
                    {announcementPreview.slice(0, 1).map((a) => (
                      <li key={a.id}>
                        <p className="text-sm font-medium text-gray-900">{a.title || 'Announcement'}</p>
                        <p className="text-xs text-gray-600 mt-1 line-clamp-3">{a.message}</p>
                        <p className="text-[10px] text-gray-400 mt-2">{a.created_at ? formatDate(a.created_at) : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Charts row */}
              <div className="grid lg:grid-cols-2 gap-4 mb-8">
                <DashboardMonthlyBarChart items={barChartItems} incomeColor={DASH_GREEN} />
                <ExpenseDonutChart entries={expenseByCategory} />
              </div>

              <div className="flex flex-wrap gap-3 text-sm">
                <Link to="/admin/income" className="font-medium hover:underline" style={{ color: DASH_GREEN }}>
                  View all income records <ArrowRight className="inline" size={14} />
                </Link>
                <span className="text-gray-300">|</span>
                <Link to="/admin/expenses" className="text-gray-600 font-medium hover:text-gray-900">
                  View all expenses
                </Link>
                <span className="text-gray-300">|</span>
                <Link to="/admin/reports" className="text-gray-600 font-medium hover:text-gray-900">
                  Reports
                </Link>
              </div>

              {/* Add Receipt modal */}
              <Modal
                isOpen={showReceiptModal}
                onClose={() => setShowReceiptModal(false)}
                title="Add Receipt"
                subtitle="Record income / receipt for the selected apartment"
                size="lg"
              >
                <form onSubmit={submitReceipt} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      label="Amount (₹)"
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={receiptForm.amount}
                      onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                      icon={IndianRupee}
                      required
                    />
                    <InputField
                      label="Date"
                      name="date"
                      type="date"
                      value={receiptForm.date}
                      onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })}
                      icon={Calendar}
                      required
                    />
                  </div>
                  <InputField
                    label="Category"
                    name="category"
                    type="select"
                    value={receiptForm.category}
                    onChange={(e) => setReceiptForm({ ...receiptForm, category: e.target.value })}
                    options={[
                      { value: '', label: 'Select category' },
                      ...incomeCategories.map((c) => ({ value: c.name, label: c.name })),
                    ]}
                    required
                  />
                  <InputField
                    label="Description"
                    name="description"
                    type="text"
                    value={receiptForm.description}
                    onChange={(e) => setReceiptForm({ ...receiptForm, description: e.target.value })}
                  />
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      label="Payment mode"
                      name="payment_mode"
                      type="select"
                      value={receiptForm.payment_mode}
                      onChange={(e) => setReceiptForm({ ...receiptForm, payment_mode: e.target.value })}
                      options={[
                        { value: 'cash', label: 'Cash' },
                        { value: 'upi', label: 'UPI' },
                        { value: 'bank_transfer', label: 'Bank Transfer' },
                        { value: 'cheque', label: 'Cheque' },
                        { value: 'online', label: 'Online' },
                      ]}
                    />
                    <InputField
                      label="Flat (optional)"
                      name="flat_id"
                      type="select"
                      value={receiptForm.flat_id}
                      onChange={(e) => {
                        const flatId = e.target.value;
                        const flat = modalFlats.find((f) => f.id === flatId);
                        const maint = flat?.monthly_maintenance;
                        const amountFromFlat =
                          maint != null && maint !== '' && !Number.isNaN(Number(maint))
                            ? String(Number(maint))
                            : undefined;
                        setReceiptForm((prev) => ({
                          ...prev,
                          flat_id: flatId,
                          ...(amountFromFlat !== undefined ? { amount: amountFromFlat } : {}),
                        }));
                      }}
                      options={[{ value: '', label: '—' }, ...modalFlats.map((f) => ({ value: f.id, label: f.flat_number }))]}
                    />
                  </div>
                  <InputField
                    label="Maintenance month (optional)"
                    name="maintenance_month"
                    type="select"
                    value={receiptForm.maintenance_month}
                    onChange={(e) => setReceiptForm({ ...receiptForm, maintenance_month: e.target.value })}
                    options={[{ value: '', label: '—' }, ...receiptMaintenanceMonthOptions]}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" fullWidth onClick={() => setShowReceiptModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" fullWidth loading={receiptSaving}>
                      Save receipt
                    </Button>
                  </div>
                </form>
              </Modal>

              {/* Add Expense modal */}
              <Modal
                isOpen={showExpenseModal}
                onClose={() => setShowExpenseModal(false)}
                title="Add Expense"
                subtitle="Record a society expense"
                size="lg"
              >
                <form onSubmit={submitExpenseQuick} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <InputField
                      label="Amount (₹)"
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      icon={IndianRupee}
                      required
                    />
                    <InputField
                      label="Date"
                      name="date"
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      icon={Calendar}
                      required
                    />
                  </div>
                  <InputField
                    label="Category"
                    name="category"
                    type="select"
                    value={expenseForm.category}
                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                    options={[
                      { value: '', label: 'Select category' },
                      ...expenseCategories.map((c) => ({ value: c.name, label: c.name })),
                    ]}
                    required
                  />
                  <InputField
                    label="Description"
                    name="description"
                    type="text"
                    value={expenseForm.description}
                    onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  />
                  <InputField
                    label="Payment mode"
                    name="payment_mode"
                    type="select"
                    value={expenseForm.payment_mode}
                    onChange={(e) => setExpenseForm({ ...expenseForm, payment_mode: e.target.value })}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'bank_transfer', label: 'Bank Transfer' },
                      { value: 'cheque', label: 'Cheque' },
                      { value: 'online', label: 'Online' },
                    ]}
                  />
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" fullWidth onClick={() => setShowExpenseModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" variant="primary" fullWidth loading={expenseSaving}>
                      Save expense
                    </Button>
                  </div>
                </form>
              </Modal>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

