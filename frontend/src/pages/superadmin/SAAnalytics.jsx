import React, { useState, useEffect, useMemo } from 'react';
import { Building2, CreditCard, Users, IndianRupee, AlertTriangle, Clock, Ban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency } from '../../lib/supabaseClient';
import {
  isPaidPlan,
  isFreeClient,
  monthlyRevenueLast12Months,
  clientGrowthChartData,
  totalPlatformRevenue,
} from '../../lib/superadminMetrics';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import toast from 'react-hot-toast';

function GrowthBars({ data, max }) {
  const m = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-1 h-52 pt-4 border-b border-gray-200">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full max-w-[28px] rounded-t bg-indigo-500/90 mx-auto"
            style={{ height: `${Math.max(4, (d.value / m) * 100)}%` }}
            title={`${d.label}: ${d.value}`}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

function RevenueBars({ data, max }) {
  const m = max || Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end justify-between gap-1 h-52 pt-4 border-b border-gray-200">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <div
            className="w-full max-w-[28px] rounded-t bg-rose-500/85 mx-auto"
            style={{ height: `${Math.max(4, (d.value / m) * 100)}%` }}
            title={`${d.label}: ${formatCurrency(d.value)}`}
          />
          <span className="text-[10px] text-gray-500 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

const SAAnalytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState([]);
  const [payments, setPayments] = useState([]);

  const { userProfile } = useAuth();

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const [aptRes, payRes] = await Promise.all([
          supabase.from('apartments').select('*'),
          supabase.from('payment_history').select('amount, status, created_at'),
        ]);
        if (aptRes.error) throw aptRes.error;
        if (payRes.error) throw payRes.error;
        setApartments(aptRes.data || []);
        setPayments(payRes.data || []);
      } catch (e) {
        console.error(e);
        toast.error('Failed to load analytics');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const metrics = useMemo(() => {
    const total = apartments.length;
    const paid = apartments.filter(isPaidPlan).length;
    const free = apartments.filter(isFreeClient).length;
    const totalRevenue = totalPlatformRevenue(payments, apartments);

    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    let expiringSoon = 0;
    apartments.forEach((a) => {
      const end = a.trial_end_date ? new Date(a.trial_end_date).getTime() : null;
      if (end && end > now && end <= now + sevenDays) expiringSoon += 1;
    });

    return {
      total,
      paid,
      free,
      totalRevenue,
      expiringSoon,
      gracePeriod: 0,
      autoSuspended: 0,
    };
  }, [apartments, payments]);

  const growthBars = useMemo(() => clientGrowthChartData(apartments), [apartments]);
  const growthMax = useMemo(() => Math.max(...growthBars.map((d) => d.value), 1), [growthBars]);
  const revenueBars = useMemo(
    () => monthlyRevenueLast12Months(payments, apartments),
    [payments, apartments],
  );
  const revenueMax = useMemo(() => Math.max(...revenueBars.map((d) => d.value), 1), [revenueBars]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Super Admin" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
            <p className="text-gray-500 mt-1">Business metrics and platform growth</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
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
                      <p className="text-gray-500 text-sm">Paid Clients</p>
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
                      <p className="text-gray-500 text-sm">Free Clients</p>
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
                      <p className="text-gray-500 text-sm">Total Revenue</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(metrics.totalRevenue)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <IndianRupee size={24} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Expiring Within 7 Days</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.expiringSoon}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
                    <AlertTriangle size={22} />
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">In Grace Period</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.gracePeriod}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
                    <Clock size={22} />
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Auto-Suspended</p>
                    <p className="text-2xl font-bold text-gray-900 mt-2">{metrics.autoSuspended}</p>
                  </div>
                  <div className="p-2 rounded-xl bg-red-50 text-red-600">
                    <Ban size={22} />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Growth (last 12 months)</h3>
                  <GrowthBars data={growthBars} max={growthMax} />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Revenue (last 12 months)</h3>
                  <RevenueBars data={revenueBars} max={revenueMax} />
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

export default SAAnalytics;
