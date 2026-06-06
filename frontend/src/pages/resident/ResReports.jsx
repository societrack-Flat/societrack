import React, { useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, FileText, TrendingDown, TrendingUp, Clock, CheckCircle, IndianRupee } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, getMonthName } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import Card from '../../components/Card';
import toast from 'react-hot-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import * as XLSX from 'xlsx';
import societrackLogo from '../../assets/societrack-logo.png';
import { drawBrandWordmark } from '../../lib/pdfBrand';
import { downloadXlsx, downloadPdf } from '../../lib/downloadFile';

const toDataUrl = async (url) => {
  const res = await fetch(url);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

const ResReports = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [stats, setStats] = useState({
    totalExpenses: 0,
    totalIncome: 0,
    myMaintenanceStatus: null,
    myMaintenanceAmount: 0,
  });
  const [expenseData, setExpenseData] = useState([]);
  const [incomeData, setIncomeData] = useState([]);
  const [flatsById, setFlatsById] = useState([]);
  const [myMaintenance, setMyMaintenance] = useState(null);

  const { apartment, residentApartmentId, isResident, profileLoaded, residentFlatId, residentFlatNumber } = useAuth();
  const apartmentId = apartment?.id || residentApartmentId;

  useEffect(() => {
    if (apartmentId) {
      fetchReportData();
    } else if (isResident || profileLoaded) {
      setLoading(false);
    }
  }, [apartmentId, isResident, profileLoaded, selectedMonth, selectedYear, residentFlatId]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const startDate = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`;
      const endDate = selectedMonth === 12
        ? `${selectedYear + 1}-01-01`
        : `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;

      const [
        { data: monthExpenses },
        { data: monthIncome },
        { data: flatRows },
      ] = await Promise.all([
        supabase
          .from('expenses')
          .select('*')
          .eq('apartment_id', apartmentId)
          .gte('date', startDate)
          .lt('date', endDate)
          .order('date', { ascending: true }),
        supabase
          .from('income')
          .select('*')
          .eq('apartment_id', apartmentId)
          .gte('date', startDate)
          .lt('date', endDate)
          .order('date', { ascending: true }),
        supabase.from('flats').select('id, flat_number, owner_name').eq('apartment_id', apartmentId),
      ]);

      // Per-flat resident: fetch their own maintenance for the selected month
      let maintenanceRecord = null;
      if (residentFlatId) {
        const { data: mData } = await supabase
          .from('maintenance')
          .select('*, flats(flat_number, owner_name)')
          .eq('flat_id', residentFlatId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .maybeSingle();
        maintenanceRecord = mData;
      }

      const totalExpenses = monthExpenses?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;
      const totalIncome = monthIncome?.reduce((sum, i) => sum + Number(i.amount), 0) || 0;

      setStats({
        totalExpenses,
        totalIncome,
        myMaintenanceStatus: maintenanceRecord?.status || null,
        myMaintenanceAmount: Number(maintenanceRecord?.amount || 0),
      });
      setExpenseData(monthExpenses || []);
      setIncomeData(monthIncome || []);
      setFlatsById(flatRows || []);
      setMyMaintenance(maintenanceRecord);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const flatNumberForIncome = (flatId) =>
    flatId ? flatsById.find((f) => f.id === flatId)?.flat_number || '—' : '—';

  const exportIncomeExcel = async () => {
    if (incomeData.length === 0) {
      toast.error('No income data to export');
      return;
    }

    const data = incomeData.map((item) => ({
      Date: formatDate(item.date),
      Flat: flatNumberForIncome(item.flat_id),
      Category: item.category,
      Description: item.description || '—',
      Amount: Number(item.amount),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Income');
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'Total:', stats.totalIncome]], { origin: -1 });
    await downloadXlsx(wb, `Income_${getMonthName(selectedMonth)}_${selectedYear}.xlsx`);
    toast.success('Income Excel exported');
  };

  const exportExpenseExcel = async () => {
    if (expenseData.length === 0) {
      toast.error('No expense data to export');
      return;
    }

    const data = expenseData.map(item => ({
      'Date': formatDate(item.date),
      'Category': item.category,
      'Vendor': item.vendor_name || '-',
      'Description': item.description || '-',
      'Payment Mode': item.payment_mode,
      'Amount': Number(item.amount),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    XLSX.utils.sheet_add_aoa(ws, [['', '', '', 'Total:', stats.totalExpenses]], { origin: -1 });
    await downloadXlsx(wb, `Expenses_${getMonthName(selectedMonth)}_${selectedYear}.xlsx`);
    toast.success('Expense Excel exported');
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    try {
      const dataUrl = await toDataUrl(societrackLogo);
      doc.addImage(dataUrl, 'PNG', 14, 10, 16, 16);
    } catch {
      // no-op: fallback to text header below
    }
    drawBrandWordmark(doc, 34, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(apartment?.name || '', 14, 28);
    doc.text(`Resident Report — ${getMonthName(selectedMonth)} ${selectedYear}${residentFlatNumber ? ` | Flat ${residentFlatNumber}` : ''}`, 14, 34);

    doc.setDrawColor(200);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, 44, pageWidth - 28, 32, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text('Total Society Expenses:', 20, 54);
    doc.text('Total Society Income:', 20, 62);
    doc.text('Maintenance:', 20, 70);
    doc.setTextColor(0);
    doc.text(formatCurrency(stats.totalExpenses), 80, 54);
    doc.text(formatCurrency(stats.totalIncome), 80, 62);
    doc.text(
      stats.myMaintenanceStatus
        ? `${formatCurrency(stats.myMaintenanceAmount)} (${stats.myMaintenanceStatus})`
        : 'No record',
      80, 70
    );

    let yPos = 90;
    if (expenseData.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Society Expense Records', 14, yPos);
      yPos += 6;
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Category', 'Vendor', 'Amount']],
        body: expenseData.map(item => [
          formatDate(item.date),
          item.category,
          item.vendor_name || '-',
          formatCurrency(item.amount),
        ]),
        foot: [['', '', 'Total:', formatCurrency(stats.totalExpenses)]],
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        footStyles: { fillColor: [254, 242, 242], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8 },
      });
      yPos = doc.lastAutoTable.finalY + 14;
    }

    if (incomeData.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Society Income Records', 14, yPos);
      yPos += 6;
      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Flat', 'Category', 'Amount']],
        body: incomeData.map((item) => [
          formatDate(item.date),
          flatNumberForIncome(item.flat_id),
          item.category,
          formatCurrency(item.amount),
        ]),
        foot: [['', '', 'Total:', formatCurrency(stats.totalIncome)]],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fillColor: [220, 252, 231], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8 },
      });
    }

    await downloadPdf(doc, `Resident_Report_${getMonthName(selectedMonth)}_${selectedYear}.pdf`);
    toast.success('PDF exported');
  };

  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i + 1,
    label: getMonthName(i + 1),
  }));

  const years = Array.from({ length: 5 }, (_, i) => ({
    value: new Date().getFullYear() - i,
    label: (new Date().getFullYear() - i).toString(),
  }));

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role="resident" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Financial Reports" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-gray-500 mt-1">View and download financial summaries</p>
          </div>

          {/* Filters & Export */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex gap-4">
              <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500">
                {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
              <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500">
                {years.map(y => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
            </div>
            <div className="flex flex-wrap gap-2 sm:ml-auto">
              <Button variant="outline" icon={FileSpreadsheet} onClick={exportExpenseExcel}>
                Expenses Excel
              </Button>
              <Button variant="outline" icon={IndianRupee} onClick={exportIncomeExcel}>
                Income Excel
              </Button>
              <Button variant="secondary" icon={FileText} onClick={exportPDF}>
                PDF Report
              </Button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                <Card
                  icon={TrendingDown}
                  label="Society Expenses This Month"
                  value={formatCurrency(stats.totalExpenses)}
                  color="red"
                />
                <Card
                  icon={TrendingUp}
                  label="Society Income This Month"
                  value={formatCurrency(stats.totalIncome)}
                  color="green"
                />
                {stats.myMaintenanceStatus !== null && (
                  <>
                    <Card
                      icon={stats.myMaintenanceStatus === 'paid' ? CheckCircle : Clock}
                      label={`Maintenance — ${residentFlatNumber ? `Flat ${residentFlatNumber}` : 'This Flat'}`}
                      value={stats.myMaintenanceStatus === 'paid' ? 'Paid ✓' : 'Pending'}
                      color={stats.myMaintenanceStatus === 'paid' ? 'green' : 'yellow'}
                    />
                    <Card
                      icon={BarChart3}
                      label="Maintenance amount"
                      value={formatCurrency(stats.myMaintenanceAmount)}
                      color="blue"
                    />
                  </>
                )}
              </div>

              {/* My Maintenance Detail */}
              {myMaintenance && (
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Clock size={20} className="text-yellow-500" />
                    Maintenance — {getMonthName(selectedMonth)} {selectedYear}
                  </h3>
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="font-medium text-gray-900">{myMaintenance.flats?.flat_number || `Flat ${residentFlatNumber}`}</p>
                      <p className="text-sm text-gray-500">{myMaintenance.flats?.owner_name || ''}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900">{formatCurrency(myMaintenance.amount)}</p>
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                        myMaintenance.status === 'paid'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {myMaintenance.status === 'paid' ? `Paid on ${formatDate(myMaintenance.paid_date)}` : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Society income (read-only) */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-500" />
                  Society Income — {getMonthName(selectedMonth)} {selectedYear}
                </h3>
                {incomeData.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No income records for this period</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-200 text-left text-gray-600">
                          <th className="py-2 pr-4 font-medium">Date</th>
                          <th className="py-2 pr-4 font-medium">Flat</th>
                          <th className="py-2 pr-4 font-medium">Category</th>
                          <th className="py-2 pr-4 font-medium">Description</th>
                          <th className="py-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {incomeData.map((row) => (
                          <tr key={row.id}>
                            <td className="py-2 pr-4 text-gray-900">{formatDate(row.date)}</td>
                            <td className="py-2 pr-4 text-gray-900">{flatNumberForIncome(row.flat_id)}</td>
                            <td className="py-2 pr-4">
                              <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-2 pr-4 text-gray-600 max-w-xs truncate">{row.description || '—'}</td>
                            <td className="py-2 text-right font-semibold text-green-600">{formatCurrency(row.amount)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-gray-200 bg-green-50/80">
                          <td colSpan={4} className="py-3 px-0 pr-4 font-semibold text-gray-900 text-right">
                            Total
                          </td>
                          <td className="py-3 text-right font-bold text-green-700">{formatCurrency(stats.totalIncome)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>

              {/* Expenses by Category */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <TrendingDown size={20} className="text-red-500" />
                  Society Expenses by Category
                </h3>
                {expenseData.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No expense data for this period</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(
                      expenseData.reduce((acc, item) => {
                        acc[item.category] = (acc[item.category] || 0) + Number(item.amount);
                        return acc;
                      }, {})
                    ).map(([category, amount]) => (
                      <div key={category} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <span className="text-gray-700 font-medium">{category}</span>
                        <span className="font-semibold text-red-600">{formatCurrency(amount)}</span>
                      </div>
                    ))}
                    <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100 mt-2">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="font-bold text-red-700">{formatCurrency(stats.totalExpenses)}</span>
                    </div>
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

export default ResReports;
