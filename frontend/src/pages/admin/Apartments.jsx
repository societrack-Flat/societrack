import React, { useState, useEffect, useRef } from 'react';
import { Building2, Plus, Edit2, Trash2, MapPin, Upload } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate, uploadFile, deleteFile, getSignedUrl } from '../../lib/supabaseClient';
// Temporarily disable API imports to test
// import { apartmentApi, storageApi } from '../../lib/apiClient';
import { fetchAdminApartmentsList } from '../../lib/fetchAdminApartmentsList';
import { deleteApartmentCascade } from '../../lib/deleteApartmentCascade';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ConfirmDialog';

const Apartments = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apartments, setApartments] = useState([]);
  const [logoThumbs, setLogoThumbs] = useState({});
  const [showModal, setShowModal] = useState(false);
  const [editingApartment, setEditingApartment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    state: '',
    number_of_blocks: '',
    total_flats: '',
    opening_balance: '',
    notes: '',
    logo: null,
  });

  const {
    userProfile,
    profileLoaded,
    refreshUserProfile,
    setActiveApartment,
    clearCachedApartmentList,
    saManagedApartmentId,
  } = useAuth();

  /** Always latest list — `apartments` in delete handler can be stale and pick wrong `nextActiveId` (ghost “revived” row). */
  const apartmentsRef = useRef([]);
  apartmentsRef.current = apartments;

  useEffect(() => {
    if (userProfile?.role === 'admin' || (userProfile?.role === 'super_admin' && saManagedApartmentId)) {
      fetchApartments();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [userProfile?.id, userProfile?.role, profileLoaded, userProfile?.apartment_id, saManagedApartmentId]);

  /**
   * @param {object} [opts]
   * @param {string|null|undefined} [opts.activeApartmentId] — use after delete/switch so we don't read stale `userProfile.apartment_id` before React re-renders.
   * @param {string} [opts.excludeApartmentId] — drop this id from the result (safety if refetch races the DB).
   */
  const fetchApartments = async (opts = {}) => {
    const { activeApartmentId: activeOverride, excludeApartmentId } = opts;
    try {
      setLoading(true);
      
      console.log('[Apartments] fetchApartments called with:', { activeOverride, excludeApartmentId });
      
      // Clear cache to ensure fresh data
      clearCachedApartmentList();
      
      const activeForMerge =
        activeOverride !== undefined ? activeOverride : userProfile.apartment_id || null;
      console.log('[Apartments] activeForMerge:', activeForMerge);
      
      // Use only direct Supabase for now
      const merged = await fetchAdminApartmentsList(userProfile.id, activeForMerge, excludeApartmentId, {
        superAdminManagedApartmentId:
          userProfile?.role === 'super_admin' ? saManagedApartmentId : null,
      });
      console.log('[Apartments] fetched from Supabase:', merged);
      
      const cleaned =
        excludeApartmentId != null
          ? merged.filter((a) => a.id !== excludeApartmentId)
          : merged;
      console.log('[Apartments] cleaned list:', cleaned);
      
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[Apartments] fetchApartments', {
          activeForMerge,
          staleProfileApartmentId: userProfile.apartment_id,
          mergedCount: merged.length,
          cleanedCount: cleaned.length,
          ids: cleaned.map((a) => a.id),
          excludeApartmentId: excludeApartmentId ?? null,
        });
      }
      setApartments(cleaned);
      
    } catch (error) {
      console.error('Error fetching apartments:', error);
      const msg = error?.message || '';
      if (String(msg).toLowerCase().includes('created_by')) {
        toast.error('Missing DB column `apartments.created_by`. Please add it and rerun.');
      } else {
        toast.error('Failed to load apartments');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadThumbs = async () => {
      const entries = await Promise.all(
        (apartments || [])
          .filter((a) => a.logo_url)
          .map(async (a) => {
            try {
              const url = await getSignedUrl(a.logo_url);
              return [a.logo_url, url];
            } catch {
              return [a.logo_url, null];
            }
          })
      );
      if (entries.length) {
        setLogoThumbs((prev) => ({ ...prev, ...Object.fromEntries(entries.filter(([, v]) => v)) }));
      }
    };
    if (apartments.length) loadThumbs();
  }, [apartments]);

  const getLogoThumb = (logoUrl) => logoThumbs[logoUrl];

  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'logo') {
      setFormData({ ...formData, logo: files?.[0] || null });
      return;
    }
    setFormData({ ...formData, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      toast.error('Apartment name is required');
      return;
    }

    try {
      setLoading(true);
      let newLogoPath = null;
      let newLogoName = null;

      if (formData.logo) {
        setUploading(true);
        const logoOwnerId = userProfile?.id || 'new';
        const fileData = await uploadFile(formData.logo, `apartment-logos/${logoOwnerId}`);
        newLogoPath = fileData.path;
        newLogoName = fileData.name;
        setUploading(false);
      }

      const payload = {
        name: formData.name,
        address: formData.address,
        city: formData.city || null,
        state: formData.state || null,
        number_of_blocks: formData.number_of_blocks === '' ? null : Number(formData.number_of_blocks),
        total_flats: formData.total_flats === '' ? null : Number(formData.total_flats),
        opening_balance: formData.opening_balance === '' ? null : Number(formData.opening_balance),
        notes: formData.notes || null,
        logo_url: newLogoPath || editingApartment?.logo_url || null,
        logo_name: newLogoName || editingApartment?.logo_name || null,
      };

      if (editingApartment) {
        if (newLogoPath && editingApartment?.logo_url) {
          await deleteFile(editingApartment.logo_url);
        }
        const { error } = await supabase
          .from('apartments')
          .update(payload)
          .eq('id', editingApartment.id);

        if (error) throw error;
        toast.success('Apartment updated successfully');
      } else {
        const newAptId = crypto.randomUUID();
        const { error } = await supabase
          .from('apartments')
          .insert({
            id: newAptId,
            created_by: userProfile.id,
            subscription_status: 'trial',
            plan_name: 'free_trial',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
            ...payload
          });

        if (error) throw error;

        // If no active apartment yet, set this as active. Otherwise keep current active.
        if (!userProfile.apartment_id) {
          await setActiveApartment?.(newAptId);
        } else {
          await refreshUserProfile?.();
        }
        toast.success('Apartment created successfully');
      }

      setShowModal(false);
      setFormData({
        name: '',
        address: '',
        city: '',
        state: '',
        number_of_blocks: '',
        total_flats: '',
        opening_balance: '',
        notes: '',
        logo: null,
      });
      setEditingApartment(null);
      fetchApartments();
    } catch (error) {
      console.error('Error saving apartment:', error);
      const msg = error?.message || 'Failed to save apartment';
      if (String(msg).toLowerCase().includes('column') || String(msg).toLowerCase().includes('schema')) {
        toast.error('Supabase table `apartments` is missing some fields needed for this UI (city/state/blocks/flats/opening_balance/notes/logo_url).');
      } else {
        toast.error('Failed to save apartment');
      }
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  const handleEdit = (apt) => {
    setEditingApartment(apt);
    setFormData({
      name: apt.name,
      address: apt.address || '',
      city: apt.city || '',
      state: apt.state || '',
      number_of_blocks: apt.number_of_blocks?.toString?.() || '',
      total_flats: apt.total_flats?.toString?.() || '',
      opening_balance: apt.opening_balance?.toString?.() || '',
      notes: apt.notes || '',
      logo: null,
    });
    setShowModal(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const deletedId = deleteTarget.id;
    const wasActive = userProfile?.apartment_id === deletedId;
    const nextList = apartmentsRef.current.filter((a) => a.id !== deletedId);
    const nextActiveId = wasActive ? (nextList[0]?.id ?? null) : null;

    console.log('[Apartments] handleDelete called:', {
      deletedId,
      deleteTarget,
      wasActive,
      nextActiveId,
      currentApartments: apartmentsRef.current.map(a => ({ id: a.id, name: a.name }))
    });

    try {
      setDeleting(true);
      
      // Clear cache to ensure fresh data
      clearCachedApartmentList();
      
      // Immediately update UI state for better UX
      console.log('[Apartments] updating UI state immediately');
      setApartments((prev) => {
        const newList = prev.filter((a) => a.id !== deletedId);
        console.log('[Apartments] UI updated to:', newList.map(a => ({ id: a.id, name: a.name })));
        return newList;
      });
      
      setLogoThumbs((prev) => {
        const url = deleteTarget?.logo_url;
        if (!url || !prev[url]) return prev;
        const next = { ...prev };
        delete next[url];
        return next;
      });

      if (deleteTarget.logo_url) {
        try {
          await deleteFile(deleteTarget.logo_url);
          console.log('[Apartments] logo deleted');
        } catch {
          /* ignore storage cleanup failure */
        }
      }
      
      console.log('[Apartments] calling direct Supabase to delete apartment...');
      const { error } = await deleteApartmentCascade(supabase, deletedId);
      if (error) throw error;
      console.log('[Apartments] delete success');
      
      // Add a small delay to ensure DB consistency
      await new Promise(resolve => setTimeout(resolve, 200));

      toast.success('Apartment deleted successfully');
      setDeleteTarget(null);

      const activeApartmentIdAfterDelete = wasActive
        ? nextActiveId
        : userProfile?.apartment_id === deletedId
          ? null
          : userProfile?.apartment_id ?? null;

      console.log('[Apartments] activeApartmentIdAfterDelete:', activeApartmentIdAfterDelete);

      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.info('[Apartments] delete OK → refetch', {
          deletedId,
          wasActive,
          nextActiveId,
          nextListIds: nextList.map((a) => a.id),
          activeApartmentIdAfterDelete,
          staleProfileApartmentId: userProfile?.apartment_id,
        });
      }

      if (wasActive) {
        console.log('[Apartments] setting new active apartment:', nextActiveId);
        // Use direct Supabase for now
        if (nextActiveId) {
          await supabase
            .from('users')
            .update({ apartment_id: nextActiveId })
            .eq('id', userProfile.id);
        } else {
          await supabase
            .from('users')
            .update({ apartment_id: null })
            .eq('id', userProfile.id);
        }
        await refreshUserProfile?.();
      } else {
        console.log('[Apartments] refreshing user profile');
        await refreshUserProfile?.();
      }
      
      // Add a small delay to ensure DB consistency
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('[Apartments] refetching apartments...');
      // Refetch to ensure DB state is consistent
      await fetchApartments({
        activeApartmentId: activeApartmentIdAfterDelete,
        excludeApartmentId: deletedId,
      });
      
      // Also refresh adminApartments in AuthContext (simplified)
      // For now, just refetch the apartments list
    } catch (error) {
      console.error('[Apartments] Error deleting apartment:', error);
      const msg = error?.message || error?.details || 'Failed to delete apartment';
      toast.error(typeof msg === 'string' ? msg : 'Failed to delete apartment');
      
      // Revert UI state on error
      console.log('[Apartments] reverting UI state due to error');
      await fetchApartments();
    } finally {
      setDeleting(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setFormData({
      name: '',
      address: '',
      city: '',
      state: '',
      number_of_blocks: '',
      total_flats: '',
      opening_balance: '',
      notes: '',
      logo: null,
    });
    setEditingApartment(null);
  };

  const handleViewLogo = async (logoUrl) => {
    try {
      const signed = await getSignedUrl(logoUrl);
      if (signed) window.open(signed, '_blank');
    } catch {
      toast.error('Failed to open logo');
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Apartments" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Apartments</h1>
          </div>

          <div className="mb-6">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setShowModal(true)}
            >
              Add Apartment
            </Button>
          </div>

          {loading && apartments.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : apartments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No apartments created yet"
              message="Click Add Apartment to begin managing your properties"
              actionLabel="Add Apartment"
              onAction={() => setShowModal(true)}
              actionIcon={Plus}
            />
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Logo</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Apartment Name</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Address</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Total Flats</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Blocks</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Created Date</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {apartments.map((apt) => (
                      <tr key={apt.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          {apt.logo_url ? (
                            <button
                              type="button"
                              onClick={() => handleViewLogo(apt.logo_url)}
                              className="w-10 h-10 rounded-lg bg-white border border-gray-200 overflow-hidden flex items-center justify-center"
                              title="View logo"
                            >
                              {getLogoThumb(apt.logo_url) ? (
                                <img src={getLogoThumb(apt.logo_url)} alt="Logo" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-[10px] text-gray-500">Logo</span>
                              )}
                            </button>
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                              <Building2 className="text-blue-600" size={18} />
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{apt.name}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{apt.address || '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{apt.total_flats ?? '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{apt.number_of_blocks ?? '-'}</td>
                        <td className="py-3 px-4 text-sm text-gray-600">{apt.created_at ? formatDate(apt.created_at) : '-'}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleEdit(apt)}
                              className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(apt)}
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

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingApartment ? 'Edit Apartment' : 'Add New Apartment'}
        subtitle={editingApartment ? 'Update apartment details' : 'Create a new apartment property'}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <InputField
            label="Apartment Name"
            type="text"
            name="name"
            placeholder="e.g., Green Valley Apartments"
            value={formData.name}
            onChange={handleChange}
            icon={Building2}
            required
          />

          <InputField
            label="Apartment Address"
            type="textarea"
            name="address"
            placeholder="Enter complete address"
            value={formData.address}
            onChange={handleChange}
            icon={MapPin}
            rows={3}
          />

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="City"
              type="text"
              name="city"
              placeholder="e.g. Hyderabad"
              value={formData.city}
              onChange={handleChange}
            />
            <InputField
              label="State"
              type="text"
              name="state"
              placeholder="e.g. Telangana"
              value={formData.state}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <InputField
              label="Number of Blocks"
              type="number"
              name="number_of_blocks"
              placeholder="0"
              value={formData.number_of_blocks}
              onChange={handleChange}
              min="0"
              step="1"
            />
            <InputField
              label="Total Flats"
              type="number"
              name="total_flats"
              placeholder="0"
              value={formData.total_flats}
              onChange={handleChange}
              min="0"
              step="1"
            />
          </div>

          <InputField
            label="Opening Balance"
            type="number"
            name="opening_balance"
            placeholder="0"
            value={formData.opening_balance}
            onChange={handleChange}
            helperText="Existing society balance before using this system."
            min="0"
            step="1"
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Apartment Logo</label>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white rounded-lg border border-gray-200">
                  <Upload className="text-gray-500" size={18} />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-700 font-medium">Upload logo image</p>
                  <p className="text-xs text-gray-500">PNG/JPG up to 5MB</p>
                </div>
                <input
                  type="file"
                  name="logo"
                  accept=".png,.jpg,.jpeg,.webp"
                  onChange={handleChange}
                  className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">This logo will appear on login/dashboard/reports.</p>
          </div>

          <InputField
            label="Notes"
            type="textarea"
            name="notes"
            placeholder="Any additional notes..."
            value={formData.notes}
            onChange={handleChange}
            rows={3}
          />

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
              loading={loading || uploading}
              fullWidth
            >
              {editingApartment ? 'Update' : 'Create'} Apartment
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete apartment?"
        message="This will delete the apartment and all associated data."
        confirmText="Delete"
        confirmVariant="secondary"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Apartments;
