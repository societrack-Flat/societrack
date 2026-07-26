import React, { useState, useEffect, useMemo } from 'react';
import { Building2, CreditCard, Users, IndianRupee, AlertTriangle, Clock, Ban, TrendingUp } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency } from '../../lib/supabaseClient';
import {
  isPaidPlan,
  isFreeClient,
  monthlyRevenueChartData,
  clientGrowthChartDataForYear,
  totalPlatformRevenue,
  availableYears,
  buildPeriodRevenueSummary,
  countExpiringWithinDays,
  countGracePeriod,
  countAutoSuspended,
  newClientsForMonth,
  newClientsForYear,
} from '../../lib/superadminMetrics';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import SuperAdminPeriodFilter from '../../components/superadmin/SuperAdminPeriodFilter';
import { SuperAdminRevenueBarChart, SuperAdminGrowthBarChart } from '../../components/superadmin/SuperAdminBarChart';
import toast from 'react-hot-toast';

const SAAnalytics = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState([]);
  const [payments, setPayments] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState('all');

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

  const yearOptions = useMemo(
    () => availableYears(payments, apartments),
    [payments, apartments],
  );

  useEffect(() => {
    if (yearOptions.length && !yearOptions.includes(selectedYear)) {
      setSelectedYear(yearOptions[0]);
    }
  }, [yearOptions, selectedYear]);

  const metrics = useMemo(() => {
    const total = apartments.length;
    const paid = apartments.filter(isPaidPlan).length;
    const free = apartments.filter(isFreeClient).length;
    const allTimeRevenue = totalPlatformRevenue(payments, apartments);
    const period = buildPeriodRevenueSummary({
      payments,
      year: selectedYear,
      monthFilter: selectedMonth,
      apartments,
    });
    const newClients = selectedMonth === 'all'
      ? newClientsForYear(apartments, selectedYear)
      : newClientsForMonth(apartments, selectedYear, Number(selectedMonth));

    return {
      total,
      paid,
      free,
      allTimeRevenue,
      period,
      newClients,
      expiringSoon: countExpiringWithinDays(apartments, 7),
      gracePeriod: countGracePeriod(apartments),
      autoSuspended: countAutoSuspended(apartments),
    };
  }, [apartments, payments, selectedYear, selectedMonth]);

  const growthBars = useMemo(
    () => clientGrowthChartDataForYear(apartments, selectedYear),
    [apartments, selectedYear],
  );
  const growthMax = useMemo(() => Math.max(...growthBars.map((d) => d.value), 1), [growthBars]);

  const revenueBars = useMemo(
    () => monthlyRevenueChartData(payments, selectedYear),
    [payments, selectedYear],
  );
  const revenueMax = useMemo(() => Math.max(...revenueBars.map((d) => d.value), 1), [revenueBars]);
  const highlightIndex = selectedMonth === 'all' ? null : Number(selectedMonth);

  const revenueCardTitle = metrics.period.hasSingleMonth
    ? `Monthly Revenue (${metrics.period.monthLabel} ${selectedYear})`
    : `Year Revenue (${selectedYear})`;
  const revenueCardValue = metrics.period.hasSingleMonth
    ? metrics.period.monthTotal
    : metrics.period.yearTotal;

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
              <SuperAdminPeriodFilter
                years={yearOptions}
                selectedYear={selectedYear}
                onYearChange={setSelectedYear}
                selectedMonth={selectedMonth}
                onMonthChange={setSelectedMonth}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-6">
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
                      <p className="text-gray-500 text-sm">Total Revenue (All Time)</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(metrics.allTimeRevenue)}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                      <IndianRupee size={24} />
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl bg-white border border-gray-100 p-6 shadow-sm">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-500 text-sm">{revenueCardTitle}</p>
                      <p className="text-2xl font-bold text-gray-900 mt-2">{formatCurrency(revenueCardValue)}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        New clients: {metrics.newClients}
                      </p>
                    </div>
                    <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
                      <TrendingUp size={24} />
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
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Client Growth ({selectedYear})
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedMonth === 'all'
                        ? `${metrics.newClients} new clients this year`
                        : `${metrics.newClients} new in ${metrics.period.monthLabel} ${selectedYear}`}
                    </p>
                  </div>
                  <SuperAdminGrowthBarChart
                    data={growthBars}
                    max={growthMax}
                    highlightIndex={highlightIndex}
                  />
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                  <div className="mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Monthly Revenue ({selectedYear})
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedMonth === 'all'
                        ? `Year total: ${formatCurrency(metrics.period.yearTotal)} · All time: ${formatCurrency(metrics.allTimeRevenue)}`
                        : `${metrics.period.monthLabel} ${selectedYear}: ${formatCurrency(metrics.period.monthTotal)} · Year: ${formatCurrency(metrics.period.yearTotal)}`}
                    </p>
                  </div>
                  <SuperAdminRevenueBarChart
                    data={revenueBars}
                    max={revenueMax}
                    highlightIndex={highlightIndex}
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

export default SAAnalytics;
