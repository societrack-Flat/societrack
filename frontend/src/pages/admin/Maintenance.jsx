import React, { useState, useEffect } from 'react';
import { Clock, Search, CheckCircle, AlertCircle, IndianRupee, Users, DoorOpen, Calendar, Download } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, getMonthName } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

const Maintenance = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState([]);
  const [flats, setFlats] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState(null);
  const [paymentData, setPaymentData] = useState({
    paid_amount: '',
    payment_mode: 'cash',
    reference_number: '',
    paid_date: new Date().toISOString().split('T')[0],
  });
  const [stats, setStats] = useState({
    totalFlats: 0,
    paidCount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  });

  const { apartment, userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchFlats();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded]);

  useEffect(() => {
    if (activeApartmentId && flats.length > 0) {
      fetchMaintenance();
    }
  }, [activeApartmentId, selectedMonth, selectedYear, flats]);

  const fetchFlats = async () => {
    try {
      const { data, error } = await supabase
        .from('flats')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .order('flat_number');

      if (error) throw error;
      setFlats(data || []);
    } catch (error) {
      console.error('Error fetching flats:', error);
      toast.error('Failed to load flats');
    }
  };

  /** Expected maintenance due for a flat (monthly + arrears + other) — same idea as dashboard “pending maintenance”. */
  const dueFromFlat = (flat) =>
    Number(flat?.monthly_maintenance ?? 0) +
    Number(flat?.pending_maintenance ?? 0) +
    Number(flat?.other_maintenance ?? 0);

  const normalizeFlatForRow = (flat) => ({
    ...flat,
    owner_name: flat.resident_name || flat.owner_name,
    owner_phone: flat.resident_phone || flat.owner_phone,
  });

  const fetchMaintenance = async () => {
    try {
      setLoading(true);

      // Fetch existing maintenance records
      const { data: maintenanceData, error } = await supabase
        .from('maintenance')
        .select(`
          *,
          flats (flat_number, owner_name, owner_phone)
        `)
        .eq('apartment_id', activeApartmentId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      if (error) throw error;

      // Create a map of existing records
      const existingMap = new Map(
        maintenanceData?.map(m => [m.flat_id, m]) || []
      );

      // Create combined list with all flats
      const combinedData = flats.map((flat) => {
        const f = normalizeFlatForRow(flat);
        const existing = existingMap.get(flat.id);
        const baseDue = dueFromFlat(flat);

        if (existing) {
          const raw = Number(existing.amount ?? 0);
          const amount =
            existing.status === 'pending' && (raw === 0 || Number.isNaN(raw)) ? baseDue : raw;
          return {
            ...existing,
            amount,
            flats: { ...f, ...(existing.flats || {}) },
          };
        }

        return {
          id: null,
          apartment_id: activeApartmentId,
          flat_id: flat.id,
          month: selectedMonth,
          year: selectedYear,
          amount: baseDue,
          status: baseDue > 0 ? 'pending' : 'paid',
          paid_date: null,
          paid_amount: 0,
          flats: f,
        };
      });

      setMaintenance(combinedData);

      // Calculate stats
      const paidCount = combinedData.filter(m => m.status === 'paid').length;
      const pendingCount = combinedData.filter(m => m.status === 'pending').length;
      const pendingAmount = combinedData
        .filter(m => m.status === 'pending')
        .reduce((sum, m) => sum + Number(m.amount || 0), 0);

      setStats({
        totalFlats: flats.length,
        paidCount,
        pendingCount,
        pendingAmount,
      });
    } catch (error) {
      console.error('Error fetching maintenance:', error);
      toast.error('Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = (item) => {
    setSelectedMaintenance(item);
    setPaymentData({
      paid_amount: item.amount?.toString() || '',
      payment_mode: 'cash',
      reference_number: '',
      paid_date: new Date().toISOString().split('T')[0],
    });
    setShowPayModal(true);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();

    if (!paymentData.paid_amount || parseFloat(paymentData.paid_amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);

      const maintenanceData = {
        apartment_id: apartment.id,
        flat_id: selectedMaintenance.flat_id,
        month: selectedMonth,
        year: selectedYear,
        amount: parseFloat(paymentData.paid_amount),
        paid_amount: parseFloat(paymentData.paid_amount),
        status: 'paid',
        paid_date: paymentData.paid_date,
        payment_mode: paymentData.payment_mode,
        reference_number: paymentData.reference_number || null,
      };

      if (selectedMaintenance.id) {
        // Update existing record
        const { error } = await supabase
          .from('maintenance')
          .update(maintenanceData)
          .eq('id', selectedMaintenance.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('maintenance')
          .insert(maintenanceData);

        if (error) throw error;
      }

      // Also add to income
      await supabase.from('income').insert({
        apartment_id: apartment.id,
        flat_id: selectedMaintenance.flat_id,
        amount: parseFloat(paymentData.paid_amount),
        category: 'Maintenance',
        description: `Maintenance for ${getMonthName(selectedMonth)} ${selectedYear}`,
        date: paymentData.paid_date,
        payment_mode: paymentData.payment_mode,
        reference_number: paymentData.reference_number || null,
        created_by: userProfile.id,
      });

      toast.success('Payment recorded successfully');
      setShowPayModal(false);
      setSelectedMaintenance(null);
      fetchMaintenance();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast.error('Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkMarkPaid = async () => {
    const pendingItems = maintenance.filter(m => m.status === 'pending');
    
    if (pendingItems.length === 0) {
      toast.error('No pending maintenance to mark as paid');
      return;
    }

    const amount = prompt(`Enter maintenance amount for all ${pendingItems.length} pending flats:`);
    
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      toast.error('Invalid amount');
      return;
    }

    if (!confirm(`Mark all ${pendingItems.length} pending flats as paid with ${formatCurrency(amount)} each?`)) {
      return;
    }

    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];

      // Create maintenance records
      const maintenanceRecords = pendingItems.map(item => ({
        apartment_id: apartment.id,
        flat_id: item.flat_id,
        month: selectedMonth,
        year: selectedYear,
        amount: parseFloat(amount),
        paid_amount: parseFloat(amount),
        status: 'paid',
        paid_date: today,
        payment_mode: 'cash',
      }));

      await supabase
        .from('maintenance')
        .upsert(maintenanceRecords, {
          onConflict: 'apartment_id,flat_id,month,year'
        });

      // Create income records
      const incomeRecords = pendingItems.map(item => ({
        apartment_id: apartment.id,
        flat_id: item.flat_id,
        amount: parseFloat(amount),
        category: 'Maintenance',
        description: `Maintenance for ${getMonthName(selectedMonth)} ${selectedYear}`,
        date: today,
        payment_mode: 'cash',
        created_by: userProfile.id,
      }));

      await supabase.from('income').insert(incomeRecords);

      toast.success(`Marked ${pendingItems.length} flats as paid`);
      fetchMaintenance();
    } catch (error) {
      console.error('Error bulk marking paid:', error);
      toast.error('Failed to mark as paid');
    } finally {
      setLoading(false);
    }
  };

  const filteredMaintenance = maintenance.filter((item) => {
    if (searchTerm === '') return true;
    const q = searchTerm.toLowerCase();
    const f = item.flats || {};
    return (
      (f.flat_number && String(f.flat_number).toLowerCase().includes(q)) ||
      (f.owner_name && String(f.owner_name).toLowerCase().includes(q)) ||
      (f.resident_name && String(f.resident_name).toLowerCase().includes(q))
    );
  });

  const handleDownloadOverallFlatPending = () => {
    if (!flats.length) {
      toast.error('No flats to export');
      return;
    }
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = [
      'Flat',
      'Resident/Owner',
      'Phone',
      'Monthly maintenance',
      'Pending (arrears)',
      'Other charges',
      'Total (monthly + pending + other)',
    ];
    let grand = 0;
    const lines = [
      header.join(','),
      ...flats.map((f) => {
        const m = Number(f.monthly_maintenance ?? 0);
        const p = Number(f.pending_maintenance ?? 0);
        const o = Number(f.other_maintenance ?? 0);
        const t = m + p + o;
        grand += t;
        return [
          f.flat_number ?? '',
          escape(f.resident_name || f.owner_name || ''),
          escape(f.resident_phone || f.owner_phone || ''),
          m,
          p,
          o,
          t,
        ].join(',');
      }),
      ['', '', '', '', '', 'Grand total (all flats)', grand].join(','),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `all-flats-pending-and-charges-${apartment?.name?.replace(/\s+/g, '_') || 'society'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Overall pending export started');
  };

  const handleDownloadPending = () => {
    const pending = filteredMaintenance.filter((m) => m.status === 'pending');
    if (pending.length === 0) {
      toast.error('No pending maintenance rows to download');
      return;
    }
    const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Flat', 'Owner', 'Phone', 'Amount', 'Month', 'Year', 'Status'];
    const lines = [
      header.join(','),
      ...pending.map((r) =>
        [
          r.flats?.flat_number ?? '',
          escape(r.flats?.owner_name || ''),
          escape(r.flats?.owner_phone || ''),
          r.amount ?? '',
          selectedMonth,
          selectedYear,
          r.status,
        ].join(','),
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pending-maintenance-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Download started');
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i + 1),
  }));

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: new Date().getFullYear() - i,
    label: (new Date().getFullYear() - i).toString(),
  }));

  const allPaid = stats.pendingCount === 0 && stats.totalFlats > 0;

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Maintenance" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Maintenance</h1>
            <p className="text-gray-500 mt-1">Track monthly maintenance and payments per flat</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {years.map(year => (
                <option key={year.value} value={year.value}>{year.label}</option>
              ))}
            </select>

            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by flat or owner..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <Button variant="outline" icon={Download} onClick={handleDownloadPending}>
              Download month pending
            </Button>
            <Button variant="outline" icon={Download} onClick={handleDownloadOverallFlatPending}>
              Download all flats (totals)
            </Button>

            {stats.pendingCount > 0 && (
              <Button variant="primary" icon={CheckCircle} onClick={handleBulkMarkPaid}>
                Mark All Paid
              </Button>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card
              icon={DoorOpen}
              label="Total Flats"
              value={stats.totalFlats}
              color="blue"
            />
            <Card
              icon={CheckCircle}
              label="Flats Paid"
              value={stats.paidCount}
              color="green"
            />
            <Card
              icon={AlertCircle}
              label="Flats Pending"
              value={stats.pendingCount}
              color="red"
            />
            <Card
              icon={IndianRupee}
              label="Pending Amount"
              value={formatCurrency(stats.pendingAmount)}
              color="yellow"
            />
          </div>

          {/* All Paid Banner */}
          {allPaid && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 mb-6 flex items-center gap-4">
              <div className="p-3 bg-green-100 rounded-full">
                <CheckCircle className="text-green-600" size={32} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-900">All Maintenance Collected!</h3>
                <p className="text-green-700">
                  All {stats.totalFlats} flats have paid their maintenance for {getMonthName(selectedMonth)} {selectedYear}.
                </p>
              </div>
            </div>
          )}

          {loading && maintenance.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : flats.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No flats found"
              message="Add flats to start tracking maintenance"
              actionLabel="Add Flats"
              onAction={() => window.location.href = '/admin/flats'}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Flat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Owner</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Phone</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Paid Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMaintenance.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">
                          {item.flats?.flat_number}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.flats?.owner_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.flats?.owner_phone || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                            item.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {item.status === 'paid' ? (
                              <CheckCircle size={14} />
                            ) : (
                              <AlertCircle size={14} />
                            )}
                            {item.status === 'paid' ? 'Paid' : 'Pending'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          {item.status === 'paid' ? (
                            <span className="font-semibold text-green-600">
                              {formatCurrency(item.paid_amount || item.amount)}
                            </span>
                          ) : (
                            <span className="font-semibold text-amber-800">
                              {formatCurrency(item.amount ?? 0)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.paid_date ? formatDate(item.paid_date) : '-'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {item.status === 'pending' ? (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleMarkAsPaid(item)}
                            >
                              Mark Paid
                            </Button>
                          ) : (
                            <span className="text-sm text-green-600 font-medium">✓ Collected</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Payment Modal */}
      <Modal
        isOpen={showPayModal}
        onClose={() => setShowPayModal(false)}
        title="Record Payment"
        subtitle={`Mark maintenance as paid for Flat ${selectedMaintenance?.flats?.flat_number}`}
      >
        <form onSubmit={handlePaymentSubmit} className="space-y-5">
          <InputField
            label="Amount"
            type="number"
            name="paid_amount"
            placeholder="0.00"
            value={paymentData.paid_amount}
            onChange={(e) => setPaymentData({ ...paymentData, paid_amount: e.target.value })}
            icon={IndianRupee}
            required
            min="0"
            step="0.01"
          />

          <InputField
            label="Payment Date"
            type="date"
            name="paid_date"
            value={paymentData.paid_date}
            onChange={(e) => setPaymentData({ ...paymentData, paid_date: e.target.value })}
            icon={Calendar}
            required
          />

          <InputField
            label="Payment Mode"
            type="select"
            name="payment_mode"
            value={paymentData.payment_mode}
            onChange={(e) => setPaymentData({ ...paymentData, payment_mode: e.target.value })}
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
            type="text"
            name="reference_number"
            placeholder="Transaction ID / Receipt No"
            value={paymentData.reference_number}
            onChange={(e) => setPaymentData({ ...paymentData, reference_number: e.target.value })}
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowPayModal(false)}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading}
              fullWidth
            >
              Record Payment
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Maintenance;
