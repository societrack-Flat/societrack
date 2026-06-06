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
import { maintenanceApi } from '../../lib/apiClient';
import { autoClosePriorMonths } from '../../lib/maintenanceAutoRollover';
import { downloadTextFile, downloadPdf } from '../../lib/downloadFile';
import { dueFromFlat } from '../../utils/maintenancePending';

const Maintenance = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState([]);
  const [flats, setFlats] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [rolloverLoading, setRolloverLoading] = useState(false);
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

  const normalizeFlatForRow = (flat) => ({
    ...flat,
    owner_name: flat.resident_name || flat.owner_name,
    owner_phone: flat.resident_phone || flat.owner_phone,
  });

  const fetchMaintenance = async (flatsList) => {
    let list = flatsList === undefined ? flats : (flatsList || []);
    if (!list || list.length === 0) {
      setMaintenance([]);
      setStats({ totalFlats: 0, paidCount: 0, pendingCount: 0, pendingAmount: 0 });
      return;
    }
    try {
      setLoading(true);

      try {
        await autoClosePriorMonths(activeApartmentId, selectedYear, selectedMonth);
        const { data: refreshedFlats, error: flatsErr } = await supabase
          .from('flats')
          .select('*')
          .eq('apartment_id', activeApartmentId)
          .order('flat_number');
        if (!flatsErr && refreshedFlats) {
          list = refreshedFlats;
          if (flatsList === undefined) setFlats(refreshedFlats);
        }
      } catch (rolloverErr) {
        console.warn('Auto month rollover skipped:', rolloverErr);
      }

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
      const combinedData = list.map((flat) => {
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
        totalFlats: list.length,
        paidCount,
        pendingCount,
        pendingAmount,
      });
    } catch (error) {
      console.error('Error fetching maintenance data:', error);
      toast.error('Failed to load maintenance data');
    } finally {
      setLoading(false);
    }
  };

  const handleMonthEndRollover = async () => {
    if (!activeApartmentId) return;
    const label = `${getMonthName(selectedMonth)} ${selectedYear}`;
    if (
      !window.confirm(
        `Close month for ${label}?\n\n` +
          'Unpaid amounts for that month are added to each flat’s old balance (arrears), and maintenance rows for that month are removed. This cannot be undone.\n\n' +
          'Use the month selector above to choose which month to close (usually the month you have finished collecting).'
      )
    ) {
      return;
    }
    try {
      setRolloverLoading(true);
      const res = await maintenanceApi.rollover({
        apartment_id: activeApartmentId,
        close_year: selectedYear,
        close_month: selectedMonth,
      });
      const parts = [
        res.flats_updated != null && `${res.flats_updated} flat(s) updated`,
        res.rows_deleted != null && `${res.rows_deleted} month record(s) cleared`,
      ].filter(Boolean);
      toast.success(`Month closed${parts.length ? `: ${parts.join(', ')}` : ''}.`);
      const { data: newFlats, error: fe } = await supabase
        .from('flats')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .order('flat_number');
      if (fe) throw fe;
      setFlats(newFlats || []);
      await fetchMaintenance(newFlats || []);
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not run month-end rollover. Is the API running?');
    } finally {
      setRolloverLoading(false);
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

  const handleDownloadOverallFlatPending = async () => {
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
    await downloadTextFile(
      lines.join('\n'),
      `all-flats-pending-and-charges-${apartment?.name?.replace(/\s+/g, '_') || 'society'}.csv`,
    );
    toast.success('Overall pending export started');
  };

  const handleDownloadStatusPdf = async () => {
    const pendingOnly = filteredMaintenance.filter(
      (r) => String(r.status || '').toLowerCase() === 'pending',
    );
    if (!pendingOnly.length) {
      toast.error('No pending maintenance to export. Clear the search or pick a month with pending rows.');
      return;
    }

    // jsPDF default fonts do not draw ₹ reliably; use ASCII "Rs. " so amounts are never clipped or garbled.
    const inrForPdf = (n) => {
      const v = Number(n) || 0;
      return `Rs. ${v.toLocaleString('en-IN', { maximumFractionDigits: 0, minimumFractionDigits: 0 })}`;
    };

    const periodLabel = `${getMonthName(selectedMonth)} ${selectedYear}`;
    const aptName = apartment?.name || 'Society';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    doc.setFontSize(15);
    doc.setTextColor(0);
    doc.text('Maintenance status report (pending only)', 14, 16);
    doc.setFontSize(11);
    doc.text(aptName, 14, 24);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text(`Period: ${periodLabel}`, 14, 30);
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 14, 35);
    doc.setTextColor(0, 0, 0);

    let sumMonthly = 0;
    let sumArrears = 0;
    let sumOther = 0;
    let sumTotal = 0;
    let sumMonthAmt = 0;

    const body = pendingOnly.map((r) => {
      const f = r.flats || {};
      const m = Number(f.monthly_maintenance ?? 0);
      const p = Number(f.pending_maintenance ?? 0);
      const o = Number(f.other_maintenance ?? 0);
      const tot = m + p + o;
      const rec = Number(r.amount ?? 0);
      const status = r.status === 'paid' ? 'Paid' : r.status === 'pending' ? 'Pending' : String(r.status ?? '—');

      sumMonthly += m;
      sumArrears += p;
      sumOther += o;
      sumTotal += tot;
      sumMonthAmt += rec;

      return [
        String(f.flat_number ?? '—'),
        String(f.resident_name || f.owner_name || '—'),
        inrForPdf(m),
        inrForPdf(p),
        inrForPdf(o),
        inrForPdf(tot),
        status,
        inrForPdf(rec),
      ];
    });

    doc.autoTable({
      startY: 40,
      head: [
        [
          'Flat',
          'Owner',
          'Current month (fee)',
          'Old balance',
          'Other',
          'Total outstanding',
          'Status',
          'Amount for month',
        ],
      ],
      body,
      foot: [
        [
          'Totals',
          '',
          inrForPdf(sumMonthly),
          inrForPdf(sumArrears),
          inrForPdf(sumOther),
          inrForPdf(sumTotal),
          '',
          inrForPdf(sumMonthAmt),
        ],
      ],
      theme: 'striped',
      tableWidth: pageWidth - 24,
      margin: { left: 12, right: 12 },
      headStyles: { fillColor: [34, 197, 94], fontSize: 8, cellPadding: 1.5 },
      footStyles: { fillColor: [254, 243, 199], textColor: [0, 0, 0], fontStyle: 'bold', fontSize: 8 },
      styles: { fontSize: 8, cellPadding: 1.4, minCellHeight: 6 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 34 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 32 },
        6: { halign: 'center', cellWidth: 18 },
        7: { halign: 'right', cellWidth: 34 },
      },
      didParseCell: (data) => {
        if (data.section !== 'foot') return;
        const idx = data.column.index;
        if (idx >= 2 && idx <= 5) {
          data.cell.styles.halign = 'right';
        } else if (idx === 7) {
          data.cell.styles.halign = 'right';
        } else if (idx === 0) {
          data.cell.styles.halign = 'left';
        }
      },
    });

    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 6, { align: 'center' });
    }

    await downloadPdf(
      doc,
      `maintenance-status-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.pdf`,
    );
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

            <Button variant="outline" icon={Download} onClick={handleDownloadStatusPdf}>
              Download status report (PDF)
            </Button>
            <Button variant="outline" icon={Download} onClick={handleDownloadOverallFlatPending}>
              Download all flats (totals)
            </Button>

            <Button
              variant="outline"
              icon={Clock}
              disabled={!activeApartmentId || loading || flats.length === 0 || rolloverLoading}
              onClick={handleMonthEndRollover}
            >
              {rolloverLoading ? 'Closing month…' : 'Close month (move unpaid to arrears)'}
            </Button>
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
