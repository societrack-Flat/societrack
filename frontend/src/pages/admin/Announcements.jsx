import React, { useState, useEffect } from 'react';
import { Megaphone, Plus, Trash2, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Modal from '../../components/Modal';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';
import ConfirmDialog from '../../components/ConfirmDialog';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

const Announcements = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    message: '',
    priority: 'normal',
    expiry_date: '',
  });

  const { userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchAnnouncements();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error) {
      console.error('Error fetching announcements:', error);
      toast.error('Failed to load announcements');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    if (!formData.message.trim()) {
      toast.error('Message is required');
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.from('announcements').insert({
        apartment_id: activeApartmentId,
        title: formData.title,
        message: formData.message,
        priority: formData.priority,
        expiry_date: formData.expiry_date || null,
        created_by: userProfile.id,
      });

      if (error) throw error;

      toast.success('Announcement created successfully');
      setShowModal(false);
      setFormData({ title: '', message: '', priority: 'normal', expiry_date: '' });
      fetchAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      const msg = error?.message || '';
      if (String(msg).toLowerCase().includes('column') || String(msg).toLowerCase().includes('schema')) {
        toast.error('Supabase table `announcements` is missing field `expiry_date` (required for screenshot UI).');
      } else {
        toast.error('Failed to create announcement');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      const { error } = await supabase.from('announcements').delete().eq('id', deleteTarget.id);
      if (error) throw error;
      toast.success('Announcement deleted successfully');
      setDeleteTarget(null);
      fetchAnnouncements();
    } catch (error) {
      console.error('Error deleting announcement:', error);
      toast.error('Failed to delete announcement');
    } finally {
      setDeleting(false);
    }
  };

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'normal':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'low':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatus = (a) => {
    const exp = a.expiry_date ? new Date(a.expiry_date) : null;
    if (!exp) return 'Active';
    // expires end of expiry day in local time
    const end = new Date(exp);
    end.setHours(23, 59, 59, 999);
    return end < new Date() ? 'Expired' : 'Active';
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Announcements" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-gray-500 mt-1">Manage apartment announcements</p>
          </div>

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Button
                variant="secondary"
                icon={Plus}
                onClick={() => setShowModal(true)}
              >
                New Announcement
              </Button>
            </div>
          </div>

          {loading && announcements.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              message="Create your first announcement to inform residents"
              actionLabel="New Announcement"
              onAction={() => setShowModal(true)}
              actionIcon={Plus}
            />
          ) : (
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Title</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Message</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Expiry</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Priority</th>
                      <th className="text-left py-3 px-4 text-sm font-medium text-gray-900">Status</th>
                      <th className="text-right py-3 px-4 text-sm font-medium text-gray-900">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {announcements.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="py-3 px-4">
                          <span className="text-sm font-medium text-gray-900">{item.title}</span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600 max-w-md">
                          <p className="truncate">{item.message}</p>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {formatDate(item.created_at)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {item.expiry_date ? formatDate(item.expiry_date) : '-'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${getPriorityStyles(item.priority)}`}>
                            {item.priority === 'normal' ? 'Normal' : item.priority === 'high' ? 'Important' : item.priority}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            getStatus(item) === 'Expired' ? 'bg-gray-100 text-gray-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {getStatus(item)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end">
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

      {/* New Announcement Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setFormData({ title: '', message: '', priority: 'normal', expiry_date: '' });
        }}
        title="Create Announcement"
        subtitle="Notify all residents with an important message"
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          <InputField
            label="Title"
            type="text"
            name="title"
            placeholder="Enter announcement title"
            value={formData.title}
            onChange={handleChange}
            required
          />

          <InputField
            label="Expiry Date (optional)"
            type="date"
            name="expiry_date"
            value={formData.expiry_date}
            onChange={handleChange}
            icon={Calendar}
            helperText="If empty, expires at end of today."
          />

          <InputField
            label="Priority"
            type="select"
            name="priority"
            value={formData.priority}
            onChange={handleChange}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'Important' },
            ]}
          />

          <InputField
            label="Message"
            type="textarea"
            name="message"
            placeholder="Enter your announcement message"
            value={formData.message}
            onChange={handleChange}
            rows={5}
            required
          />

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setShowModal(false);
                setFormData({ title: '', message: '', priority: 'normal', expiry_date: '' });
              }}
              fullWidth
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="secondary"
              loading={loading}
              fullWidth
            >
              Create Announcement
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Delete announcement?"
        message="This announcement will be permanently removed."
        confirmText="Delete"
        confirmVariant="secondary"
        loading={deleting}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
};

export default Announcements;
