import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const SPLASH_MIN_MS = 1500;

const AppRedirect = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const settings = usePlatformSettings();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !splashDone) return;
    navigate(user ? '/dashboard' : '/auth', { replace: true });
  }, [user, loading, splashDone, navigate]);

  const bgColor = settings?.splash_background_color || '#0f2a5c';
  const logoUrl = settings?.splash_logo || settings?.system_logo;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center"
      style={{ backgroundColor: bgColor }}
    >
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="h-20 w-auto mb-6 animate-pulse" />
      ) : (
        <div className="text-3xl font-bold text-white mb-6 animate-pulse">
          {settings?.system_name || 'MeAgendaAê'}
        </div>
      )}
      <div className="flex gap-1">
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: '300ms' }} />
      </div>
    </div>
  );
};

export default AppRedirect;
