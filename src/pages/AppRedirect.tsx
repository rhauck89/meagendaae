import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';

const SPLASH_MIN_MS = 1000;

const AppRedirect = () => {
  const { user, loading, companyId, profile } = useAuth();
  const navigate = useNavigate();
  const settings = usePlatformSettings();
  const [splashDone, setSplashDone] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
    const timer = setTimeout(() => setSplashDone(true), SPLASH_MIN_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (loading || !splashDone) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    // User is logged in — always go to dashboard.
    // DashboardLayout will handle onboarding if companyId is missing.
    navigate('/dashboard', { replace: true });
  }, [user, loading, splashDone, navigate]);

  const bgColor = settings?.splash_background_color || '#0f2a5c';
  const logoUrl = settings?.splash_logo || settings?.system_logo;
  const appName = settings?.system_name || 'Me Agendaê';

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-[9999]"
      style={{ backgroundColor: bgColor }}
    >
      <div
        className="flex flex-col items-center justify-center transition-all duration-700 ease-out"
        style={{
          opacity: animateIn ? 1 : 0,
          transform: animateIn ? 'scale(1)' : 'scale(0.95)',
        }}
      >
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={appName}
            className="h-24 w-auto mb-6 drop-shadow-lg"
          />
        ) : (
          <div className="h-24 w-24 rounded-2xl bg-white/10 flex items-center justify-center mb-6">
            <span className="text-4xl font-bold text-white">
              {appName.charAt(0)}
            </span>
          </div>
        )}

        <h1 className="text-2xl font-bold text-white mb-1 tracking-tight">
          {appName}
        </h1>
        <p className="text-sm text-white/60 font-medium">
          Agendamentos inteligentes
        </p>
      </div>

      {/* Loading dots */}
      <div className="absolute bottom-16 flex gap-1.5">
        <div
          className="w-2 h-2 rounded-full bg-white/50 animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-white/50 animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <div
          className="w-2 h-2 rounded-full bg-white/50 animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
};

export default AppRedirect;
