import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerNativeNavigateHandler } from '../lib/mobileOAuth';

/** Lets native OAuth deep links navigate via React Router (avoids full reload white screen). */
export default function NativeNavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => registerNativeNavigateHandler((path) => navigate(path, { replace: true })), [navigate]);

  return null;
}
