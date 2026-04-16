import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Building2, CreditCard, Users, IndianRupee } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency } from '../../lib/supabaseClient';
import {
  planBucket,
  isPaidPlan,
  isFreeClient,
  monthlyRevenueChartData,
} from '../../lib/superadminMetrics';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import SupportChatPanel from '../../components/SupportChatPanel';
import toast from 'react-hot-toast';

function DonutChart({ segments }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const colors = ['#94a3b8', '#2563eb'];
  let accPct = 0;
  const stops = segments
    .map((seg, i) => {
      const pct = (seg.value / total) * 100;
      const from = accPct;
      accPct += pct;
      return `${colors[i % colors.length]} ${from}% ${accPct}%`;
    })
    .join(', ');
  const background = total > 0 ? `conic-gradient(${stops})` : '#e5e7eb';

  return (
    <div className="flex flex-col sm:flex-row items-center gap-8 py-2">
      <div
        className="w-40 h-40 rounded-full shrink-0 ring-8 ring-white shadow-inner"
        style={{
          background,
          mask: 'radial-gradient(farthest-side, transparent 58%, black 59%)',
          WebkitMask: 'radial-gradient(farthest-side, transparent 58%, black 59%)',
        }}
      />
      <ul className="w-full max-w-xs space-y-2 text-sm">
        {segments.map((seg, i) => (
          <li key={seg.key} className="flex justify-between text-gray-700">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: colors[i % colors.length] }} />
              {seg.label}
            </span>
            <span className="font-medium tabular-nums">{seg.value} apartments</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevenueBars({ data, max }) {
  const m = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-1 h-48 pt-6 border-b border-gray-200">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full max-w-[28px] rounded-t bg-blue-500/90 mx-auto transition-all"
            style={{ height: `${Math.max(4, (d.value / m) * 100)}%` }}
            title={`${d.label}: ${formatCurrency(d.value)}`}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const SADashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [chatApartmentId, setChatApartmentId] = useState('');

  const { userProfile } = useAuth();
  const year = new Date().getFullYear();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [aptRes, payRes] = await Promise.all([
          supabase.from('apartments').select('*').order('created_at', { ascending: false }),
          supabase.from('payment_history').select('amount, status, created_at').eq('status', 'success'),
        ]);
        if (aptRes.error) throw aptRes.error;
        if (payRes.error) throw payRes.error;
        setApartments(aptRes.data || []);
        setPayments(payRes.data || []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (apartments.length && !chatApartmentId) {
      setChatApartmentId(apartments[0].id);
    }
  }, [apartments, chatApartmentId]);

  const chatApartmentOptions = useMemo(
    () => apartments.map((a) => ({ id: a.id, name: a.name || 'Unnamed' })),
    [apartments]
  );

  const handleChatApartmentChange = useCallback((id) => {
    setChatApartmentId(id);
  }, []);

  const metrics = useMemo(() => {
    const total = apartments.length;
    const paid = apartments.filter(isPaidPlan).length;
    const free = apartments.filter(isFreeClient).length;
    const monthlyRevenue = (payments || []).reduce((s, p) => {
      const d = new Date(p.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
        ? s + Number(p.amount || 0)
        : s;
    }, 0);
    return { total, paid, free, monthlyRevenue };
  }, [apartments, payments]);

  const donutSegments = useMemo(() => {
    let free = 0;
    let paid499 = 0;
    apartments.forEach((a) => {
      if (planBucket(a) === '499') paid499 += 1;
      else free += 1;
    });
    return [
      { key: 'free', label: 'Free', value: free },
      { key: '499', label: '₹499 Plan', value: paid499 },
    ];
  }, [apartments]);

  const revenueBars = useMemo(() => monthlyRevenueChartData(payments, year), [payments, year]);
  const barMax = useMemo(() => Math.max(...revenueBars.map((d) => d.value), 1), [revenueBars]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Super Admin" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-500 mt-1">Platform business metrics overview</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
                <div className="rounded-2xl bg-blue-600 text-white p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-blue-100 text-sm">Total Clients</p>
                      <p className="text-3xl font-bold mt-2">{metrics.total}</p>
                    </div>
                    <Building2 className="opacity-90" size={28} />
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Paid Users</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.paid}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                      <CreditCard size={24} />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Free Users</p>
                      <p className="text-3xl font-bold text-gray-900 mt-2">{metrics.free}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-100 text-slate-600">
                      <Users size={24} />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">Monthly Revenue</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(metrics.monthlyRevenue)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <IndianRupee size={24} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                <div className="w-full lg:w-1/2 min-w-0 space-y-6">
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Plan distribution</h3>
                    <DonutChart segments={donutSegments} />
                  </div>
                  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue ({year})</h3>
                    <RevenueBars data={revenueBars} max={barMax} />
                  </div>
                </div>
                <div className="w-full lg:w-1/2 min-w-0 flex flex-col">
                  <SupportChatPanel
                    variant="superadmin"
                    apartmentId={chatApartmentId}
                    onApartmentChange={handleChatApartmentChange}
                    apartmentOptions={chatApartmentOptions}
                  />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SADashboard;
