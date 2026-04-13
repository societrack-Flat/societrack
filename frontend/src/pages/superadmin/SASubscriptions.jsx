import React, { useState, useEffect } from 'react';
import { CreditCard, Search, RefreshCw, Building2, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate } from '../../lib/supabaseClient';
import { planDisplayName } from '../../lib/superadminMetrics';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import EmptyState from '../../components/EmptyState';
import Modal from '../../components/Modal';
import InputField from '../../components/InputField';
import toast from 'react-hot-toast';

const SASubscriptions = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingApartment, setEditingApartment] = useState(null);
  const [editData, setEditData] = useState({
    plan_name: '',
    subscription_status: '',
    flat_limit: '',
    monthly_price: '',
  });

  const { userProfile } = useAuth();

  useEffect(() => {
    try {
      const pre = sessionStorage.getItem('sa_sub_search');
      if (pre) {
        setSearchTerm(pre);
        sessionStorage.removeItem('sa_sub_search');
      }
    } catch {
      /* ignore */
    }
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      const { data: aptData, error: aptError } = await supabase
        .from('apartments')
        .select('*')
        .order('name', { ascending: true });

      if (aptError) throw aptError;

      const { data: admins, error: adminError } = await supabase
        .from('users')
        .select('email, apartment_id')
        .eq('role', 'admin');

      if (adminError) console.warn('Admin emails:', adminError);

      const emailByApt = {};
      (admins || []).forEach((u) => {
        if (u.apartment_id && !emailByApt[u.apartment_id]) {
          emailByApt[u.apartment_id] = u.email;
        }
      });

      const merged = (aptData || []).map((apt) => ({
        ...apt,
        _adminEmail: emailByApt[apt.id] || '—',
      }));

      setRows(merged);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleEdit = (apt) => {
    setEditingApartment(apt);
    setEditData({
      plan_name: apt.plan_name || 'free_trial',
      subscription_status: apt.subscription_status || 'trial',
      flat_limit: apt.flat_limit?.toString() || '50',
      monthly_price: apt.monthly_price?.toString() || '0',
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    try {
      const { error } = await supabase
        .from('apartments')
        .update({
          plan_name: editData.plan_name,
          subscription_status: editData.subscription_status,
          flat_limit: parseInt(editData.flat_limit, 10),
          monthly_price: parseFloat(editData.monthly_price),
        })
        .eq('id', editingApartment.id);

      if (error) throw error;

      toast.success('Subscription updated successfully');
      setShowEditModal(false);
      setEditingApartment(null);
      fetchData();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription');
    }
  };

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-800',
      trial: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
      expired: 'bg-red-100 text-red-800',
    };
    return styles[status] || styles.inactive;
  };

  const filtered = rows.filter((apt) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (apt.name || '').toLowerCase().includes(q) ||
      (apt._adminEmail || '').toLowerCase().includes(q)
    );
  });

  const planLabel = (apt) => planDisplayName(apt.plan_name, apt.monthly_price);

  const startDate = (apt) => {
    if (apt.trial_start_date) return formatDate(apt.trial_start_date);
    if (apt.created_at) return formatDate(apt.created_at);
    return '—';
  };

  const expiryDate = (apt) => {
    if (apt.trial_end_date) return formatDate(apt.trial_end_date);
    if (apt.next_billing_date) return formatDate(apt.next_billing_date);
    return '—';
  };

  const statusLabel = (apt) => {
    const s = String(apt.subscription_status || '').toLowerCase();
    if (s === 'active') return 'Active';
    if (s === 'trial') return 'Trial';
    if (s === 'inactive') return 'Inactive';
    if (s === 'expired') return 'Expired';
    return 'Inactive';
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Super Admin" />

        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Subscriptions</h1>
            <p className="text-gray-500 mt-1">Manage subscription plans for all apartments</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="p-4 lg:p-6 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search apartment or admin email…"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <Button variant="outline" size="sm" icon={RefreshCw} onClick={fetchData}>
                  Refresh
                </Button>
              </div>

              {filtered.length === 0 ? (
                <div className="p-12">
                  <EmptyState
                    icon={CreditCard}
                    title="No subscriptions"
                    message="No apartments match your search"
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px]">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Apartment Name</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Admin Email</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Current Plan</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Start Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Expiry Date</th>
                        <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Status</th>
                        <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {filtered.map((apt) => (
                        <tr key={apt.id} className="hover:bg-gray-50/80">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 bg-blue-50 rounded-lg">
                                <Building2 className="text-blue-600" size={16} />
                              </div>
                              <span className="font-medium text-gray-900">{apt.name}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-700">{apt._adminEmail}</td>
                          <td className="py-3 px-4 text-sm text-gray-800">{planLabel(apt)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{startDate(apt)}</td>
                          <td className="py-3 px-4 text-sm text-gray-600">{expiryDate(apt)}</td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadge(apt.subscription_status)}`}
                            >
                              {statusLabel(apt)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => handleEdit(apt)}
                              className="inline-flex items-center justify-center p-2 rounded-lg text-gray-600 hover:bg-gray-100"
                              title="Edit"
                            >
                              <Pencil size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Modal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Subscription"
        subtitle={editingApartment ? `Update subscription for ${editingApartment.name}` : ''}
      >
        <form onSubmit={handleEditSubmit} className="space-y-5">
          <InputField
            label="Plan Name"
            type="select"
            name="plan_name"
            value={editData.plan_name}
            onChange={(e) => setEditData({ ...editData, plan_name: e.target.value })}
            options={[
              { value: 'free_trial', label: 'Free' },
              { value: 'basic', label: '₹499 Plan' },
            ]}
          />

          <InputField
            label="Status"
            type="select"
            name="subscription_status"
            value={editData.subscription_status}
            onChange={(e) => setEditData({ ...editData, subscription_status: e.target.value })}
            options={[
              { value: 'trial', label: 'Trial' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'expired', label: 'Expired' },
            ]}
          />

          <InputField
            label="Flat Limit"
            type="number"
            name="flat_limit"
            value={editData.flat_limit}
            onChange={(e) => setEditData({ ...editData, flat_limit: e.target.value })}
            min="1"
          />

          <InputField
            label="Monthly Price (₹)"
            type="number"
            name="monthly_price"
            value={editData.monthly_price}
            onChange={(e) => setEditData({ ...editData, monthly_price: e.target.value })}
            min="0"
          />

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" variant="secondary" fullWidth>
              Save
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default SASubscriptions;
