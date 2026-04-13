import React, { useMemo, useState, useEffect } from 'react';
import { BarChart3, FileSpreadsheet, FileText, IndianRupee, TrendingUp, TrendingDown, Calendar, Search } from 'lucide-react';
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
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

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

const Reports = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('all'); // all | 1-12
  const [selectedYear, setSelectedYear] = useState('all');   // all | YYYY
  const [searchIncome, setSearchIncome] = useState('');
  const [searchExpense, setSearchExpense] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('all');
  const [stats, setStats] = useState({
    openingBalance: 0,
    totalIncome: 0,
    totalExpenses: 0,
    maintenanceCollected: 0,
    closingBalance: 0,
  });
  const [incomeData, setIncomeData] = useState([]);
  const [expenseData, setExpenseData] = useState([]);

  const { apartment, userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (!activeApartmentId && profileLoaded) setLoading(false);
  }, [activeApartmentId, profileLoaded]);

  useEffect(() => {
    if (!activeApartmentId) return;
    fetchReportData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeApartmentId, selectedMonth, selectedYear]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const aptId = activeApartmentId;
      if (!aptId) return;

      // Date range
      const yearNum = selectedYear === 'all' ? null : parseInt(selectedYear);
      const monthNum = selectedMonth === 'all' ? null : parseInt(selectedMonth);
      const startDate = (yearNum && monthNum)
        ? `${yearNum}-${String(monthNum).padStart(2, '0')}-01`
        : yearNum
          ? `${yearNum}-01-01`
          : null;
      const endDate = (yearNum && monthNum)
        ? (monthNum === 12 ? `${yearNum + 1}-01-01` : `${yearNum}-${String(monthNum + 1).padStart(2, '0')}-01`)
        : yearNum
          ? `${yearNum + 1}-01-01`
          : null;

      // Income
      let incomeQuery = supabase
        .from('income')
        .select(`*, flats(flat_number, owner_name)`)
        .eq('apartment_id', aptId);
      if (startDate) incomeQuery = incomeQuery.gte('date', startDate);
      if (endDate) incomeQuery = incomeQuery.lt('date', endDate);
      const { data: monthIncome, error: incomeError } = await incomeQuery
        .order('date', { ascending: true });

      if (incomeError) throw incomeError;

      // Expenses
      let expenseQuery = supabase
        .from('expenses')
        .select('*')
        .eq('apartment_id', aptId);
      if (startDate) expenseQuery = expenseQuery.gte('date', startDate);
      if (endDate) expenseQuery = expenseQuery.lt('date', endDate);
      const { data: monthExpenses, error: expenseError } = await expenseQuery
        .order('date', { ascending: true });

      if (expenseError) throw expenseError;

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[Reports] fetched', {
          aptId,
          startDate,
          endDate,
          incomeCount: monthIncome?.length || 0,
          expenseCount: monthExpenses?.length || 0,
        });
      }

      // Opening balance (only meaningful for month/year filter)
      let openingBalance = 0;
      if (startDate) {
        const [{ data: prevIncome }, { data: prevExpenses }] = await Promise.all([
          supabase.from('income').select('amount').eq('apartment_id', aptId).lt('date', startDate),
          supabase.from('expenses').select('amount').eq('apartment_id', aptId).lt('date', startDate),
        ]);
        const prevIncomeTotal = prevIncome?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
        const prevExpenseTotal = prevExpenses?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
        openingBalance = prevIncomeTotal - prevExpenseTotal;
      }

      const totalIncome = monthIncome?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      const totalExpenses = monthExpenses?.reduce((sum, item) => sum + Number(item.amount), 0) || 0;
      const maintenanceCollected = monthIncome?.filter(i => i.category === 'Maintenance')
        .reduce((sum, item) => sum + Number(item.amount), 0) || 0;

      setStats({
        openingBalance,
        totalIncome,
        totalExpenses,
        maintenanceCollected,
        closingBalance: openingBalance + totalIncome - totalExpenses,
      });

      setIncomeData(monthIncome || []);
      setExpenseData(monthExpenses || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast.error('Failed to load report data');
    } finally {
      setLoading(false);
    }
  };

  const exportIncomeExcel = () => {
    if (incomeData.length === 0) {
      toast.error('No income data to export');
      return;
    }

    const data = incomeData.map(item => ({
      'Date': formatDate(item.date),
      'Flat': item.flats?.flat_number || '-',
      'Owner': item.flats?.owner_name || '-',
      'Category': item.category,
      'Description': item.description || '-',
      'Payment Mode': item.payment_mode,
      'Reference': item.reference_number || '-',
      'Amount': Number(item.amount),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Income');
    
    // Add totals row
    XLSX.utils.sheet_add_aoa(ws, [
      ['', '', '', '', '', '', 'Total:', stats.totalIncome]
    ], { origin: -1 });

    const label = selectedMonth === 'all' || selectedYear === 'all'
      ? `All_${selectedYear === 'all' ? 'Years' : selectedYear}`
      : `${getMonthName(parseInt(selectedMonth))}_${selectedYear}`;
    XLSX.writeFile(wb, `Income_${label}.xlsx`);
    toast.success('Income Excel exported successfully');
  };

  const exportExpenseExcel = () => {
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
      'Reference': item.reference_number || '-',
      'Amount': Number(item.amount),
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Expenses');
    
    XLSX.utils.sheet_add_aoa(ws, [
      ['', '', '', '', '', 'Total:', stats.totalExpenses]
    ], { origin: -1 });

    const label = selectedMonth === 'all' || selectedYear === 'all'
      ? `All_${selectedYear === 'all' ? 'Years' : selectedYear}`
      : `${getMonthName(parseInt(selectedMonth))}_${selectedYear}`;
    XLSX.writeFile(wb, `Expenses_${label}.xlsx`);
    toast.success('Expense Excel exported successfully');
  };

  const exportPDF = async () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
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
    const periodLabel =
      selectedMonth !== 'all' && selectedYear !== 'all'
        ? `${getMonthName(parseInt(selectedMonth))} ${selectedYear}`
        : selectedYear !== 'all'
          ? `Year ${selectedYear}`
          : 'All Time';
    doc.text(`Financial Report - ${periodLabel}`, 14, 34);
    doc.text(`Generated on ${formatDate(new Date())}`, 14, 40);

    // Summary Box
    doc.setDrawColor(200);
    doc.setFillColor(249, 250, 251);
    doc.roundedRect(14, 48, pageWidth - 28, 36, 3, 3, 'F');

    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text('Opening Balance:', 20, 58);
    doc.text('Total Income:', 20, 66);
    doc.text('Total Expenses:', 20, 74);
    doc.text('Closing Balance:', 20, 82);

    doc.setTextColor(0);
    doc.text(formatCurrency(stats.openingBalance), 80, 58);
    doc.setTextColor(34, 197, 94);
    doc.text(formatCurrency(stats.totalIncome), 80, 66);
    doc.setTextColor(239, 68, 68);
    doc.text(formatCurrency(stats.totalExpenses), 80, 74);
    doc.setTextColor(59, 130, 246);
    doc.setFontSize(11);
    doc.text(formatCurrency(stats.closingBalance), 80, 82);

    let yPos = 96;

    // Income Table
    if (incomeData.length > 0) {
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Income Records', 14, yPos);
      yPos += 6;

      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Flat', 'Category', 'Description', 'Amount']],
        body: incomeData.map(item => [
          formatDate(item.date),
          item.flats?.flat_number || '-',
          item.category,
          item.description?.substring(0, 30) || '-',
          formatCurrency(item.amount),
        ]),
        foot: [['', '', '', 'Total:', formatCurrency(stats.totalIncome)]],
        theme: 'striped',
        headStyles: { fillColor: [34, 197, 94] },
        footStyles: { fillColor: [240, 253, 244], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8 },
      });

      yPos = doc.lastAutoTable.finalY + 15;
    }

    // Expense Table
    if (expenseData.length > 0) {
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('Expense Records', 14, yPos);
      yPos += 6;

      doc.autoTable({
        startY: yPos,
        head: [['Date', 'Category', 'Vendor', 'Description', 'Amount']],
        body: expenseData.map(item => [
          formatDate(item.date),
          item.category,
          item.vendor_name || '-',
          item.description?.substring(0, 30) || '-',
          formatCurrency(item.amount),
        ]),
        foot: [['', '', '', 'Total:', formatCurrency(stats.totalExpenses)]],
        theme: 'striped',
        headStyles: { fillColor: [239, 68, 68] },
        footStyles: { fillColor: [254, 242, 242], textColor: [0, 0, 0], fontStyle: 'bold' },
        styles: { fontSize: 8 },
      });
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }

    doc.save(`Financial_Report_${periodLabel.replace(/\s+/g, '_')}.pdf`);
    toast.success('PDF exported successfully');
  };

  const months = [
    { value: 'all', label: 'All Months' },
    ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: getMonthName(i + 1) })),
  ];

  const years = [
    { value: 'all', label: 'All Years' },
    ...Array.from({ length: 10 }, (_, i) => {
      const y = new Date().getFullYear() - i;
      return { value: String(y), label: String(y) };
    }),
  ];

  const expenseCategories = useMemo(() => {
    const set = new Set(expenseData.map((e) => e.category).filter(Boolean));
    return ['all', ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [expenseData]);

  const filteredIncome = useMemo(() => {
    const q = searchIncome.trim().toLowerCase();
    if (!q) return incomeData;
    return incomeData.filter((i) => {
      const flat = i.flats?.flat_number || '';
      const name = i.flats?.owner_name || '';
      const cat = i.category || '';
      const desc = i.description || '';
      return [flat, name, cat, desc, i.payment_mode || ''].some((s) => String(s).toLowerCase().includes(q));
    });
  }, [incomeData, searchIncome]);

  const filteredExpenses = useMemo(() => {
    const q = searchExpense.trim().toLowerCase();
    return expenseData.filter((e) => {
      const catOk = expenseCategory === 'all' || e.category === expenseCategory;
      if (!catOk) return false;
      if (!q) return true;
      return [e.category, e.vendor_name, e.description, e.payment_mode].some((s) => String(s || '').toLowerCase().includes(q));
    });
  }, [expenseData, searchExpense, expenseCategory]);

  const financialSummary = useMemo(() => {
    const map = new Map(); // YYYY-MM => { income, expense }
    const add = (ym, type, amt) => {
      if (!map.has(ym)) map.set(ym, { ym, income: 0, expense: 0 });
      map.get(ym)[type] += amt;
    };
    incomeData.forEach((r) => add((r.date || '').slice(0, 7), 'income', Number(r.amount || 0)));
    expenseData.forEach((r) => add((r.date || '').slice(0, 7), 'expense', Number(r.amount || 0)));
    const rows = Array.from(map.values())
      .filter((r) => r.ym)
      .sort((a, b) => a.ym.localeCompare(b.ym));
    let running = stats.openingBalance || 0;
    return rows.map((r) => {
      running = running + r.income - r.expense;
      return { ...r, balance: running };
    });
  }, [incomeData, expenseData, stats.openingBalance]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Financial Reports" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Financial Reports</h1>
            <p className="text-gray-500 mt-1">Summary of apartment financial activity</p>
          </div>

          {/* Filters & Export */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex flex-wrap gap-4">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {months.map(month => (
                  <option key={month.value} value={month.value}>{month.label}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {years.map(year => (
                  <option key={year.value} value={year.value}>{year.label}</option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 sm:ml-auto">
              <Button
                variant="outline"
                icon={FileSpreadsheet}
                onClick={exportIncomeExcel}
              >
                Income Excel
              </Button>
              <Button
                variant="outline"
                icon={FileSpreadsheet}
                onClick={exportExpenseExcel}
              >
                Expense Excel
              </Button>
              <Button variant="secondary" icon={FileText} onClick={exportPDF}>
                Full PDF
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
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <Card
                  icon={IndianRupee}
                  label="Opening Balance"
                  value={formatCurrency(stats.openingBalance)}
                  color="blue"
                />
                <Card
                  icon={TrendingUp}
                  label="Total Maintenance Collected"
                  value={formatCurrency(stats.maintenanceCollected)}
                  color="green"
                  subValue={`Total Income: ${formatCurrency(stats.totalIncome)}`}
                />
                <Card
                  icon={TrendingDown}
                  label="Total Expenses"
                  value={formatCurrency(stats.totalExpenses)}
                  color="red"
                />
                <Card
                  icon={BarChart3}
                  label="Current Balance"
                  value={formatCurrency(stats.closingBalance)}
                  color="blue"
                />
              </div>

              {/* Income Report */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Income Report</h3>
                  <div className="relative w-full max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      value={searchIncome}
                      onChange={(e) => setSearchIncome(e.target.value)}
                      placeholder="Search income..."
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>

                {filteredIncome.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No income records found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Flat</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Resident Name</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Month</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Payment Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredIncome.map((i) => (
                          <tr key={i.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-900">{i.flats?.flat_number || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{i.flats?.owner_name || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{(i.date || '').slice(0, 7) || '-'}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-green-600">{formatCurrency(i.amount)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{formatDate(i.date)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 capitalize">{String(i.payment_mode || '').replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Expense Report */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Expense Report</h3>
                  <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-end w-full">
                    <select
                      value={expenseCategory}
                      onChange={(e) => setExpenseCategory(e.target.value)}
                      className="bg-white border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      {expenseCategories.map((c) => (
                        <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                      ))}
                    </select>
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                      <input
                        value={searchExpense}
                        onChange={(e) => setSearchExpense(e.target.value)}
                        placeholder="Search expenses..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>

                {filteredExpenses.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No expense records found</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Title</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Category</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900 whitespace-nowrap">Expense Date</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Paid To</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Payment Mode</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {filteredExpenses.map((e) => (
                          <tr key={e.id} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-900">{e.description || e.category || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{e.category}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-red-600">{formatCurrency(e.amount)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{formatDate(e.date)}</td>
                            <td className="py-3 px-4 text-sm text-gray-600">{e.vendor_name || '-'}</td>
                            <td className="py-3 px-4 text-sm text-gray-600 capitalize">{String(e.payment_mode || '').replace('_', ' ')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Financial Summary */}
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Financial Summary</h3>
                  <p className="text-sm text-gray-500">Month-wise totals</p>
                </div>

                {financialSummary.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-8">No summary available</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Month</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Total Income</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Total Expenses</th>
                          <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {financialSummary.map((r) => (
                          <tr key={r.ym} className="hover:bg-gray-50">
                            <td className="py-3 px-4 text-sm text-gray-900">{r.ym}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-emerald-600">{formatCurrency(r.income)}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-red-600">{formatCurrency(r.expense)}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-blue-600">{formatCurrency(r.balance)}</td>
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

export default Reports;
