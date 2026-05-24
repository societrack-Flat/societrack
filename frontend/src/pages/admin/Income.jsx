import React, { useState, useEffect, useMemo } from 'react';
import { IndianRupee, Plus, Edit2, Trash2, Search, Users, FileText, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency, formatDate, uploadFile, deleteFile, getSignedUrl, getMonthName } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';
import { CALENDAR_MONTH_OPTIONS, getMaintenanceYearOptions } from '../../utils/maintenanceMonthOptions';
import { applyMaintenanceIncomeAfterInsert } from '../../lib/applyMaintenanceIncome';

const formatMaintMonthLabel = (val) => {
  if (!val || !/^\d{4}-\d{2}$/.test(String(val))) return '—';
  const [, mStr] = String(val).split('-');
  const m = Number(mStr);
  const y = String(val).slice(0, 4);
  return `${getMonthName(m)} ${y}`;
};

const Income = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [income, setIncome] = useState([]);
  const [flats, setFlats] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('all');
  const [uploadingFile, setUploadingFile] = useState(false);
  
  const [formData, setFormData] = useState(() => {
    const d = new Date();
    return {
      flat_id: '',
      amount: '',
      category: '',
      description: '',
      date: d.toISOString().split('T')[0],
      payment_mode: 'cash',
      maintenanceYear: String(d.getFullYear()),
      maintenanceMonth: String(d.getMonth() + 1),
      maintenancePaymentTarget: 'current',
      attachment: null,
    };
  });

  const [residentPreview, setResidentPreview] = useState({
    name: '',
    phone: '',
    email: '',
  });

  const [bulkData, setBulkData] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'cash',
  });

  const [bulkRows, setBulkRows] = useState([]);
  const [bulkSelected, setBulkSelected] = useState(() => new Set());
  const [bulkFetching, setBulkFetching] = useState(false);

  const { apartment, userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchIncome();
      fetchFlats();
      fetchCategories();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded]);

  const fetchIncome = async () => {
    try {
      setLoading(true);
      // Avoid PostgREST embed — FK name varies; we join flat labels from `flats` state.
      const { data, error } = await supabase
        .from('income')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false, nullsFirst: false });

      if (error) throw error;
      const rows = data || [];
      // Tie-break same-day rows if created_at missing (older DBs)
      rows.sort((a, b) => {
        const byDate = String(b.date || '').localeCompare(String(a.date || ''));
        if (byDate !== 0) return byDate;
        const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
        const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (tb !== ta) return tb - ta;
        return String(b.id || '').localeCompare(String(a.id || ''));
      });
      setIncome(rows);
    } catch (error) {
      console.error('Error fetching income:', error);
      toast.error('Failed to load income records');
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('income_categories')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'attachment') {
      setFormData({ ...formData, attachment: files[0] });
    } else if (name === 'maintenancePaymentTarget') {
      setFormData((prev) => ({ ...prev, maintenancePaymentTarget: value }));
    } else if (name === 'category') {
      setFormData((prev) => ({
        ...prev,
        category: value,
        maintenancePaymentTarget: 'current',
      }));
    } else if (name === 'flat_id') {
      setFormData((prev) => {
        const flat = flats.find((f) => f.id === value);
        let amount = '';
        if (value && flat) {
          const maint = flat?.monthly_maintenance;
          if (maint != null && maint !== '' && !Number.isNaN(Number(maint))) {
            amount = String(Number(maint));
          }
        }
        return { ...prev, flat_id: value, amount };
      });
      const flat = flats.find((f) => f.id === value);
      if (flat) {
        setResidentPreview({
          name: flat.resident_name || flat.owner_name || '',
          phone: flat.resident_phone || flat.owner_phone || '',
          email: flat.resident_email || flat.owner_email || '',
        });
      } else {
        setResidentPreview({ name: '', phone: '', email: '' });
      }
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleBulkChange = (e) => {
    setBulkData({ ...bulkData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const isMaint = formData.category === 'Maintenance';
    const payTarget = formData.maintenancePaymentTarget;
    const isMaintSync = isMaint && formData.flat_id && (payTarget === 'current' || payTarget === 'arrears');
    if (isMaint && !formData.flat_id) {
      toast.error('Select a flat for maintenance payments');
      return;
    }
    if (isMaint && payTarget === 'current' && (!formData.maintenanceYear || !formData.maintenanceMonth)) {
      toast.error('Select year and month for current maintenance');
      return;
    }

    try {
      setLoading(true);
      let attachmentUrl = null;
      let attachmentName = null;

      if (formData.attachment) {
        setUploadingFile(true);
        const fileData = await uploadFile(formData.attachment, `income/${activeApartmentId}`);
        attachmentUrl = fileData.path;
        attachmentName = fileData.name;
        setUploadingFile(false);
      }

      const mm =
        isMaint && payTarget === 'current'
          ? `${formData.maintenanceYear}-${String(Number(formData.maintenanceMonth)).padStart(2, '0')}`
          : null;

      const incomeData = {
        apartment_id: activeApartmentId,
        flat_id: formData.flat_id || null,
        amount: parseFloat(formData.amount),
        category: formData.category,
        description: formData.description || null,
        date: formData.date,
        payment_mode: formData.payment_mode,
        maintenance_month: mm,
        maintenance_payment_target: isMaintSync ? payTarget : null,
        attachment_url: attachmentUrl || editingIncome?.attachment_url,
        attachment_name: attachmentName || editingIncome?.attachment_name,
        created_by: userProfile.id,
      };

      if (editingIncome) {
        if (attachmentUrl && editingIncome.attachment_url) {
          await deleteFile(editingIncome.attachment_url);
        }

        const { error } = await supabase.from('income').update(incomeData).eq('id', editingIncome.id);
        if (error) throw error;
        toast.success('Income updated. If payment allocation changed, verify Maintenance and Flats.');
      } else {
        const { error } = await supabase.from('income').insert(incomeData);
        if (error) throw error;
        toast.success('Income added successfully');

        if (isMaintSync) {
          try {
            await applyMaintenanceIncomeAfterInsert({
              apartmentId: activeApartmentId,
              flatId: formData.flat_id,
              amount: incomeData.amount,
              target: payTarget,
              maintenanceYear: formData.maintenanceYear,
              maintenanceMonth: formData.maintenanceMonth,
              paymentDate: formData.date,
              paymentMode: formData.payment_mode,
            });
          } catch (syncErr) {
            console.error(syncErr);
            toast.error(
              syncErr?.message ||
                'Income saved, but maintenance could not be updated. You can correct it from the Maintenance tab.'
            );
          }
        }
      }

      setShowModal(false);
      resetForm();
      fetchIncome();
    } catch (error) {
      console.error('Error saving income:', error);
      toast.error('Failed to save income');
    } finally {
      setLoading(false);
      setUploadingFile(false);
    }
  };

  const loadBulkRows = async () => {
    if (!activeApartmentId) return;
    try {
      setBulkFetching(true);
      const [{ data: flatList, error: fe }, { data: maintList, error: me }] = await Promise.all([
        supabase.from('flats').select('*').eq('apartment_id', activeApartmentId).order('flat_number'),
        supabase
          .from('maintenance')
          .select('*')
          .eq('apartment_id', activeApartmentId)
          .eq('month', Number(bulkData.month))
          .eq('year', Number(bulkData.year)),
      ]);
      if (fe) throw fe;
      if (me) throw me;
      const mMap = new Map((maintList || []).map((m) => [m.flat_id, m]));
      const rows = (flatList || []).map((flat) => {
        const m = mMap.get(flat.id);
        const status = m?.status || 'pending';
        const amount = Number(m?.amount || flat.monthly_maintenance || 0);
        return {
          flat_id: flat.id,
          flat_number: flat.flat_number,
          residentName: flat.resident_name || flat.owner_name || '—',
          amount,
          status,
          maintenanceRecord: m || null,
        };
      });
      setBulkRows(rows);
      setBulkSelected(new Set());
    } catch (err) {
      console.error(err);
      toast.error('Could not load flats for bulk collection');
    } finally {
      setBulkFetching(false);
    }
  };

  useEffect(() => {
    if (showBulkModal && activeApartmentId) {
      loadBulkRows();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when bulk period or apartment changes
  }, [showBulkModal, activeApartmentId, bulkData.month, bulkData.year]);

  const pendingCount = useMemo(() => bulkRows.filter((r) => r.status === 'pending').length, [bulkRows]);

  const toggleBulkRow = (flatId, status) => {
    if (status !== 'pending') return;
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(flatId)) next.delete(flatId);
      else next.add(flatId);
      return next;
    });
  };

  const selectAllPendingBulk = () => {
    const ids = bulkRows.filter((r) => r.status === 'pending').map((r) => r.flat_id);
    setBulkSelected(new Set(ids));
  };

  const clearBulkSelection = () => setBulkSelected(new Set());

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (bulkSelected.size === 0) {
      toast.error('Select at least one pending flat');
      return;
    }
    const monthNum = Number(bulkData.month);
    const yearNum = Number(bulkData.year);
    const paymentDate = bulkData.payment_date;
    const mode = bulkData.payment_mode;

    const selectedRows = bulkRows.filter((r) => bulkSelected.has(r.flat_id) && r.status === 'pending');
    if (selectedRows.some((r) => !r.amount || Number(r.amount) <= 0)) {
      toast.error('Selected flats must have a maintenance amount (set on flat or maintenance record)');
      return;
    }

    try {
      setLoading(true);
      const mm = `${yearNum}-${String(monthNum).padStart(2, '0')}`;

      for (const row of selectedRows) {
        const amt = Number(row.amount);
        const maintenancePayload = {
          apartment_id: activeApartmentId,
          flat_id: row.flat_id,
          month: monthNum,
          year: yearNum,
          amount: amt,
          paid_amount: amt,
          status: 'paid',
          paid_date: paymentDate,
          payment_mode: mode,
        };

        if (row.maintenanceRecord?.id) {
          const { error } = await supabase.from('maintenance').update(maintenancePayload).eq('id', row.maintenanceRecord.id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from('maintenance').insert(maintenancePayload);
          if (error) throw error;
        }

        const { error: ie } = await supabase.from('income').insert({
          apartment_id: activeApartmentId,
          flat_id: row.flat_id,
          amount: amt,
          category: 'Maintenance',
          description: `Maintenance for ${getMonthName(monthNum)} ${yearNum}`,
          date: paymentDate,
          payment_mode: mode,
          maintenance_month: mm,
          created_by: userProfile.id,
        });
        if (ie) throw ie;
      }

      toast.success(`Marked ${selectedRows.length} flat(s) as paid`);
      setShowBulkModal(false);
      setBulkData({
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: 'cash',
      });
      fetchIncome();
    } catch (error) {
      console.error('Error adding bulk collection:', error);
      toast.error(error?.message || 'Failed to record bulk collection');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingIncome(item);
    const d = new Date();
    let maintenanceYear = String(d.getFullYear());
    let maintenanceMonth = String(d.getMonth() + 1);
    if (item.maintenance_month && /^\d{4}-\d{2}$/.test(String(item.maintenance_month))) {
      const [y, m] = String(item.maintenance_month).split('-');
      maintenanceYear = y;
      maintenanceMonth = String(Number(m));
    }
    setFormData({
      flat_id: item.flat_id || '',
      amount: item.amount.toString(),
      category: item.category,
      description: item.description || '',
      date: item.date,
      payment_mode: item.payment_mode || 'cash',
      maintenanceYear,
      maintenanceMonth,
      maintenancePaymentTarget: item.maintenance_payment_target === 'arrears' ? 'arrears' : 'current',
      attachment: null,
    });
    const flat = flats.find((f) => f.id === item.flat_id);
    const name = flat?.resident_name || flat?.owner_name || '';
    const phone = flat?.resident_phone || flat?.owner_phone || '';
    const email = flat?.resident_email || flat?.owner_email || '';
    setResidentPreview({ name, phone, email });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      // Delete attachment if exists
      if (deleteTarget.attachment_url) {
        await deleteFile(deleteTarget.attachment_url);
      }

      const { error } = await supabase
        .from('income')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) throw error;
      toast.success('Income deleted successfully');
      setDeleteTarget(null);
      fetchIncome();
    } catch (error) {
      console.error('Error deleting income:', error);
      toast.error('Failed to delete income');
    } finally {
      setDeleting(false);
    }
  };

  const handleViewAttachment = async (attachmentUrl) => {
    try {
      const signedUrl = await getSignedUrl(attachmentUrl);
      if (signedUrl) {
        window.open(signedUrl, '_blank');
      }
    } catch (error) {
      console.error('Error viewing attachment:', error);
      toast.error('Failed to view attachment');
    }
  };

  const resetForm = () => {
    const d = new Date();
    setFormData({
      flat_id: '',
      amount: '',
      category: '',
      description: '',
      date: d.toISOString().split('T')[0],
      payment_mode: 'cash',
      maintenanceYear: String(d.getFullYear()),
      maintenanceMonth: String(d.getMonth() + 1),
      maintenancePaymentTarget: 'current',
      attachment: null,
    });
    setResidentPreview({ name: '', phone: '', email: '' });
    setEditingIncome(null);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    resetForm();
  };

  const flatForIncome = (item) =>
    item?.flat_id ? flats.find((f) => f.id === item.flat_id) : null;

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
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Income / Receipts" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Income / Receipts</h1>
            <p className="text-gray-500 mt-1">Record maintenance payments from residents</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button
              variant="outline"
              icon={Users}
              onClick={() => setShowBulkModal(true)}
            >
              Bulk Maintenance Collection
            </Button>
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowModal(true)}
            >
              Add Receipt
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search receipts..."
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
                  Total Income {selectedMonth !== 'all' ? `(${months.find(m => m.value === selectedMonth)?.label})` : '(All Time)'}
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

          {loading && income.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredIncome.length === 0 && !searchTerm ? (
            <EmptyState
              icon={IndianRupee}
              title="No receipts added yet"
              message="Click Add Receipt to record your first income entry"
              actionLabel="Add Receipt"
              onAction={() => setShowModal(true)}
              actionIcon={Plus}
            />
          ) : filteredIncome.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No results found"
              message={`No receipts match your search`}
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
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Maintenance Month</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Description</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Amount</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Payment</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Attachment</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Actions</th>
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
                        <td className="py-3 px-4 text-sm text-gray-700 whitespace-nowrap">
                          {item.maintenance_payment_target === 'arrears' ? (
                            <span className="text-amber-800 font-medium">Arrears</span>
                          ) : (
                            formatMaintMonthLabel(item.maintenance_month)
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.description || '-'}
                        </td>
                        <td className="py-3 px-4 text-sm font-semibold text-green-600">
                          {formatCurrency(item.amount)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 capitalize">
                          {item.payment_mode?.replace('_', ' ')}
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
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(item)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(item)}
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
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

      {/* Add/Edit Income Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingIncome ? 'Edit Receipt' : 'Add New Receipt'}
        subtitle={editingIncome ? 'Update receipt details' : 'Record a new income entry'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <InputField
            label="Flat"
            type="select"
            name="flat_id"
            value={formData.flat_id}
            onChange={handleChange}
            options={[
              { value: '', label: 'Select Flat (Optional)' },
              ...flats.map(flat => ({
                value: flat.id,
                label: `${flat.flat_number} - ${flat.resident_name || flat.owner_name || 'No owner'}`
              }))
            ]}
          />

          {(residentPreview.name || residentPreview.phone || residentPreview.email) && (
            <div className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3 text-sm space-y-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Resident</p>
              {residentPreview.name && <p className="font-medium text-gray-900">{residentPreview.name}</p>}
              {residentPreview.phone && <p className="text-gray-600">Phone: {residentPreview.phone}</p>}
              {residentPreview.email && <p className="text-gray-600">Email: {residentPreview.email}</p>}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Amount"
              type="number"
              name="amount"
              placeholder="0.00"
              value={formData.amount}
              onChange={handleChange}
              icon={IndianRupee}
              required
              min="0"
              step="0.01"
            />

            <InputField
              label="Date"
              type="date"
              name="date"
              value={formData.date}
              onChange={handleChange}
              icon={Calendar}
              required
            />
          </div>

          <InputField
            label="Category"
            type="select"
            name="category"
            value={formData.category}
            onChange={handleChange}
            required
            options={[
              { value: '', label: 'Select Category' },
              ...categories.map((cat) => ({ value: cat.name, label: cat.name })),
              { value: 'Maintenance', label: 'Maintenance' },
              { value: 'Penalty', label: 'Penalty' },
              { value: 'Other Income', label: 'Other Income' },
              { value: 'Other', label: 'Other' },
            ]}
          />

          {formData.category === 'Maintenance' && formData.flat_id && (
            <div className="rounded-xl border border-emerald-100 bg-emerald-50/80 px-4 py-3 space-y-2">
              <p className="text-sm font-medium text-gray-800">Apply maintenance payment to</p>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="maintenancePaymentTarget"
                  value="current"
                  checked={formData.maintenancePaymentTarget === 'current'}
                  onChange={handleChange}
                  className="mt-1"
                  disabled={!!editingIncome}
                />
                <span>Current month — links to the month below and updates the maintenance record</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="maintenancePaymentTarget"
                  value="arrears"
                  checked={formData.maintenancePaymentTarget === 'arrears'}
                  onChange={handleChange}
                  className="mt-1"
                  disabled={!!editingIncome}
                />
                <span>Old balance / arrears — reduces the flat’s pending (arrears) amount</span>
              </label>
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="maintenancePaymentTarget"
                  value="others"
                  checked={formData.maintenancePaymentTarget === 'others'}
                  onChange={handleChange}
                  className="mt-1"
                  disabled={!!editingIncome}
                />
                <span>Others — record income only, no maintenance update</span>
              </label>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <InputField
              label="Year"
              type="select"
              name="maintenanceYear"
              value={formData.maintenanceYear}
              onChange={handleChange}
              required={formData.category === 'Maintenance' && formData.maintenancePaymentTarget === 'current'}
              disabled={formData.category === 'Maintenance' && formData.maintenancePaymentTarget !== 'current'}
              options={getMaintenanceYearOptions()}
            />
            <InputField
              label="Month"
              type="select"
              name="maintenanceMonth"
              value={formData.maintenanceMonth}
              onChange={handleChange}
              required={formData.category === 'Maintenance' && formData.maintenancePaymentTarget === 'current'}
              disabled={formData.category === 'Maintenance' && formData.maintenancePaymentTarget !== 'current'}
              options={CALENDAR_MONTH_OPTIONS}
            />
          </div>

          <InputField
            label="Payment Mode"
            type="select"
            name="payment_mode"
            value={formData.payment_mode}
            onChange={handleChange}
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'upi', label: 'UPI' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
              { value: 'cheque', label: 'Cheque' },
              { value: 'online', label: 'Online' },
            ]}
          />

          <InputField
            label="Description"
            type="textarea"
            name="description"
            placeholder="Add notes or description"
            value={formData.description}
            onChange={handleChange}
            rows={3}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachment {editingIncome?.attachment_url && '(Current file will be replaced)'}
            </label>
            <input
              type="file"
              name="attachment"
              onChange={handleChange}
              accept=".pdf,.jpg,.jpeg,.png"
              className="w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
            />
            <p className="text-xs text-gray-500 mt-1">PDF, JPG, PNG (Max 5MB)</p>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseModal}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={loading || uploadingFile}
              fullWidth
            >
              {uploadingFile ? 'Uploading...' : editingIncome ? 'Update' : 'Add'} Receipt
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk Maintenance Collection */}
      <Modal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        title="Bulk Maintenance Collection"
        subtitle={
          apartment?.name
            ? `${apartment.name} · Pick pending flats and record payment`
            : 'Pick pending flats and record payment'
        }
      >
        <form onSubmit={handleBulkSubmit} className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {apartment?.name && (
            <p className="text-sm text-gray-600">
              Apartment: <span className="font-medium text-gray-900">{apartment.name}</span>
              <span className="text-gray-400"> (switch in the header if needed)</span>
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <InputField
              label="Maintenance Month"
              type="select"
              name="month"
              value={bulkData.month}
              onChange={handleBulkChange}
              required
              options={months.filter((m) => m.value !== 'all').map((m) => ({
                value: m.value,
                label: m.label,
              }))}
            />

            <InputField
              label="Year"
              type="number"
              name="year"
              value={bulkData.year}
              onChange={handleBulkChange}
              required
              min="2020"
              max="2100"
            />

            <InputField
              label="Payment Date"
              type="date"
              name="payment_date"
              value={bulkData.payment_date}
              onChange={handleBulkChange}
              icon={Calendar}
              required
            />

            <InputField
              label="Payment Mode"
              type="select"
              name="payment_mode"
              value={bulkData.payment_mode}
              onChange={handleBulkChange}
              options={[
                { value: 'cash', label: 'Cash' },
                { value: 'upi', label: 'UPI' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'online', label: 'Online' },
              ]}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-gray-600">
            <span>
              {bulkFetching ? 'Loading flats…' : `${pendingCount} pending / ${bulkRows.length} total flats`}
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllPendingBulk}
                className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-800 text-sm font-medium hover:bg-gray-50"
              >
                Select All Pending
              </button>
              <button type="button" onClick={clearBulkSelection} className="text-sm font-medium text-gray-600 hover:text-gray-900 px-2">
                Clear
              </button>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="w-10 py-2 pl-3" />
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Flat</th>
                    <th className="text-left py-2 px-2 font-medium text-gray-700">Resident</th>
                    <th className="text-right py-2 px-2 font-medium text-gray-700">Amount</th>
                    <th className="text-left py-2 pr-3 font-medium text-gray-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {bulkRows.map((row) => (
                    <tr key={row.flat_id} className={row.status === 'pending' ? 'bg-white' : 'bg-gray-50/80'}>
                      <td className="py-2 pl-3">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                          checked={bulkSelected.has(row.flat_id)}
                          disabled={row.status !== 'pending'}
                          onChange={() => toggleBulkRow(row.flat_id, row.status)}
                        />
                      </td>
                      <td className="py-2 px-2 font-medium text-gray-900">{row.flat_number}</td>
                      <td className="py-2 px-2 text-gray-700">{row.residentName}</td>
                      <td className="py-2 px-2 text-right font-semibold text-gray-900">{formatCurrency(row.amount)}</td>
                      <td className="py-2 pr-3">
                        <span
                          className={
                            row.status === 'paid'
                              ? 'text-emerald-700 font-medium'
                              : 'text-amber-600 font-medium'
                          }
                        >
                          {row.status === 'paid' ? 'Paid' : 'Pending'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => setShowBulkModal(false)} fullWidth>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={loading || bulkFetching} fullWidth>
              Mark {bulkSelected.size} as Paid
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete receipt?"
        message="This receipt will be permanently removed."
        confirmText="Delete"
        confirmVariant="secondary"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Income;
