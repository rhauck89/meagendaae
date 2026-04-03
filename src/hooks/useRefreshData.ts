import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Predefined query key mappings for React Query invalidation.
 * Pages using useQuery with these keys will automatically refetch.
 * Pages using manual fetch can subscribe to the 'data-refresh' custom event.
 */
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

type RefreshKey = keyof typeof QUERY_KEY_MAP;

/**
 * Global data refresh hook.
 * 
 * Usage:
 *   const { refresh, refreshAll } = useRefreshData();
 *   
 *   // After a successful CRUD operation:
 *   refresh('clients');
 *   
 *   // Refresh multiple modules:
 *   refresh('clients', 'services');
 */
export const useRefreshData = () => {
  const queryClient = useQueryClient();

  const refresh = useCallback((...keys: RefreshKey[]) => {
    keys.forEach((key) => {
      // Invalidate React Query caches
      const queryKeys = QUERY_KEY_MAP[key];
      if (queryKeys) {
        queryKeys.forEach((qk) => {
          queryClient.invalidateQueries({ queryKey: qk });
        });
      }

      // Dispatch custom event for pages using manual fetch patterns
      window.dispatchEvent(new CustomEvent('data-refresh', { detail: { key } }));
    });
  }, [queryClient]);

  const refreshAll = useCallback(() => {
    const allKeys = Object.keys(QUERY_KEY_MAP) as RefreshKey[];
    refresh(...allKeys);
  }, [refresh]);

  return { refresh, refreshAll };
};

/**
 * Hook to subscribe to refresh events for manual-fetch pages.
 * 
 * Usage:
 *   useOnDataRefresh('promotions', () => {
 *     fetchPromotions();
 *   });
 */
export const useOnDataRefresh = (key: RefreshKey, callback: () => void) => {
  // Using useEffect inside the consuming component
  // This is a factory that returns the event handler setup
  const { useEffect } = require('react');

  useEffect(() => {
    const handler = (e: CustomEvent) => {
      if (e.detail?.key === key) {
        callback();
      }
    };
    window.addEventListener('data-refresh', handler as EventListener);
    return () => window.removeEventListener('data-refresh', handler as EventListener);
  }, [key, callback]);
};
