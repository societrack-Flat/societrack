import React, { useState, useEffect } from 'react';
import { IndianRupee, Search, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate } from '../../lib/supabaseClient';
import { openAttachment } from '../../lib/openAttachment';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const ResIncome = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState([]);
  const [flats, setFlats] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');

  const { apartment, residentApartmentId, isResident, profileLoaded } = useAuth();
  const apartmentId = apartment?.id || residentApartmentId;

  useEffect(() => {
    if (apartmentId) {
      fetchIncomeAndFlats();
    } else if (isResident || profileLoaded) {
      setLoading(false);
    }
  }, [apartmentId, isResident, profileLoaded]);

  const fetchIncomeAndFlats = async () => {
    try {
      setLoading(true);
      const [{ data: incomeRows, error: incomeError }, { data: flatRows, error: flatError }] = await Promise.all([
        supabase
          .from('income')
          .select('*')
          .eq('apartment_id', apartmentId)
          .order('date', { ascending: false })
          .order('created_at', { ascending: false, nullsFirst: false }),
        supabase.from('flats').select('id, flat_number, owner_name, resident_name').eq('apartment_id', apartmentId),
      ]);
      if (incomeError) throw incomeError;
      if (flatError) console.warn('Flats list:', flatError);
      const rows = incomeRows || [];
      rows.sort((a, b) => {
        const byDate = String(b.date || '').localeCompare(String(a.date || ''));
        if (byDate !== 0) return byDate;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
      setIncome(rows);
      setFlats(flatRows || []);
    } catch (error) {
      console.error('Error fetching income:', error);
      toast.error('Failed to load income records');
    } finally {
      setLoading(false);
    }
  };

  const flatForIncome = (item) =>
    item?.flat_id ? flats.find((f) => f.id === item.flat_id) : null;

  const handleViewAttachment = async (attachmentUrl) => {
    try {
      await openAttachment(attachmentUrl);
    } catch (error) {
      console.error('Error viewing attachment:', error);
      toast.error(error?.message || 'Failed to view attachment');
    }
  };

  const filteredIncome = income.filter(item => {
    const flatNum = flatForIncome(item)?.flat_number?.toLowerCase() || '';
    const matchesSearch = searchTerm === '' || 
      (item.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      flatNum.includes(searchTerm.toLowerCase());

    const matchesMonth = selectedMonth === 'all' || 
      new Date(item.date).getMonth() + 1 === parseInt(selectedMonth);

    return matchesSearch && matchesMonth;
  });

  const totalAmount = filteredIncome.reduce((sum, item) => sum + Number(item.amount), 0);

  const months = [
    { value: 'all', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' },
  ];

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role="resident" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Income Records" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Income Records</h1>
            <p className="text-gray-500 mt-1">View society income and receipts (read-only)</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>

          {/* Summary Card */}
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">
                  Total Income {selectedMonth !== 'all' ? `(${months.find(m => m.value === selectedMonth)?.label})` : ''}
                </p>
                <p className="text-3xl font-bold text-green-600 mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="p-4 bg-green-100 rounded-lg">
                <IndianRupee className="text-green-600" size={32} />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredIncome.length === 0 ? (
            <EmptyState
              icon={IndianRupee}
              title="No income records found"
              message={searchTerm ? 'No records match your search' : 'No income records available'}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Flat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Attachment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredIncome.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {flatForIncome(item)?.flat_number || '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-green-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4">
                          {item.attachment_url ? (
                            <button
                              onClick={() => handleViewAttachment(item.attachment_url)}
                              className="text-blue-600 hover:text-blue-700 text-sm flex items-center gap-1"
                            >
                              <FileText size={16} />
                              View
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">-</span>
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
    </div>
  );
};

export default ResIncome;
