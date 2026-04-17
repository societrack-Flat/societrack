import React, { useState, useEffect } from 'react';
import { Clock, Search, CheckCircle, AlertCircle, IndianRupee, Users, DoorOpen, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, getMonthName } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
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

      await Promise.all(
        pendingItems.map((item) =>
          supabase.from('flats').update({ pending_maintenance: 0 }).eq('id', item.flat_id)
        )
      );

      toast.success(`Marked ${pendingItems.length} flats as paid`);
      fetchFlats();
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

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const periodLabel = `${getMonthName(selectedMonth)} ${selectedYear}`;
    const aptName = apartment?.name || 'Society';

    doc.setFontSize(16);
    doc.setTextColor(0);
    doc.text('Pending maintenance', 14, 18);
    doc.setFontSize(11);
    doc.text(aptName, 14, 26);
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.text(`Period: ${periodLabel}`, 14, 32);
    doc.text(`Generated ${formatDate(new Date())}`, 14, 38);

    const total = pending.reduce((sum, r) => sum + Number(r.amount ?? 0), 0);

    doc.autoTable({
      startY: 44,
      head: [['Flat', 'Owner', 'Phone', 'Amount', 'Status']],
      body: pending.map((r) => [
        String(r.flats?.flat_number ?? '—'),
        String(r.flats?.owner_name ?? '—'),
        String(r.flats?.owner_phone ?? '—'),
        formatCurrency(Number(r.amount ?? 0)),
        r.status === 'pending' ? 'Pending' : String(r.status ?? '—'),
      ]),
      foot: [['', '', '', 'Total pending', formatCurrency(total)]],
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      footStyles: { fillColor: [254, 243, 199], textColor: [0, 0, 0], fontStyle: 'bold' },
      styles: { fontSize: 9 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'center' },
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }

    doc.save(`pending-maintenance-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`);
    toast.success('PDF download started');
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>

    </div>
  );
};

export default Maintenance;
