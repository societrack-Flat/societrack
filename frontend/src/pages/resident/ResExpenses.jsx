import React, { useState, useEffect } from 'react';
import { Receipt, Search, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate } from '../../lib/supabaseClient';
import { openAttachment } from '../../lib/openAttachment';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const ResExpenses = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const { apartment, residentApartmentId, isResident, profileLoaded } = useAuth();
  const apartmentId = apartment?.id || residentApartmentId;

  useEffect(() => {
    if (apartmentId) {
      fetchExpenses();
    } else if (isResident || profileLoaded) {
      setLoading(false);
    }
  }, [apartmentId, isResident, profileLoaded]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('expenses')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('date', { ascending: false });

      if (error) throw error;
      setExpenses(data || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      toast.error('Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleViewAttachment = async (attachmentUrl) => {
    try {
      await openAttachment(attachmentUrl);
    } catch (error) {
      console.error('Error viewing attachment:', error);
      toast.error(error?.message || 'Failed to view attachment');
    }
  };

  const categories = [...new Set(expenses.map(e => e.category))];

  const filteredExpenses = expenses.filter(item => {
    const matchesSearch = searchTerm === '' || 
      item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.vendor_name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;

    const matchesMonth = selectedMonth === 'all' || 
      new Date(item.date).getMonth() + 1 === parseInt(selectedMonth);

    return matchesSearch && matchesCategory && matchesMonth;
  });

  const totalAmount = filteredExpenses.reduce((sum, item) => sum + Number(item.amount), 0);

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
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Expense Records" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Expense Records</h1>
            <p className="text-gray-500 mt-1">View all apartment expense records</p>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search expenses..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-gray-200 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

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
                  Total Expenses {selectedMonth !== 'all' || selectedCategory !== 'all' ? '(Filtered)' : ''}
                </p>
                <p className="text-3xl font-bold text-red-600 mt-1">
                  {formatCurrency(totalAmount)}
                </p>
              </div>
              <div className="p-4 bg-red-100 rounded-lg">
                <Receipt className="text-red-600" size={32} />
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredExpenses.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No expense records found"
              message={searchTerm ? 'No records match your search' : 'No expense records available'}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Category</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Vendor</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Attachment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredExpenses.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {formatDate(item.date)}
                        </td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            {item.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">
                          {item.vendor_name || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-xs truncate">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-red-600">
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

export default ResExpenses;
