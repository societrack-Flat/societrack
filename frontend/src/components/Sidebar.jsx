import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Building2,
  DoorOpen,
  IndianRupee,
  Receipt,
  BarChart3,
  Clock,
  Megaphone,
  User,
  Settings,
  LogOut,
  X,
  CreditCard,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLogo from './BrandLogo';

const Sidebar = ({ isOpen, onClose, role }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, apartment, signOut, isResident, saManagedApartmentId, exitSaManageMode } = useAuth();
  const isSaManaging = userProfile?.role === 'super_admin' && !!saManagedApartmentId;

  const adminNavItems = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/admin/dashboard' },
        { name: 'Apartments', icon: Building2, path: '/admin/apartments' },
        { name: 'Flats', icon: DoorOpen, path: '/admin/flats' },
        { name: 'Income', icon: IndianRupee, path: '/admin/income' },
        { name: 'Expenses', icon: Receipt, path: '/admin/expenses' },
      ],
    },
    {
      title: 'MANAGEMENT',
      items: [
        { name: 'Reports', icon: BarChart3, path: '/admin/reports' },
        { name: 'Maintenance', icon: Clock, path: '/admin/maintenance' },
        { name: 'Announcements', icon: Megaphone, path: '/admin/announcements' },
      ],
    },
    {
      title: 'ACCOUNT',
      items: [
        { name: 'My Account', icon: User, path: '/admin/account' },
        { name: 'Viewer Access Settings', icon: Settings, path: '/admin/viewer-settings' },
      ],
    },
  ];

  const superAdminNavItems = [
    {
      title: 'NAVIGATION',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/superadmin/dashboard' },
        { name: 'Apartments', icon: Building2, path: '/superadmin/apartments' },
        { name: 'Subscriptions', icon: CreditCard, path: '/superadmin/subscriptions' },
        { name: 'Analytics', icon: BarChart3, path: '/superadmin/analytics' },
        { name: 'Users', icon: Users, path: '/superadmin/users' },
      ],
    },
  ];

  const residentNavItems = [
    {
      title: 'MAIN',
      items: [
        { name: 'Dashboard', icon: LayoutDashboard, path: '/resident/dashboard' },
        { name: 'Income', icon: IndianRupee, path: '/resident/income' },
        { name: 'Expenses', icon: Receipt, path: '/resident/expenses' },
        { name: 'Maintenance', icon: Clock, path: '/resident/maintenance' },
        { name: 'Announcements', icon: Megaphone, path: '/resident/announcements' },
        { name: 'Reports', icon: BarChart3, path: '/resident/reports' },
      ],
    },
  ];

  const getNavItems = () => {
    if (isResident) return residentNavItems;
    if (role === 'super_admin' && !isSaManaging) return superAdminNavItems;
    return adminNavItems;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-slate-800 text-white
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo / Super Admin branding */}
          <div className="flex items-center justify-between min-h-[4rem] px-4 border-b border-slate-700">
            {role === 'super_admin' && !isSaManaging ? (
              <div className="flex items-center gap-3 py-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  SA
                </div>
                <div>
                  <p className="font-bold text-white leading-tight">Super Admin</p>
                  <p className="text-xs text-slate-400">System Management</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center min-w-0 pr-1">
                <BrandLogo variant="onDark" size="sm" />
              </div>
            )}
            <button
              onClick={onClose}
              className="lg:hidden p-1 hover:bg-slate-700 rounded"
            >
              <X size={20} />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4 px-3">
            {isSaManaging && (
              <div className="mb-4 px-3">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Super Admin</p>
                <button
                  type="button"
                  onClick={() => {
                    exitSaManageMode();
                    onClose?.();
                    navigate('/superadmin/apartments');
                  }}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-slate-700/80 text-slate-200 hover:bg-slate-600 border border-slate-600"
                >
                  ← Exit to Super Admin
                </button>
                <p className="text-xs text-slate-400 mt-2 line-clamp-2" title={apartment?.name}>
                  Managing: <span className="text-lime-300 font-medium">{apartment?.name || '…'}</span>
                </p>
              </div>
            )}
            {navItems.map((section, idx) => (
              <div key={idx} className="mb-6">
                <p className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;
                    return (
                      <li key={item.path}>
                        <NavLink
                          to={item.path}
                          onClick={onClose}
                          className={`
                            flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                            transition-colors duration-200
                            ${isActive
                              ? 'bg-blue-500 text-white'
                              : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                            }
                          `}
                        >
                          <Icon size={20} />
                          {item.name}
                        </NavLink>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>

          {/* User info & Logout */}
          <div className="p-4 border-t border-slate-700">
            {role === 'super_admin' && !isSaManaging && (
              <p className="text-xs text-slate-500 mb-3 px-1">Super Admin</p>
            )}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-slate-600 rounded-full flex items-center justify-center">
                <User size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {isResident ? 'Resident' : (userProfile?.name || 'User')}
                </p>
                <p className="text-xs text-slate-400 truncate">
                  {isResident ? apartment?.name : userProfile?.email}
                </p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-red-500 hover:bg-red-600 rounded-lg text-sm font-medium transition-colors"
            >
              <LogOut size={18} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;