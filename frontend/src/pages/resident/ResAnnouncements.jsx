import React, { useState, useEffect } from 'react';
import { Megaphone, Calendar } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase, formatDate } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import EmptyState from '../../components/EmptyState';
import toast from 'react-hot-toast';

const ResAnnouncements = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);

  const { apartment, residentApartmentId, isResident, profileLoaded } = useAuth();
  const apartmentId = apartment?.id || residentApartmentId;

  useEffect(() => {
    if (apartmentId) {
      fetchAnnouncements();
    } else if (isResident || profileLoaded) {
      setLoading(false);
    }
  }, [apartmentId, isResident, profileLoaded]);

  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('apartment_id', apartmentId)
        .eq('is_active', true)
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

  const getPriorityStyles = (priority) => {
    switch (priority) {
      case 'urgent':
        return {
          container: 'border-red-300 bg-red-50',
          badge: 'bg-red-100 text-red-800',
          icon: 'text-red-600',
        };
      case 'high':
        return {
          container: 'border-orange-300 bg-orange-50',
          badge: 'bg-orange-100 text-orange-800',
          icon: 'text-orange-600',
        };
      case 'normal':
        return {
          container: 'border-blue-200 bg-white',
          badge: 'bg-blue-100 text-blue-800',
          icon: 'text-blue-600',
        };
      default:
        return {
          container: 'border-gray-200 bg-white',
          badge: 'bg-gray-100 text-gray-800',
          icon: 'text-gray-600',
        };
    }
  };

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role="resident" />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Announcements" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Announcements</h1>
            <p className="text-gray-500 mt-1">Stay updated with important notices from your apartment</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="spinner"></div>
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements"
              message="There are no announcements at this time"
            />
          ) : (
            <div className="space-y-4">
              {announcements.map((announcement) => {
                const styles = getPriorityStyles(announcement.priority);
                return (
                  <div
                    key={announcement.id}
                    className={`border-2 rounded-xl p-6 ${styles.container}`}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 bg-white rounded-lg shadow-sm ${styles.icon}`}>
                          <Megaphone size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {announcement.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-xs font-medium px-2 py-1 rounded-full capitalize ${styles.badge}`}>
                              {announcement.priority}
                            </span>
                            <span className="text-sm text-gray-500 flex items-center gap-1">
                              <Calendar size={14} />
                              {formatDate(announcement.created_at)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="ml-14">
                      <p className="text-gray-700 whitespace-pre-wrap">
                        {announcement.message}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default ResAnnouncements;
