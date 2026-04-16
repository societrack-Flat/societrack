import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Menu, Bell, User, LogOut, Settings, ChevronDown, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useSupportUnread } from '../hooks/useSupportUnread';
import { supabase } from '../lib/supabaseClient';

const TopBar = ({ onMenuClick, title, hideTitle = false }) => {
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
  const { unreadCount } = useSupportUnread();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isSaManaging = isSuperAdmin && !!saManagedApartmentId;
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showApartmentMenu, setShowApartmentMenu] = useState(false);
  const [showSaBellMenu, setShowSaBellMenu] = useState(false);
  const [saBellLoading, setSaBellLoading] = useState(false);
  const [saBellItems, setSaBellItems] = useState([]);
  const apartmentMenuRef = useRef(null);
  const saBellRef = useRef(null);

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

  useEffect(() => {
    if (!showSaBellMenu) return undefined;
    const close = (e) => {
      if (saBellRef.current && !saBellRef.current.contains(e.target)) {
        setShowSaBellMenu(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [showSaBellMenu]);

  const handleBellClick = async () => {
    if (isSuperAdmin && !saManagedApartmentId) {
      if (showSaBellMenu) {
        setShowSaBellMenu(false);
        return;
      }
      setShowSaBellMenu(true);
      setSaBellLoading(true);
      try {
        const { data, error } = await supabase.rpc('support_unread_senders_for_superadmin');
        if (error) throw error;
        setSaBellItems(Array.isArray(data) ? data : []);
      } catch (e) {
        console.warn(e);
        setSaBellItems([]);
      } finally {
        setSaBellLoading(false);
      }
      return;
    }
    const to =
      userProfile?.role === 'super_admin' && !saManagedApartmentId
        ? '/superadmin/dashboard'
        : '/admin/dashboard';
    navigate(to);
  };

  const openChatForApartment = (apartmentId) => {
    navigate(`/superadmin/dashboard?chatApartment=${apartmentId}`);
    setShowSaBellMenu(false);
    window.dispatchEvent(new CustomEvent('support-inbox-changed'));
  };

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
            {!hideTitle && title != null && title !== '' && (
              <h1 className="text-lg font-bold text-gray-900">{title}</h1>
            )}
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
            <div className="relative" ref={saBellRef}>
              <button
                type="button"
                title={isSuperAdmin && !saManagedApartmentId ? 'Support messages' : 'Support messages'}
                onClick={handleBellClick}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-slate-100 rounded-lg relative transition-colors"
              >
                <Bell size={20} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold leading-none">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {isSuperAdmin && !saManagedApartmentId && showSaBellMenu && (
                <div className="absolute right-0 top-full mt-1 w-72 max-h-80 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg z-50 py-1">
                  <div className="px-3 py-2 border-b border-gray-100">
                    <p className="text-xs font-semibold text-gray-900">Messages from admins</p>
                    <p className="text-[10px] text-gray-500">Tap a name to open that chat</p>
                  </div>
                  {saBellLoading ? (
                    <p className="px-3 py-4 text-sm text-gray-500 text-center">Loading…</p>
                  ) : saBellItems.length === 0 ? (
                    <div className="px-3 py-2">
                      <p className="text-sm text-gray-600">No unread admin messages</p>
                      <button
                        type="button"
                        className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                        onClick={() => {
                          navigate('/superadmin/dashboard');
                          setShowSaBellMenu(false);
                        }}
                      >
                        Open support chat
                      </button>
                    </div>
                  ) : (
                    saBellItems.map((row) => (
                      <button
                        key={row.apartment_id}
                        type="button"
                        onClick={() => openChatForApartment(row.apartment_id)}
                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 flex items-start justify-between gap-2 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium text-gray-900 truncate min-w-0">
                          {row.admin_name || 'Admin'}
                        </span>
                        <span className="shrink-0 text-xs font-semibold text-gray-800 bg-amber-100 px-2 py-0.5 rounded-full">
                          {Number(row.unread_count) > 99 ? '99+' : row.unread_count}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
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
