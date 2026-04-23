import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  IndianRupee,
  TrendingDown,
  Clock,
  ArrowRight,
  Calendar,
  FileText,
  Megaphone,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, getSignedUrl, formatDate } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import toast from 'react-hot-toast';
import DashboardMonthlyBarChart from '../../components/DashboardMonthlyBarChart';
import { pendingTotalForDashboardPeriod } from '../../utils/maintenancePending';

/** Match admin dashboard accent */
const DASH_GREEN = '#22c55e';

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

/** Pad months so the bar chart matches admin dashboard behavior */
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
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
    }
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

const ResDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
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
        { data: maintenanceRows },
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
          supabase
            .from('maintenance')
            .select('amount, paid_amount, paid_date, month, year, status, flat_id')
            .eq('apartment_id', selectedApartmentId),
          supabase.from('apartments').select('opening_balance').eq('id', selectedApartmentId).maybeSingle(),
        ]),
        DASHBOARD_STATS_MS
      );

      let announcementRows = [];
      const { data: ann, error: annErr } = await supabase
        .from('announcements')
        .select('id, title, message, priority, created_at, expiry_date')
        .eq('apartment_id', selectedApartmentId)
        .order('created_at', { ascending: false })
        .limit(12);
      if (!annErr) announcementRows = ann || [];

      const flatsList = flatRows || [];
      const totalFlats = flatsList.length;
      const maintenancePaidRows = (maintenanceRows || []).filter((m) => m.status === 'paid');
      const totalFlatPendingMaintenance = pendingTotalForDashboardPeriod(
        flatsList,
        maintenanceRows || [],
        timeRange,
        customFrom,
        customTo
      );
      const otherMaintenanceOnFlats = flatsList.reduce((s, row) => s + Number(row?.other_maintenance ?? 0), 0) || 0;
      const openingBal = Number(aptOpeningRow?.opening_balance ?? 0);

      const periodIncome = periodIncomeRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodExpense = periodExpenseRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;

      const allIncomeSum = totalIncomeData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const allExpenseSum = totalExpensesData?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodNetIncomeExpense = periodIncome - periodExpense;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const activeAnnouncements = (announcementRows || []).filter((a) => {
        if (!a.expiry_date) return true;
        const exp = new Date(a.expiry_date);
        exp.setHours(0, 0, 0, 0);
        return exp >= todayStart;
      });
      setAnnouncementPreview(activeAnnouncements.slice(0, 4));

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

  const subscription = userProfile
    ? checkSubscription()
    : { valid: true, status: null, daysLeft: null, adminAccess: 'full', showSubscribeCta: false };

  const periodNet =
    timeRange === 'all'
      ? stats.openingBalance + stats.totalIncomeThisMonth - stats.totalExpensesThisMonth
      : stats.totalIncomeThisMonth - stats.totalExpensesThisMonth;

  const barChartItems = useMemo(
    () => padChartItems(chartItems || [], timeRange, customFrom, customTo),
    [chartItems, timeRange, customFrom, customTo]
  );

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
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="" hideTitle />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">

          {loading ? (
            <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
              <div className="w-10 h-10 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
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
              </div>

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

              <div className="rounded-xl border border-gray-200 bg-white shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="text-emerald-600" size={18} />
                    <h2 className="text-sm font-semibold text-gray-900">Latest Announcement</h2>
                  </div>
                  <Link
                    to="/resident/announcements"
                    className="text-xs font-medium flex items-center gap-0.5 hover:underline text-emerald-600"
                  >
                    View <ArrowRight size={12} />
                  </Link>
                </div>
                {announcementPreview.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-6">No announcements available.</p>
                ) : (
                  <ul className="space-y-3">
                    {announcementPreview.slice(0, 1).map((a) => (
                      <li key={a.id}>
                        <p className="text-sm font-medium text-gray-900">{a.title || 'Announcement'}</p>
                        <p className="text-sm text-red-600 mt-1 line-clamp-4 whitespace-pre-wrap">{a.message}</p>
                        <p className="text-[10px] text-gray-500 mt-2">{a.created_at ? formatDate(a.created_at) : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mb-6">
                <DashboardMonthlyBarChart items={barChartItems} incomeColor={DASH_GREEN} />
              </div>

              <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Recent (30 days)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Includes income and expenses from the last 30 days.</p>
                  </div>
                  <Link to="/resident/reports" className="text-xs font-medium flex items-center gap-1 shrink-0 hover:underline" style={{ color: DASH_GREEN }}>
                    Reports <ArrowRight size={12} />
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
                                t.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                              }`}>
                                {t.type}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-900 max-w-md truncate" title={t.title}>{t.title}</td>
                            <td className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${t.type === 'Income' ? 'text-[#16a34a]' : 'text-red-600'}`}>
                              {t.type === 'Income' ? '+' : '-'}{formatCurrency(t.amount)}
                            </td>
                            <td className="py-3 px-4 text-gray-600 whitespace-nowrap">{t.date ? formatDate(t.date) : '-'}</td>
                            <td className="py-3 pl-4 text-right">
                              {t.attachmentUrl ? (
                                <button
                                  type="button"
                                  onClick={() => handleViewBill(t.attachmentUrl)}
                                  className="text-xs font-medium inline-flex items-center gap-1 hover:underline"
                                  style={{ color: DASH_GREEN }}
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

