import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const VAPID_PUBLIC_KEY = 'BMMM2-HgXKJ5db00JRldeIKkKDU_ydN79_vt7vawFC90mmZo13zRR0VhFZ6xEuEuIuiIsL--Y2UaSXIppOf3_p0';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  const persistSubscription = useCallback(async (subscription: PushSubscription): Promise<boolean> => {
    if (!user) return false;

    try {
      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint;
      const p256dh = subJson.keys?.p256dh;
      const auth = subJson.keys?.auth;

      if (!endpoint || !p256dh || !auth) {
        console.error('Invalid subscription object:', subJson);
        return false;
      }

      const userAgent = navigator.userAgent;
      let deviceName = 'Navegador';
      
      if (/android/i.test(userAgent)) deviceName = 'Android';
      else if (/iphone|ipad|ipod/i.test(userAgent)) deviceName = 'iOS';
      else if (/mac/i.test(userAgent)) deviceName = 'macOS';
      else if (/windows/i.test(userAgent)) deviceName = 'Windows';
      else if (/linux/i.test(userAgent)) deviceName = 'Linux';

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: userAgent,
            device_name: deviceName,
            last_seen_at: new Date().toISOString()
          },
          { onConflict: 'user_id,endpoint' }
        );

      if (error) {
        console.error('Error saving push subscription:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in persistSubscription:', err);
      return false;
    }
  }, [user]);

  const checkExistingSubscription = useCallback(async () => {
    if (!user) return;
    try {
      // Check if serviceWorker is available
      if (!navigator.serviceWorker) {
        console.warn('[PUSH] serviceWorker not available in navigator');
        return;
      }

      // Use a timeout for serviceWorker.ready to avoid hanging
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 5000))
      ]);
      
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await persistSubscription(subscription);
      }

      setIsSubscribed(!!subscription);
    } catch (err) {
      console.warn('Could not check existing subscription:', err);
      setIsSubscribed(false);
    }
  }, [persistSubscription, user]);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);

    if (supported) {
      setPermission(Notification.permission);
      checkExistingSubscription();
    }
  }, [user, checkExistingSubscription]);

  const subscribe = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!user) return { success: false, error: 'Usuário não autenticado' };
    if (!isSupported) return { success: false, error: 'Notificações não suportadas neste navegador' };

    setLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== 'granted') {
        return { success: false, error: 'Permissão negada pelo usuário' };
      }

      console.log('[PUSH] Waiting for Service Worker to be ready...');
      const registration = await Promise.race([
        navigator.serviceWorker.ready,
        new Promise<ServiceWorkerRegistration>((_, reject) => setTimeout(() => reject(new Error('SW_TIMEOUT')), 15000))
      ]);
      console.log('[PUSH] Service Worker ready');

      // Check if already subscribed
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
        });
      }

      const saved = await persistSubscription(subscription);

      if (!saved) {
        return { success: false, error: 'Erro ao salvar inscrição no banco de dados' };
      }

      setIsSubscribed(true);
      return { success: true };
    } catch (err: any) {
      console.error('Error subscribing to push:', err);
      let errorMessage = 'Erro desconhecido ao ativar notificações';
      if (err.message === 'SW_TIMEOUT') errorMessage = 'Service Worker não respondeu a tempo. Tente recarregar a página.';
      else if (err.name === 'NotAllowedError') errorMessage = 'Permissão de notificação negada.';
      else if (err.message) errorMessage = err.message;
      
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [user, isSupported, persistSubscription]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!user) return false;

    setLoading(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('user_id', user.id)
          .eq('endpoint', subscription.endpoint);
      }

      setIsSubscribed(false);
      return true;
    } catch (err) {
      console.error('Error unsubscribing:', err);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    isSupported,
    permission,
    isSubscribed,
    loading,
    subscribe,
    unsubscribe,
  };
}
