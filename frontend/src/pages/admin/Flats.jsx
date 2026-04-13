import React, { useState, useEffect } from 'react';
import { DoorOpen, Plus, Edit2, Trash2, Search, ArrowUpDown, User, Phone, Mail, IndianRupee, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatCurrency } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

const Flats = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [flats, setFlats] = useState([]);
  const [filteredFlats, setFilteredFlats] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingFlat, setEditingFlat] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortAZ, setSortAZ] = useState(true);
  const [formData, setFormData] = useState({
    flat_number: '',
    resident_name: '',
    resident_phone: '',
    resident_email: '',
    monthly_maintenance: '',
    pending_maintenance: '',
    other_maintenance: '',
    notes: '',
    is_occupied: true,
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
    filterAndSortFlats();
  }, [flats, searchTerm, sortAZ]);

  const fetchFlats = async () => {
    const aptId = activeApartmentId;
    if (!aptId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('flats')
        .select('*')
        .eq('apartment_id', aptId)
        .order('flat_number', { ascending: true });
      if (error) throw error;
      setFlats(data || []);
    } catch (error) {
      console.error('Error fetching flats:', error);
      toast.error('Failed to load flats');
    } finally {
      setLoading(false);
    }
  };

  const filterAndSortFlats = () => {
      let result = [...flats];
    if (searchTerm) {
      result = result.filter(flat =>
        flat.flat_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        flat.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    result.sort((a, b) => {
      const comparison = a.flat_number.localeCompare(b.flat_number, undefined, { numeric: true });
      return sortAZ ? comparison : -comparison;
    });
    setFilteredFlats(result);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.flat_number.trim()) {
      toast.error('Flat number is required');
      return;
    }
    try {
      setLoading(true);
      const aptId = activeApartmentId;
      if (!aptId) {
        toast.error('Please select an apartment first');
        setLoading(false);
        return;
      }
      const flatData = {
        apartment_id: aptId,
        flat_number: formData.flat_number,
        resident_name: formData.resident_name || null,
        resident_phone: formData.resident_phone || null,
        resident_email: formData.resident_email || null,
        monthly_maintenance: formData.monthly_maintenance === '' ? null : Number(formData.monthly_maintenance),
        pending_maintenance: formData.pending_maintenance === '' ? null : Number(formData.pending_maintenance),
        other_maintenance: formData.other_maintenance === '' ? null : Number(formData.other_maintenance),
        notes: formData.notes || null,
        is_occupied: !!formData.is_occupied,
      };

      if (editingFlat) {
        const { error } = await supabase.from('flats').update(flatData).eq('id', editingFlat.id);
        if (error) throw error;
        toast.success('Flat updated successfully');
      } else {
        const { error } = await supabase.from('flats').insert(flatData);
        if (error) throw error;
        toast.success('Flat created successfully');
      }

      setShowModal(false);
      setFormData({ 
        flat_number: '', 
        resident_name: '', 
        resident_phone: '', 
        resident_email: '', 
        monthly_maintenance: '', 
        pending_maintenance: '',
        other_maintenance: '',
        notes: '', 
        is_occupied: true 
      });
      setEditingFlat(null);
      fetchFlats();
    } catch (error) {
      console.error('Error saving flat:', error);
      if (error.code === '23505') {
        toast.error('This flat number already exists');
      } else {
        const msg = error?.message || '';
        if (String(msg).toLowerCase().includes('column') || String(msg).toLowerCase().includes('schema')) {
          toast.error('Supabase table `flats` is missing fields needed for this UI (monthly_maintenance/notes).');
        } else {
          toast.error('Failed to save flat');
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (flat) => {
    setEditingFlat(flat);
    setFormData({
      flat_number: flat.flat_number,
      resident_name: flat.resident_name || flat.owner_name || '',
      resident_phone: flat.resident_phone || flat.owner_phone || '',
      resident_email: flat.resident_email || flat.owner_email || '',
      monthly_maintenance: flat.monthly_maintenance?.toString?.() || '',
      pending_maintenance: flat.pending_maintenance?.toString?.() || '',
      other_maintenance: flat.other_maintenance?.toString?.() || '',
      notes: flat.notes || '',
      is_occupied: flat.is_occupied ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('flats').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Flat deleted successfully');
      setDeleteTarget(null);
      fetchFlats();
    } catch (error) {
      console.error('Error deleting flat:', error);
      toast.error('Failed to delete flat');
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      flat_number: '',
      resident_name: '',
      resident_phone: '',
      resident_email: '',
      monthly_maintenance: '',
      pending_maintenance: '',
      other_maintenance: '',
      notes: '',
      is_occupied: true,
    });
    setEditingFlat(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Flats" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Flats</h1>
            <p className="text-gray-500 mt-1">
              Manage flats for the selected apartment
              <span className="text-gray-700 font-semibold"> · {flats.length} total flats</span>
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Button variant="primary" icon={Plus} onClick={() => setShowModal(true)}>
              Add Flat
            </Button>
            <div className="flex-1 flex gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="Search by flat number or owner..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <Button variant="outline" icon={ArrowUpDown} onClick={() => setSortAZ(!sortAZ)}>
                {sortAZ ? 'A→Z' : 'Z→A'}
              </Button>
            </div>
          </div>

          {loading && flats.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : filteredFlats.length === 0 && !searchTerm ? (
            <EmptyState
              icon={DoorOpen}
              title="No flats added yet"
              message="Click Add Flat to begin. Each flat gets its own resident login credentials."
              actionLabel="Add Flat"
              onAction={() => setShowModal(true)}
              actionIcon={Plus}
            />
          ) : filteredFlats.length === 0 ? (
            <EmptyState icon={Search} title="No results found" message={`No flats match "${searchTerm}"`} />
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredFlats.map((flat) => (
                <div key={flat.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
                  {/* Flat Header */}
                  <div className="p-5 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-green-100 rounded-lg">
                          <DoorOpen className="text-green-600" size={22} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Flat {flat.flat_number}</h3>
                          {flat.floor_number && <p className="text-sm text-gray-500">Floor {flat.floor_number}</p>}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleEdit(flat)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => setDeleteTarget(flat)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      {(flat.resident_name || flat.owner_name) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <User size={14} className="text-gray-400" />
                          <span>{flat.resident_name || flat.owner_name}</span>
                        </div>
                      )}
                      {(flat.resident_phone || flat.owner_phone) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Phone size={14} className="text-gray-400" />
                          <span>{flat.resident_phone || flat.owner_phone}</span>
                        </div>
                      )}
                      {(flat.resident_email || flat.owner_email) && (
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Mail size={14} className="text-gray-400" />
                          <span className="truncate">{flat.resident_email || flat.owner_email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Maintenance & Status (screenshot columns) */}
                  <div className="px-5 py-4">
                    <div className="grid grid-cols-3 gap-2">
                      <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100">
                        <p className="text-[10px] text-gray-500 leading-tight">Monthly</p>
                        <p className="text-xs font-semibold text-gray-900 truncate">
                          {flat.monthly_maintenance != null ? formatCurrency(flat.monthly_maintenance) : '-'}
                        </p>
                      </div>
                      <div className="bg-red-50 rounded-xl p-2.5 border border-red-100">
                        <p className="text-[10px] text-red-600 leading-tight">Pending</p>
                        <p className="text-xs font-semibold text-red-600 truncate">
                          {flat.pending_maintenance != null ? formatCurrency(flat.pending_maintenance) : '0'}
                        </p>
                      </div>
                      <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100">
                        <p className="text-[10px] text-amber-700 leading-tight">Other</p>
                        <p className="text-xs font-semibold text-amber-900 truncate">
                          {flat.other_maintenance != null ? formatCurrency(flat.other_maintenance) : '0'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        (flat.is_occupied ?? true)
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}>
                        {(flat.is_occupied ?? true) ? 'Occupied' : 'Vacant'}
                      </span>
                    </div>
                  </div>

                  {/* Resident login is shared via Viewer Access Settings */}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <Modal isOpen={showModal} onClose={handleCloseModal} title={editingFlat ? 'Edit Flat' : 'Add New Flat'} subtitle={editingFlat ? 'Update flat details' : 'Resident login credentials will be auto-generated'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {apartment?.name && (
            <p className="text-sm text-gray-600 -mt-1 mb-1">
              Apartment: <span className="font-medium text-gray-900">{apartment.name}</span>
              <span className="text-gray-400 font-normal"> (change via the header)</span>
            </p>
          )}
          <InputField label="Flat Number" type="text" name="flat_number" placeholder="e.g., A-101, B-205" value={formData.flat_number} onChange={handleChange} icon={DoorOpen} required />
          <InputField label="Resident Name" type="text" name="resident_name" placeholder="Enter resident's name" value={formData.resident_name} onChange={handleChange} icon={User} />
          <InputField label="Resident Phone" type="tel" name="resident_phone" placeholder="+91 9876543210" value={formData.resident_phone} onChange={handleChange} icon={Phone} />
          <InputField label="Resident Email" type="email" name="resident_email" placeholder="resident@example.com" value={formData.resident_email} onChange={handleChange} icon={Mail} />
          <div className="grid grid-cols-2 gap-4">
            <InputField label="Monthly Maintenance (Rs)" type="number" name="monthly_maintenance" placeholder="0" value={formData.monthly_maintenance} onChange={handleChange} icon={IndianRupee} min="0" step="1" />
            <InputField label="Pending Maintenance (Rs)" type="number" name="pending_maintenance" placeholder="0" value={formData.pending_maintenance} onChange={handleChange} icon={AlertCircle} min="0" step="1" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Status"
              type="select"
              name="is_occupied"
              value={formData.is_occupied ? 'occupied' : 'vacant'}
              onChange={(e) => setFormData({ ...formData, is_occupied: e.target.value === 'occupied' })}
              options={[
                { value: 'occupied', label: 'Occupied' },
                { value: 'vacant', label: 'Vacant' },
              ]}
            />
            <InputField
              label="Other maintenance (Rs)"
              type="number"
              name="other_maintenance"
              placeholder="0"
              value={formData.other_maintenance}
              onChange={handleChange}
              icon={IndianRupee}
              min="0"
              step="1"
              helperText="Parking, water, special charges, etc."
            />
          </div>
          <InputField label="Notes" type="textarea" name="notes" placeholder="Any additional notes..." value={formData.notes} onChange={handleChange} rows={3} />
          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={handleCloseModal} fullWidth>Cancel</Button>
            <Button type="submit" variant="primary" loading={loading} fullWidth>
              {editingFlat ? 'Update' : 'Create'} Flat
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete flat?"
        message={`Are you sure you want to delete Flat ${deleteTarget?.flat_number || ''}?`}
        confirmText="Delete"
        confirmVariant="secondary"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Flats;

