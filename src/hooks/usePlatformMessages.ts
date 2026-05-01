import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useState, useCallback } from 'react';

const DISMISSED_KEY = 'dismissed_platform_messages';

const getDismissedIds = (): string[] => {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
};

export const usePlatformMessages = () => {
  const { companyId } = useAuth();
  const [dismissedIds, setDismissedIds] = useState<string[]>(getDismissedIds);

  useEffect(() => {
    const count = (window as any)._trace_usePlatformMessages = ((window as any)._trace_usePlatformMessages || 0) + 1;
    console.log('[SUPER_ADMIN_EFFECT_TRACE]', { component: "usePlatformMessages", effect: "render", count, deps: [companyId] });
  });


  const dismiss = useCallback((id: string) => {
    setDismissedIds(prev => {
      const next = [...prev, id];
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const query = useQuery({
    queryKey: ['platform-messages-user', companyId],
    queryFn: async () => {
      let businessType: string | null = null;
      let planId: string | null = null;

      if (companyId) {
        const { data: company } = await supabase
          .from('companies')
          .select('business_type, plan_id')
          .eq('id', companyId)
          .single();
        if (company) {
          businessType = company.business_type;
          planId = company.plan_id;
        }
      }

      const { data, error } = await supabase
        .from('platform_messages')
        .select('*')
        .eq('active', true)
        .eq('send_dashboard_notification', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;

      return (data || []).filter((msg: any) => {
        if (msg.target_business_type && msg.target_business_type !== 'all' && msg.target_business_type !== businessType) return false;
        if (msg.target_plan && msg.target_plan !== planId) return false;
        return true;
      });
    },
    enabled: !!companyId,
  });

  const visibleMessages = (query.data || []).filter((msg: any) => !dismissedIds.includes(msg.id));

  return { ...query, data: visibleMessages, allData: query.data, dismiss };
};
