import React, { useState, useEffect, useMemo } from 'react';
import { Users, Search, RefreshCw, ExternalLink, KeyRound, Trash2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate } from '../../lib/supabaseClient';
import { superAdminApi } from '../../lib/apiClient';
import { planDisplayName } from '../../lib/superadminMetrics';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const SAUsers = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');

  const { userProfile, resetPassword } = useAuth();

  const handleSendPasswordReset = async (email) => {
    if (!email) return;
    const r = await resetPassword(email);
    if (r?.success !== false) {
      toast.success('If this email is registered, a reset link was sent.');
    }
  };

  const handleDeleteAdmin = async (user) => {
    if (!user?.id || !user?.email) return;
    const ok = window.confirm(
      `Delete admin account ${user.email}?\n\nThis removes their login. Apartment data stays in the system.`,
    );
    if (!ok) return;
    try {
      await superAdminApi.deleteAdminUser(user.id);
      toast.success('Admin account deleted');
      fetchUsers();
    } catch (e) {
      console.error(e);
      toast.error(e?.message || 'Could not delete admin account');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data: users, error: uErr } = await supabase
        .from('users')
        .select('id, email, phone, name, role, created_at, updated_at, apartment_id')
        .eq('role', 'admin')
        .order('created_at', { ascending: false });

      if (uErr) throw uErr;

      const ids = [...new Set((users || []).map((u) => u.apartment_id).filter(Boolean))];
      let aptMap = {};
      if (ids.length > 0) {
        const { data: apts, error: aErr } = await supabase
          .from('apartments')
          .select('id, name, plan_name, monthly_price, subscription_status, subscription_end_date')
          .in('id', ids);
        if (!aErr && apts) {
          aptMap = Object.fromEntries(apts.map((a) => [a.id, a]));
        }
      }

      const merged = (users || []).map((u) => ({
        ...u,
        apartments: u.apartment_id ? aptMap[u.apartment_id] || null : null,
      }));
      setRows(merged);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.email || '').toLowerCase().includes(q) ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.apartments?.name || '').toLowerCase().includes(q)
    );
  }, [rows, searchTerm]);

  const planLabel = (u) => {
    const apt = u.apartments;
    if (!apt) return '—';
    return planDisplayName(apt.plan_name, apt.monthly_price);
  };

  const statusLabel = (u) => {
    const apt = u.apartments;
    if (!apt) return '—';
    const s = String(apt.subscription_status || '').toLowerCase();
    if (s === 'active') return { text: 'Active', cls: 'bg-blue-100 text-blue-800' };
    if (s === 'trial') return { text: 'Trial', cls: 'bg-amber-100 text-amber-800' };
    return { text: 'Inactive', cls: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Super Admin" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6 flex items-start gap-3">
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Users Management</h1>
              <p className="text-gray-500 mt-1">Monitor and manage all admin accounts</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search by email, name, or apartment…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" icon={RefreshCw} onClick={fetchUsers}>
              Refresh
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Users}
              title="No admin users"
              message={searchTerm ? 'No matches' : 'No society admin accounts found'}
            />
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Admin Email</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Mobile Number</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Apartment Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Subscription Plan</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Created Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Last Login</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filtered.map((u) => {
                      const st = statusLabel(u);
                      const lastLogin = u.updated_at ? formatDate(u.updated_at) + ' (activity)' : '—';
                      return (
                        <tr key={u.id} className="hover:bg-gray-50/80">
                          <td className="py-3 px-4 text-sm font-medium text-gray-900">{u.email}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{u.phone || '—'}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{u.apartments?.name || '—'}</td>
                          <td className="py-3 px-4">
                            <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                              {planLabel(u)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-600">{formatDate(u.created_at)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600 max-w-[180px]">{lastLogin}</td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${st.cls}`}>
                              {st.text}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-2 flex-wrap">
                              <button
                                type="button"
                                className="px-2 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1"
                                onClick={() =>
                                  toast('Use “Open as admin” on Super Admin → Apartments, or sign in as that admin.', {
                                    icon: 'ℹ️',
                                  })
                                }
                              >
                                <ExternalLink size={14} /> Open
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50 inline-flex items-center gap-1"
                                onClick={() => handleSendPasswordReset(u.email)}
                              >
                                <KeyRound size={14} /> Reset email
                              </button>
                              <button
                                type="button"
                                className="px-2 py-1.5 text-xs font-medium border border-red-200 text-red-700 rounded-lg hover:bg-red-50 inline-flex items-center gap-1"
                                onClick={() => handleDeleteAdmin(u)}
                              >
                                <Trash2 size={14} /> Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

export default SAUsers;
