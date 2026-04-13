import React, { useState, useEffect } from 'react';
import { Clock, Search, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, getMonthName } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Card from '../../components/Card';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const ResMaintenance = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState({
    totalFlats: 0,
    paidCount: 0,
    pendingCount: 0,
    pendingAmount: 0,
  });

  const { apartment, residentApartmentId, isResident, profileLoaded, residentFlatId } = useAuth();
  const apartmentId = apartment?.id || residentApartmentId;
  // Per-flat residents only see their own flat
  const isPerFlatResident = !!residentFlatId;

  useEffect(() => {
    if (apartmentId) {
      fetchMaintenance();
    } else if (isResident || profileLoaded) {
      setLoading(false);
    }
  }, [apartmentId, isResident, profileLoaded, selectedMonth, selectedYear, residentFlatId]);

  const fetchMaintenance = async () => {
    try {
      setLoading(true);

      if (isPerFlatResident) {
        // Per-flat resident: only show their own flat's maintenance
        const { data: flatData } = await supabase
          .from('flats')
          .select('*')
          .eq('id', residentFlatId)
          .single();

        const { data: maintenanceData } = await supabase
          .from('maintenance')
          .select('*, flats (flat_number, owner_name)')
          .eq('flat_id', residentFlatId)
          .eq('month', selectedMonth)
          .eq('year', selectedYear)
          .maybeSingle();

        const record = maintenanceData || {
          id: null,
          flat_id: residentFlatId,
          month: selectedMonth,
          year: selectedYear,
          amount: 0,
          status: 'pending',
          paid_date: null,
          flats: flatData,
        };

        setMaintenance([record]);
        setStats({
          totalFlats: 1,
          paidCount: record.status === 'paid' ? 1 : 0,
          pendingCount: record.status === 'pending' ? 1 : 0,
          pendingAmount: record.status === 'pending' ? Number(record.amount || 0) : 0,
        });
        return;
      }

      // Admin/viewer: show all flats
      const { data: flats } = await supabase
        .from('flats')
        .select('*')
        .eq('apartment_id', apartmentId)
        .order('flat_number');

      // Get maintenance records
      const { data: maintenanceData } = await supabase
        .from('maintenance')
        .select(`
          *,
          flats (flat_number, owner_name)
        `)
        .eq('apartment_id', apartmentId)
        .eq('month', selectedMonth)
        .eq('year', selectedYear);

      // Create map of existing records
      const existingMap = new Map(
        maintenanceData?.map(m => [m.flat_id, m]) || []
      );

      // Combine with all flats
      const combinedData = (flats || []).map(flat => {
        const existing = existingMap.get(flat.id);
        return existing || {
          id: null,
          flat_id: flat.id,
          month: selectedMonth,
          year: selectedYear,
          amount: 0,
          status: 'pending',
          paid_date: null,
          flats: flat,
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
        totalFlats: flats?.length || 0,
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

  const filteredMaintenance = maintenance.filter(item =>
    searchTerm === '' ||
    item.flats?.flat_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.flats?.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role="resident" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Maintenance Status" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Maintenance Status</h1>
            <p className="text-gray-500 mt-1">View maintenance payment status for all flats</p>
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
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card
              icon={Clock}
              label="Total Flats"
              value={stats.totalFlats}
              color="blue"
            />
            <Card
              icon={CheckCircle}
              label="Paid"
              value={stats.paidCount}
              color="green"
            />
            <Card
              icon={AlertCircle}
              label="Pending"
              value={stats.pendingCount}
              color="red"
            />
            <Card
              icon={Clock}
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
                  All flats have paid their maintenance for {getMonthName(selectedMonth)} {selectedYear}.
                </p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredMaintenance.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="No data found"
              message="No maintenance records for this period"
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Flat</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Owner</th>
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
                            <span className="text-gray-400">-</span>
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

export default ResMaintenance;
