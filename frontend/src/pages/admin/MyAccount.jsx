import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { User, Mail, Phone, Shield, Calendar, CreditCard } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatDate, formatCurrency } from '../../lib/supabaseClient';
import Sidebar from '../../components/Sidebar';
import TopBar from '../../components/TopBar';
import Button from '../../components/Button';
import InputField from '../../components/InputField';
import Card from '../../components/Card';
import toast from 'react-hot-toast';

const MyAccount = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const { userProfile, apartment, updateProfile, updatePassword, signOut, checkSubscription } = useAuth();

  const [profileData, setProfileData] = useState({
    name: userProfile?.name || '',
    phone: userProfile?.phone || '',
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  if (userProfile?.role === 'super_admin') {
    return <Navigate to="/superadmin/dashboard" replace />;
  }

  const handleProfileChange = (e) => {
    setProfileData({ ...profileData, [e.target.name]: e.target.value });
  };

  const handlePasswordChange = (e) => {
    setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();

    if (!profileData.name.trim()) {
      toast.error('Name is required');
      return;
    }

    setLoading(true);
    const result = await updateProfile({
      name: profileData.name,
      phone: profileData.phone,
    });
    setLoading(false);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    if (!passwordData.newPassword) {
      toast.error('New password is required');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    const result = await updatePassword(passwordData.newPassword);
    if (result.success) {
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    }
    setLoading(false);
  };

  const getPlanDetails = (planName) => {
    const plans = {
      free_trial: { name: 'Free Trial', price: 0, limit: 50 },
      basic: { name: 'Basic', price: 199, limit: 50 },
      standard: { name: 'Standard', price: 299, limit: 100 },
      premium: { name: 'Premium', price: 399, limit: 500 },
    };
    return plans[planName] || plans.free_trial;
  };

  const plan = getPlanDetails(apartment?.plan_name);
  const subscription = checkSubscription();

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} role={userProfile?.role} />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar onMenuClick={() => setSidebarOpen(true)} title="My Account" />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
            <p className="text-gray-500 mt-1">Manage your profile and settings</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Profile Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Profile Information</h3>
              
              <form onSubmit={handleProfileSubmit} className="space-y-5">
                <InputField
                  label="Full Name"
                  type="text"
                  name="name"
                  placeholder="Enter your name"
                  value={profileData.name}
                  onChange={handleProfileChange}
                  icon={User}
                  required
                />

                <InputField
                  label="Email Address"
                  type="email"
                  value={userProfile?.email || ''}
                  icon={Mail}
                  readOnly
                  disabled
                  helperText="Email cannot be changed"
                />

                <InputField
                  label="Phone Number"
                  type="tel"
                  name="phone"
                  placeholder="+91 9876543210"
                  value={profileData.phone}
                  onChange={handleProfileChange}
                  icon={Phone}
                />

                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-600">Role:</span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800 capitalize">
                    <Shield size={14} className="mr-1.5" />
                    {userProfile?.role?.replace('_', ' ')}
                  </span>
                </div>

                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Calendar size={16} />
                  <span>Account created: {formatDate(userProfile?.created_at)}</span>
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  loading={loading}
                  fullWidth
                >
                  Update Profile
                </Button>
              </form>
            </div>

            {/* Password Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Change Password</h3>
              
              <form onSubmit={handlePasswordSubmit} className="space-y-5">
                <InputField
                  label="Current Password"
                  type="password"
                  name="currentPassword"
                  placeholder="Enter current password"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                />

                <InputField
                  label="New Password"
                  type="password"
                  name="newPassword"
                  placeholder="Enter new password"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  helperText="At least 6 characters"
                />

                <InputField
                  label="Confirm New Password"
                  type="password"
                  name="confirmPassword"
                  placeholder="Re-enter new password"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                />

                <Button
                  type="submit"
                  variant="secondary"
                  loading={loading}
                  fullWidth
                >
                  Change Password
                </Button>
              </form>
            </div>

            {/* Subscription Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Subscription Plan</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Current Plan</span>
                  <span className="font-semibold text-gray-900 capitalize">{plan.name}</span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Status</span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                    apartment?.subscription_status === 'active'
                      ? 'bg-green-100 text-green-800'
                      : apartment?.subscription_status === 'trial'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {apartment?.subscription_status}
                  </span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Flat Limit</span>
                  <span className="font-semibold text-gray-900">{apartment?.flat_limit || plan.limit}</span>
                </div>

                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Monthly Price</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(apartment?.monthly_price || plan.price)}</span>
                </div>

                {apartment?.subscription_status === 'trial' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Trial Ends</span>
                      <span className="font-semibold text-yellow-600">{formatDate(apartment?.trial_end_date)}</span>
                    </div>
                    {subscription?.status === 'trial' && subscription?.daysLeft != null && (
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <span className="text-gray-600">Days Left</span>
                        <span className="font-semibold text-yellow-700">{subscription.daysLeft} days</span>
                      </div>
                    )}
                  </>
                )}

                <a href="/subscribe" className="block mt-4">
                  <Button variant="secondary" fullWidth icon={CreditCard}>
                    {apartment?.subscription_status === 'trial' ? 'Upgrade Plan' : 'Manage Subscription'}
                  </Button>
                </a>
              </div>
            </div>

            {/* Apartment Info Card */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-6">Apartment Information</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Apartment Name</span>
                  <span className="font-semibold text-gray-900">{apartment?.name}</span>
                </div>

                {apartment?.address && (
                  <div className="pb-3 border-b border-gray-100">
                    <span className="text-gray-600 block mb-1">Address</span>
                    <span className="text-gray-900">{apartment.address}</span>
                  </div>
                )}

                <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                  <span className="text-gray-600">Created</span>
                  <span className="text-gray-900">{formatDate(apartment?.created_at)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Logout Button */}
          <div className="mt-8">
            <Button
              variant="danger"
              fullWidth
              onClick={signOut}
            >
              Logout
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
};

export default MyAccount;
