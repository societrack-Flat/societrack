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
  FileText,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, getSignedUrl, uploadFile } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import Button from '../../components/Button';
import toast from 'react-hot-toast';
import DashboardMonthlyBarChart from '../../components/DashboardMonthlyBarChart';
import SupportChatPanel from '../../components/SupportChatPanel';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';
import { CALENDAR_MONTH_OPTIONS, getMaintenanceYearOptions } from '../../utils/maintenanceMonthOptions';
import { pendingTotalForDashboardPeriod } from '../../utils/maintenancePending';

/** Primary green — use consistently on admin dashboard (matches mock “Add Receipt”) */
const DASH_GREEN = '#22c55e';
const DASH_GREEN_HOVER = '#16a34a';

const DASHBOARD_STATS_MS = 20000;

function defaultReceiptForm(todayStr) {
  const d = new Date();
  return {
    amount: '',
    category: '',
    description: '',
    date: todayStr,
    payment_mode: 'cash',
    flat_id: '',
    maintenanceYear: String(d.getFullYear()),
    maintenanceMonth: String(d.getMonth() + 1),
    attachment: null,
  };
}

function defaultExpenseForm(todayStr) {
  return {
    amount: '',
    category: '',
    description: '',
    date: todayStr,
    payment_mode: 'cash',
    vendor_name: '',
    reference_number: '',
    attachment: null,
  };
}

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

const Dashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [chartItems, setChartItems] = useState([]);
  const [announcementPreview, setAnnouncementPreview] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [timeRange, setTimeRange] = useState('all'); // all | month | custom
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [incomeCategories, setIncomeCategories] = useState([]);
  const [expenseCategories, setExpenseCategories] = useState([]);
  const [modalFlats, setModalFlats] = useState([]);
  const [receiptSaving, setReceiptSaving] = useState(false);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [expenseSaving, setExpenseSaving] = useState(false);
  const [expenseUploading, setExpenseUploading] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [receiptForm, setReceiptForm] = useState(() => defaultReceiptForm(todayStr));

  const [receiptResidentPreview, setReceiptResidentPreview] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const [expenseForm, setExpenseForm] = useState(() => defaultExpenseForm(todayStr));
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
        supabase.from('flats').select('*').eq('apartment_id', activeApartmentId).order('flat_number'),
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
      let periodExpenseQ = supabase.from('expenses').select('amount').eq('apartment_id', activeApartmentId);
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
            .select('amount, paid_amount, paid_date, month, year, status, flat_id')
            .eq('apartment_id', activeApartmentId),
          supabase.from('apartments').select('opening_balance').eq('id', activeApartmentId).maybeSingle(),
          supabase
            .from('announcements')
            .select('id, title, message, priority, created_at, expiry_date')
            .eq('apartment_id', activeApartmentId)
            .order('created_at', { ascending: false })
            .limit(12),
        ]),
        DASHBOARD_STATS_MS
      );

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

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const activeAnnouncements = (announcementRows || []).filter((a) => {
        if (!a.expiry_date) return true;
        const exp = new Date(a.expiry_date);
        exp.setHours(0, 0, 0, 0);
        return exp >= todayStart;
      });
      setAnnouncementPreview(activeAnnouncements.slice(0, 4));

      const periodIncome = periodIncomeRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;
      const periodExpense = periodExpenseRows?.reduce((s, i) => s + Number(i.amount), 0) || 0;

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

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const from30 = since.toISOString().split('T')[0];

      const [{ data: inc30 }, { data: exp30 }] = await Promise.all([
        supabase
          .from('income')
          .select('id,date,amount,category,description,payment_mode,attachment_url')
          .eq('apartment_id', activeApartmentId)
          .gte('date', from30),
        supabase
          .from('expenses')
          .select('id,date,amount,category,description,payment_mode,attachment_url')
          .eq('apartment_id', activeApartmentId)
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

  const handleReceiptChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachment') {
      setReceiptForm((prev) => ({ ...prev, attachment: files[0] }));
    } else if (name === 'flat_id') {
      setReceiptForm((prev) => {
        const flat = modalFlats.find((f) => f.id === value);
        let amount = '';
        if (value && flat) {
          const maint = flat?.monthly_maintenance;
          if (maint != null && maint !== '' && !Number.isNaN(Number(maint))) {
            amount = String(Number(maint));
          }
        }
        return { ...prev, flat_id: value, amount };
      });
      const flat = modalFlats.find((f) => f.id === value);
      if (flat) {
        setReceiptResidentPreview({
          name: flat.resident_name || flat.owner_name || '',
          phone: flat.resident_phone || flat.owner_phone || '',
          email: flat.resident_email || flat.owner_email || '',
        });
      } else {
        setReceiptResidentPreview({ name: '', phone: '', email: '' });
      }
    } else {
      setReceiptForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleExpenseChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachment') {
      setExpenseForm((prev) => ({ ...prev, attachment: files[0] }));
    } else {
      setExpenseForm((prev) => ({ ...prev, [name]: value }));
    }
  };

  const closeReceiptModal = () => {
    setShowReceiptModal(false);
    setReceiptForm(defaultReceiptForm(new Date().toISOString().split('T')[0]));
    setReceiptResidentPreview({ name: '', phone: '', email: '' });
  };

  const closeExpenseModal = () => {
    setShowExpenseModal(false);
    setExpenseForm(defaultExpenseForm(new Date().toISOString().split('T')[0]));
  };

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
    if (!receiptForm.maintenanceYear || !receiptForm.maintenanceMonth) {
      toast.error('Maintenance month is required');
      return;
    }
    try {
      setReceiptSaving(true);
      let attachmentUrl = null;
      let attachmentName = null;
      if (receiptForm.attachment) {
        setReceiptUploading(true);
        const fileData = await uploadFile(receiptForm.attachment, `income/${activeApartmentId}`);
        attachmentUrl = fileData.path;
        attachmentName = fileData.name;
        setReceiptUploading(false);
      }
      const mm = `${receiptForm.maintenanceYear}-${String(Number(receiptForm.maintenanceMonth)).padStart(2, '0')}`;
      const row = {
        apartment_id: activeApartmentId,
        flat_id: receiptForm.flat_id || null,
        amount: parseFloat(receiptForm.amount),
        category: receiptForm.category,
        description: receiptForm.description || null,
        date: receiptForm.date,
        payment_mode: receiptForm.payment_mode,
        maintenance_month: mm,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        created_by: userProfile.id,
      };
      const { error } = await supabase.from('income').insert(row);
      if (error) throw error;
      toast.success('Receipt added');
      closeReceiptModal();
      fetchDashboardStats();
      fetchChartAndTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Could not add receipt');
    } finally {
      setReceiptSaving(false);
      setReceiptUploading(false);
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
      let attachmentUrl = null;
      let attachmentName = null;
      if (expenseForm.attachment) {
        setExpenseUploading(true);
        const fileData = await uploadFile(expenseForm.attachment, `expenses/${activeApartmentId}`);
        attachmentUrl = fileData.path;
        attachmentName = fileData.name;
        setExpenseUploading(false);
      }
      const { error } = await supabase.from('expenses').insert({
        apartment_id: activeApartmentId,
        amount: parseFloat(expenseForm.amount),
        category: expenseForm.category,
        description: expenseForm.description || null,
        vendor_name: expenseForm.vendor_name || null,
        reference_number: expenseForm.reference_number || null,
        date: expenseForm.date,
        payment_mode: expenseForm.payment_mode,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
        created_by: userProfile.id,
      });
      if (error) throw error;
      toast.success('Expense added');
      closeExpenseModal();
      fetchDashboardStats();
      fetchChartAndTransactions();
    } catch (err) {
      console.error(err);
      toast.error('Could not add expense');
    } finally {
      setExpenseSaving(false);
      setExpenseUploading(false);
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
                    onClick={() => {
                      setReceiptForm(defaultReceiptForm(new Date().toISOString().split('T')[0]));
                      setReceiptResidentPreview({ name: '', phone: '', email: '' });
                      setShowReceiptModal(true);
                    }}
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
                    onClick={() => {
                      setExpenseForm(defaultExpenseForm(new Date().toISOString().split('T')[0]));
                      setShowExpenseModal(true);
                    }}
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

              {/* Latest announcement — bright red styling; expired hidden in fetch */}
              <div className="rounded-xl border-2 border-red-500 bg-red-50 shadow-sm p-5 mb-6">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Megaphone className="text-red-600" size={18} />
                    <h2 className="text-sm font-semibold text-red-600">Latest Announcement</h2>
                  </div>
                  <Link
                    to="/admin/announcements"
                    className="text-xs font-medium flex items-center gap-0.5 hover:underline text-red-600"
                  >
                    Manage <ArrowRight size={12} />
                  </Link>
                </div>
                {announcementPreview.length === 0 ? (
                  <p className="text-sm text-red-700/80 text-center py-6">No announcements available.</p>
                ) : (
                  <ul className="space-y-3">
                    {announcementPreview.slice(0, 1).map((a) => (
                      <li key={a.id}>
                        <p className="text-sm font-medium text-red-700">{a.title || 'Announcement'}</p>
                        <p className="text-xs text-red-700 mt-1 line-clamp-3">{a.message}</p>
                        <p className="text-[10px] text-red-600/80 mt-2">{a.created_at ? formatDate(a.created_at) : ''}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex flex-col lg:flex-row gap-4 mb-4 items-stretch">
                <div className="w-full lg:w-1/2 min-w-0">
                  <DashboardMonthlyBarChart items={barChartItems} incomeColor={DASH_GREEN} />
                </div>
                <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
                  <SupportChatPanel variant="admin" apartmentId={activeApartmentId} />
                </div>
              </div>

              <div className="w-full bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Recent (30 days)</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Includes income and expenses from the last 30 days.</p>
                  </div>
                  <Link to="/admin/reports" className="text-xs font-medium flex items-center gap-1 shrink-0 hover:underline" style={{ color: DASH_GREEN }}>
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
                              <span
                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                  t.type === 'Income' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-gray-900 max-w-md truncate" title={t.title}>
                              {t.title}
                            </td>
                            <td
                              className={`py-3 px-4 text-right font-semibold whitespace-nowrap ${
                                t.type === 'Income' ? 'text-[#16a34a]' : 'text-red-600'
                              }`}
                            >
                              {t.type === 'Income' ? '+' : '-'}
                              {formatCurrency(t.amount)}
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

              {/* Add Receipt modal */}
              <Modal
                isOpen={showReceiptModal}
                onClose={closeReceiptModal}
                title="Add Receipt"
                subtitle="Record income / receipt for the selected apartment"
                size="lg"
              >
                <form onSubmit={submitReceipt} className="space-y-5">
                  <InputField
                    label="Flat"
                    name="flat_id"
                    type="select"
                    value={receiptForm.flat_id}
                    onChange={handleReceiptChange}
                    options={[
                      { value: '', label: 'Select Flat (Optional)' },
                      ...modalFlats.map((f) => ({
                        value: f.id,
                        label: `${f.flat_number} - ${f.owner_name || 'No owner'}`,
                      })),
                    ]}
                  />

                  {(receiptResidentPreview.name || receiptResidentPreview.phone || receiptResidentPreview.email) && (
                    <div className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resident</p>
                      {receiptResidentPreview.name && (
                        <p className="font-medium text-gray-900">{receiptResidentPreview.name}</p>
                      )}
                      {receiptResidentPreview.phone && (
                        <p className="text-gray-600">Phone: {receiptResidentPreview.phone}</p>
                      )}
                      {receiptResidentPreview.email && (
                        <p className="text-gray-600">Email: {receiptResidentPreview.email}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Amount (₹)"
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={receiptForm.amount}
                      onChange={handleReceiptChange}
                      icon={IndianRupee}
                      required
                    />
                    <InputField
                      label="Date"
                      name="date"
                      type="date"
                      value={receiptForm.date}
                      onChange={handleReceiptChange}
                      icon={Calendar}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField
                      label="Category"
                      name="category"
                      type="select"
                      value={receiptForm.category}
                      onChange={handleReceiptChange}
                      options={[
                        { value: '', label: 'Select Category' },
                        ...incomeCategories.map((c) => ({ value: c.name, label: c.name })),
                        { value: 'Maintenance', label: 'Maintenance' },
                        { value: 'Penalty', label: 'Penalty' },
                        { value: 'Other Income', label: 'Other Income' },
                        { value: 'Other', label: 'Other' },
                      ]}
                      required
                    />
                    <InputField
                      label="Year"
                      name="maintenanceYear"
                      type="select"
                      value={receiptForm.maintenanceYear}
                      onChange={handleReceiptChange}
                      required
                      options={getMaintenanceYearOptions()}
                    />
                    <InputField
                      label="Month"
                      name="maintenanceMonth"
                      type="select"
                      value={receiptForm.maintenanceMonth}
                      onChange={handleReceiptChange}
                      required
                      options={CALENDAR_MONTH_OPTIONS}
                    />
                  </div>

                  <InputField
                    label="Payment mode"
                    name="payment_mode"
                    type="select"
                    value={receiptForm.payment_mode}
                    onChange={handleReceiptChange}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'bank_transfer', label: 'Bank Transfer' },
                      { value: 'cheque', label: 'Cheque' },
                      { value: 'online', label: 'Online' },
                    ]}
                  />

                  <InputField
                    label="Description"
                    name="description"
                    type="textarea"
                    placeholder="Add notes or description"
                    value={receiptForm.description}
                    onChange={handleReceiptChange}
                    rows={3}
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Attachment</label>
                    <input
                      type="file"
                      name="attachment"
                      onChange={handleReceiptChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" fullWidth onClick={closeReceiptModal}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      loading={receiptSaving || receiptUploading}
                    >
                      {receiptUploading ? 'Uploading...' : 'Save receipt'}
                    </Button>
                  </div>
                </form>
              </Modal>

              {/* Add Expense modal */}
              <Modal
                isOpen={showExpenseModal}
                onClose={closeExpenseModal}
                title="Add Expense"
                subtitle="Record a society expense"
                size="lg"
              >
                <form onSubmit={submitExpenseQuick} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <InputField
                      label="Amount (₹)"
                      name="amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={handleExpenseChange}
                      icon={IndianRupee}
                      required
                    />
                    <InputField
                      label="Date"
                      name="date"
                      type="date"
                      value={expenseForm.date}
                      onChange={handleExpenseChange}
                      icon={Calendar}
                      required
                    />
                  </div>
                  <InputField
                    label="Category"
                    name="category"
                    type="select"
                    value={expenseForm.category}
                    onChange={handleExpenseChange}
                    options={[
                      { value: '', label: 'Select Category' },
                      ...expenseCategories.map((c) => ({ value: c.name, label: c.name })),
                    ]}
                    required
                  />
                  <InputField
                    label="Vendor Name"
                    name="vendor_name"
                    type="text"
                    placeholder="Enter vendor/payee name"
                    value={expenseForm.vendor_name}
                    onChange={handleExpenseChange}
                  />
                  <InputField
                    label="Payment mode"
                    name="payment_mode"
                    type="select"
                    value={expenseForm.payment_mode}
                    onChange={handleExpenseChange}
                    options={[
                      { value: 'cash', label: 'Cash' },
                      { value: 'upi', label: 'UPI' },
                      { value: 'bank_transfer', label: 'Bank Transfer' },
                      { value: 'cheque', label: 'Cheque' },
                      { value: 'online', label: 'Online' },
                    ]}
                  />
                  <InputField
                    label="Reference Number"
                    name="reference_number"
                    type="text"
                    placeholder="Transaction ID / Bill No"
                    value={expenseForm.reference_number}
                    onChange={handleExpenseChange}
                  />
                  <InputField
                    label="Description"
                    name="description"
                    type="textarea"
                    placeholder="Add notes or description"
                    value={expenseForm.description}
                    onChange={handleExpenseChange}
                    rows={3}
                  />
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bill Attachment</label>
                    <input
                      type="file"
                      name="attachment"
                      onChange={handleExpenseChange}
                      accept=".pdf,.jpg,.jpeg,.png"
                      className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                    />
                    <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button type="button" variant="outline" fullWidth onClick={closeExpenseModal}>
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      fullWidth
                      loading={expenseSaving || expenseUploading}
                    >
                      {expenseUploading ? 'Uploading...' : 'Save expense'}
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

