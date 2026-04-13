import React, { useState, useEffect } from 'react';
import { Settings, Eye, EyeOff, Copy, Check, Users, Shield } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import toast from 'react-hot-toast';
import { useAdminActiveApartment } from '../../hooks/useAdminActiveApartment';

const ViewerSettings = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  
  const [settings, setSettings] = useState({
    viewer_username: '',
    viewer_password: '',
    allow_income_view: false,
    allow_expense_view: false,
    allow_maintenance_view: true,
    allow_announcement_view: false,
    allow_report_view: false,
    is_active: true,
  });

  const { apartment, userProfile, profileLoaded } = useAuth();
  const activeApartmentId = useAdminActiveApartment();

  useEffect(() => {
    if (activeApartmentId) {
      fetchSettings();
    } else if (profileLoaded) {
      setLoading(false);
    }
  }, [activeApartmentId, profileLoaded]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('viewer_settings')
        .select('*')
        .eq('apartment_id', activeApartmentId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setSettings({
          viewer_username: data.viewer_username || '',
          viewer_password: data.viewer_password || '',
          allow_income_view: false,
          allow_expense_view: false,
          allow_maintenance_view: data.allow_maintenance_view ?? true,
          allow_announcement_view: false,
          allow_report_view: false,
          is_active: data.is_active ?? true,
        });
      } else {
        // Set default username
        const defaultUsername = `${apartment?.name?.toLowerCase().replace(/\s+/g, '_') || 'apartment'}_resident`;
        setSettings(prev => ({ ...prev, viewer_username: defaultUsername }));
      }
    } catch (error) {
      console.error('Error fetching viewer settings:', error);
      toast.error('Failed to load viewer settings');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings({
      ...settings,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleSaveCredentials = async () => {
    if (!settings.viewer_username.trim()) {
      toast.error('Username is required');
      return;
    }

    if (!settings.viewer_password) {
      toast.error('Password is required');
      return;
    }

    if (settings.viewer_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('viewer_settings')
        .upsert({
          apartment_id: activeApartmentId,
          viewer_username: settings.viewer_username,
          viewer_password: settings.viewer_password,
          allow_income_view: false,
          allow_expense_view: false,
          allow_maintenance_view: settings.allow_maintenance_view,
          allow_announcement_view: false,
          allow_report_view: false,
          is_active: settings.is_active,
        }, {
          onConflict: 'apartment_id'
        });

      if (error) throw error;
      toast.success('Viewer credentials saved successfully');
    } catch (error) {
      console.error('Error saving credentials:', error);
      toast.error('Failed to save credentials');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePermissions = async () => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('viewer_settings')
        .upsert({
          apartment_id: activeApartmentId,
          viewer_username: settings.viewer_username,
          viewer_password: settings.viewer_password,
          allow_income_view: false,
          allow_expense_view: false,
          allow_maintenance_view: settings.allow_maintenance_view,
          allow_announcement_view: false,
          allow_report_view: false,
          is_active: settings.is_active,
        }, {
          onConflict: 'apartment_id'
        });

      if (error) throw error;
      toast.success('Viewer permissions saved successfully');
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast.error('Failed to save permissions');
    } finally {
      setSaving(false);
    }
  };

  const copyCredentials = () => {
    const text = `Societrack Viewer Login\nUsername: ${settings.viewer_username}\nPassword: ${settings.viewer_password}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Credentials copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-slate-50">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
        <div className="flex-1 flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="Viewer Access Settings" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Viewer Access Settings</h1>
            <p className="text-gray-500 mt-1">Configure resident viewer login credentials and permissions</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Credentials Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Shared Viewer Login</h3>
                  <p className="text-sm text-gray-500">Credentials for resident access</p>
                </div>
              </div>
              
              <div className="space-y-5">
                <InputField
                  label="Viewer Username"
                  type="text"
                  name="viewer_username"
                  placeholder="Enter a unique username"
                  value={settings.viewer_username}
                  onChange={handleChange}
                  helperText="Residents will use this username to login"
                />

                <div className="relative">
                  <InputField
                    label="Viewer Password"
                    type={showPassword ? 'text' : 'password'}
                    name="viewer_password"
                    placeholder="Enter a secure password"
                    value={settings.viewer_password}
                    onChange={handleChange}
                    helperText="At least 6 characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_active"
                    name="is_active"
                    checked={settings.is_active}
                    onChange={handleChange}
                    className="w-4 h-4 text-green-600 rounded border-gray-300 focus:ring-green-500"
                  />
                  <label htmlFor="is_active" className="text-sm text-gray-700">
                    Enable viewer access
                  </label>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button
                    variant="outline"
                    icon={copied ? Check : Copy}
                    onClick={copyCredentials}
                    disabled={!settings.viewer_username || !settings.viewer_password}
                  >
                    {copied ? 'Copied!' : 'Copy Credentials'}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={handleSaveCredentials}
                    loading={saving}
                  >
                    Save Credentials
                  </Button>
                </div>
              </div>
            </div>

            {/* Permissions Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-green-100 rounded-lg">
                  <Shield className="text-green-600" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Viewer access</h3>
                  <p className="text-sm text-gray-500">Only maintenance visibility can be toggled for shared viewer login</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-blue-900">
                  <strong>Note:</strong> Viewers have read-only access. Income, expenses, announcements, and reports access are managed in the app for residents separately.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div>
                    <p className="font-medium text-gray-900">Show maintenance</p>
                    <p className="text-sm text-gray-500">Allow viewing maintenance status for this apartment</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      name="allow_maintenance_view"
                      checked={settings.allow_maintenance_view}
                      onChange={handleChange}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>

                <Button variant="secondary" onClick={handleSavePermissions} loading={saving} fullWidth>
                  Save permissions
                </Button>
              </div>
            </div>
          </div>

          {/* Login Link Info */}
          <div className="mt-6 bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Share with Residents</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-2">
                Share this information with your residents:
              </p>
              <div className="bg-white border border-gray-200 rounded-lg p-4 font-mono text-sm">
                <p><strong>Login URL:</strong> {window.location.origin}/login</p>
                <p><strong>Select:</strong> "Resident" tab</p>
                <p><strong>Username:</strong> {settings.viewer_username || '[Not set]'}</p>
                <p><strong>Password:</strong> {settings.viewer_password ? '••••••••' : '[Not set]'}</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default ViewerSettings;
