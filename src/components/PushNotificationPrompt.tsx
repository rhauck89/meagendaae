import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';

const DISMISSED_KEY = 'push_prompt_dismissed';

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !isSupported || isSubscribed || permission === 'denied') {
      setVisible(false);
      return;
    }

    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      // Show again after 7 days
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) {
        setVisible(false);
        return;
      }
    }

    // Show prompt after 2 seconds
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, permission]);

  const handleAllow = async () => {
    setLoading(true);
    await subscribe();
    setLoading(false);
    setVisible(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border border-border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">
              Deseja receber notificações?
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Receba alertas de novos agendamentos, cancelamentos e reagendamentos em tempo real.
            </p>
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={handleAllow} disabled={loading}>
                {loading ? 'Ativando...' : 'Permitir'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                Agora não
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
