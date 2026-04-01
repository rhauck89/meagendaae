import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePlatformMessages = () => {
  const { companyId } = useAuth();

  return useQuery({
    queryKey: ['platform-messages-user', companyId],
    queryFn: async () => {
      // Get company info to filter messages
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

      // Client-side filter by target
      return (data || []).filter((msg: any) => {
        if (msg.target_business_type && msg.target_business_type !== 'all' && msg.target_business_type !== businessType) return false;
        if (msg.target_plan && msg.target_plan !== planId) return false;
        return true;
      });
    },
    enabled: !!companyId,
  });
};
