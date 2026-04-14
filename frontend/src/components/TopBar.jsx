import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Settings, ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TopBar = ({ onMenuClick, title }) => {
  const navigate = useNavigate();
  const {
    userProfile,
    apartment,
    signOut,
    isResident,
    adminApartments,
    setActiveApartment,
    saManagedApartmentId,
    exitSaManageMode,
  } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isSaManaging = isSuperAdmin && !!saManagedApartmentId;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showApartmentMenu, setShowApartmentMenu] = useState(false);
  const apartmentMenuRef = useRef(null);

  const initial = isResident ? 'R' : (userProfile?.name?.charAt(0)?.toUpperCase() || 'U');

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (apartmentMenuRef.current && !apartmentMenuRef.current.contains(event.target)) {
        setShowApartmentMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 -ml-1 text-gray-500 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu size={22} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            {/* Super Admin managing a society */}
            {isSaManaging && (
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                  <Building2 size={12} />
                  Managing
                </span>
                <span className="text-xs text-gray-600 truncate max-w-[200px]">{apartment?.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    exitSaManageMode();
                    navigate('/superadmin/apartments');
                  }}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800"
                >
                  Exit
                </button>
              </div>
            )}

            {/* Apartment Selector */}
            {!isResident && !isSuperAdmin && adminApartments && adminApartments.length > 0 && (
              <div className="relative" ref={apartmentMenuRef}>
                <button
                  onClick={() => setShowApartmentMenu(!showApartmentMenu)}
                  className="text-xs text-emerald-600 font-medium hidden sm:flex items-center gap-1 hover:text-emerald-700 transition-colors"
                >
                  <Building2 size={14} />
                  {apartment?.name || 'Select Apartment'}
                  <ChevronDown size={12} className={`transition-transform ${showApartmentMenu ? 'rotate-180' : ''}`} />
                </button>
                
                {showApartmentMenu && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] z-50">
                    {adminApartments.map((apt) => (
                      <button
                        key={apt.id}
                        onClick={() => {
                          setActiveApartment(apt.id);
                          setShowApartmentMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2 ${
                          apartment?.id === apt.id ? 'bg-emerald-50 text-emerald-700 font-medium' : 'text-gray-700'
                        }`}
                      >
                        <Building2 size={14} />
                        {apt.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {!isResident && (
            <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-slate-100 rounded-lg relative transition-colors">
              <Bell size={20} />
            </button>
          )}

          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm">
                {initial}
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold text-gray-800 leading-tight">
                  {isResident ? 'Resident' : (userProfile?.name?.split(' ')[0] || 'User')}
                </p>
                <p className="text-xs text-gray-400 capitalize leading-tight">
                  {isResident ? 'Viewer' : userProfile?.role?.replace('_', ' ')}
                </p>
              </div>
              <ChevronDown size={14} className="text-gray-400 hidden sm:block" />
            </button>

            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 py-2 z-50">
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gradient-to-br from-emerald-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                        {initial}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {isResident ? 'Resident Access' : userProfile?.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate max-w-[140px]">
                          {isResident ? apartment?.name : userProfile?.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  {!isResident && !isSuperAdmin && (
                    <>
                      <Link
                        to="/admin/account"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <User size={15} className="text-gray-400" />
                        My Account
                      </Link>
                      <Link
                        to="/admin/viewer-settings"
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-slate-50 transition-colors"
                        onClick={() => setShowProfileMenu(false)}
                      >
                        <Settings size={15} className="text-gray-400" />
                        Viewer Settings
                      </Link>
                    </>
                  )}

                  <div className="border-t border-gray-100 mt-1 pt-1">
                    <button
                      onClick={() => { setShowProfileMenu(false); signOut(); }}
                      className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Sign Out
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopBar;
