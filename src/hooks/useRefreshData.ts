import { useCallback, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const QUERY_KEY_MAP: Record<string, string[][]> = {
  profile: [['profiles'], ['profile']],
  clients: [['clients'], ['client-appointments-stats'], ['client-detail-appointments']],
  services: [['services']],
  team: [['collaborators'], ['company']],
  agenda: [['appointments'], ['agenda']],
  promotions: [['promotions'], ['promotion-clicks'], ['promotion-bookings']],
  events: [['events'], ['event-slots']],
  settings: [['company'], ['company-settings'], ['platform-settings']],
  finance: [['company-expenses'], ['company-revenues'], ['company-expense-categories'], ['company-revenue-categories']],
  reviews: [['reviews']],
};

export type RefreshKey = keyof typeof QUERY_KEY_MAP;

/**
 * Global data refresh hook.
 * 
 * Usage:
 *   const { refresh } = useRefreshData();
 *   refresh('clients');              // single module
 *   refresh('clients', 'services');  // multiple modules
 */
export const useRefreshData = () => {
  const queryClient = useQueryClient();

  const refresh = useCallback((...keys: RefreshKey[]) => {
    keys.forEach((key) => {
      const queryKeys = QUERY_KEY_MAP[key];
      if (queryKeys) {
        queryKeys.forEach((qk) => {
          queryClient.invalidateQueries({ queryKey: qk });
        });
      }
      window.dispatchEvent(new CustomEvent('data-refresh', { detail: { key } }));
    });
  }, [queryClient]);

  const refreshAll = useCallback(() => {
    refresh(...(Object.keys(QUERY_KEY_MAP) as RefreshKey[]));
  }, [refresh]);

  return { refresh, refreshAll };
};

/**
 * Subscribe to refresh events for pages using manual useState + fetch.
 * 
 * Usage:
 *   useOnDataRefresh('promotions', fetchPromotions);
 */
export const useOnDataRefresh = (key: RefreshKey, callback: () => void) => {
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail?.key === key) {
        callback();
      }
    };
    window.addEventListener('data-refresh', handler);
    return () => window.removeEventListener('data-refresh', handler);
  }, [key, callback]);
};
