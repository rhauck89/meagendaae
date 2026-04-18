import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface TrialUsageStats {
  daysUsed: number;
  appointmentsCount: number;
  clientsCount: number;
  totalRevenue: number;
  loading: boolean;
}

export const useTrialUsageStats = (): TrialUsageStats => {
  const { user } = useAuth();
  const [stats, setStats] = useState<TrialUsageStats>({
    daysUsed: 0,
    appointmentsCount: 0,
    clientsCount: 0,
    totalRevenue: 0,
    loading: true,
  });

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', user.id)
          .maybeSingle();

        const companyId = profile?.company_id;
        if (!companyId) {
          if (!cancelled) setStats((s) => ({ ...s, loading: false }));
          return;
        }

        const { data: company } = await supabase
          .from('companies')
          .select('created_at, trial_start_date')
          .eq('id', companyId)
          .maybeSingle();

        const startDate = company?.trial_start_date || company?.created_at;
        const daysUsed = startDate
          ? Math.max(
              1,
              Math.floor((Date.now() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
            )
          : 0;

        const [{ count: appointmentsCount }, { count: clientsCount }, { data: revenueRows }] =
          await Promise.all([
            supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId),
            supabase
              .from('clients')
              .select('id', { count: 'exact', head: true })
              .eq('company_id', companyId),
            supabase
              .from('appointments')
              .select('total_price')
              .eq('company_id', companyId)
              .eq('status', 'completed'),
          ]);

        const totalRevenue = (revenueRows || []).reduce(
          (sum: number, r: { total_price: number | null }) => sum + Number(r.total_price || 0),
          0
        );

        if (!cancelled) {
          setStats({
            daysUsed,
            appointmentsCount: appointmentsCount || 0,
            clientsCount: clientsCount || 0,
            totalRevenue,
            loading: false,
          });
        }
      } catch (e) {
        console.error('useTrialUsageStats error', e);
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  return stats;
};
