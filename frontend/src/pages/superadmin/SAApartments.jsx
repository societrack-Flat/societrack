import React, { useState, useEffect, useMemo } from 'react';
import { Building2, Search, RefreshCw, LogIn } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate, formatCurrency } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const SAApartments = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { userProfile, enterSaManageMode } = useAuth();
  const navigate = useNavigate();

  const handleOpenAsAdmin = async (apt) => {
    const r = await enterSaManageMode(apt.id);
    if (r.success) navigate('/admin/dashboard');
  };

  const fetchApartments = async () => {
    try {
      setLoading(true);
      const { data: apartments, error: aErr } = await supabase
        .from('apartments')
        .select('*')
        .order('created_at', { ascending: false });
      if (aErr) throw aErr;

      const { data: flats, error: fErr } = await supabase
        .from('flats')
        .select('apartment_id, monthly_maintenance');
      if (fErr) throw fErr;

      const agg = {};
      (flats || []).forEach((f) => {
        const id = f.apartment_id;
        if (!id) return;
        if (!agg[id]) agg[id] = { flatCount: 0, maintenance: 0 };
        agg[id].flatCount += 1;
        agg[id].maintenance += Number(f.monthly_maintenance || 0);
      });

      const merged = (apartments || []).map((apt) => ({
        ...apt,
        _flatCount: agg[apt.id]?.flatCount ?? 0,
        _maintenanceSum: agg[apt.id]?.maintenance ?? 0,
      }));
      setRows(merged);
    } catch (error) {
      console.error('Error fetching apartments:', error);
      toast.error('Failed to load apartments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApartments();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.city || '').toLowerCase().includes(q) ||
        (r.address || '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Super Admin" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Apartments</h1>
            <p className="text-gray-500 mt-1">Open a society to use the same admin tools (flats, income, expenses, etc.).</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by name or city…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" icon={RefreshCw} onClick={fetchApartments}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No apartments found"
              message={searchTerm ? 'Try a different search' : 'No apartments registered yet'}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Apartment Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">City</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Total Flats</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Monthly Maintenance</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Created Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((apt) => (
                      <tr key={apt.id} className="hover:bg-gray-50/80">
                        <td className="py-3 px-4 font-medium text-gray-900">{apt.name}</td>
                        <td className="py-3 px-4 text-gray-600">{apt.city || '—'}</td>
                        <td className="py-3 px-4 text-gray-800 tabular-nums">{apt._flatCount}</td>
                        <td className="py-3 px-4 text-gray-800">{formatCurrency(apt._maintenanceSum)}</td>
                        <td className="py-3 px-4 text-gray-600 text-sm">{formatDate(apt.created_at)}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-3 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleOpenAsAdmin(apt)}
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                            >
                              <LogIn size={14} />
                              Open as admin
                            </button>
                            <Link
                              to="/superadmin/subscriptions"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                              onClick={() => {
                                try {
                                  sessionStorage.setItem('sa_sub_search', apt.name || '');
                                } catch {
                                  /* ignore */
                                }
                              }}
                            >
                              Subscription
                            </Link>
                          </div>
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

export default SAApartments;
