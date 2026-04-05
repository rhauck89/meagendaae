import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';

export const usePendingRequestCounts = () => {
  const [count, setCount] = useState(0);
  const { profile, companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();

  useEffect(() => {
    if (!profile?.id || !companyId) return;

    const fetchCount = async () => {
      let query = supabase
        .from('appointment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('company_id', companyId);

      // Professionals only count their own requests
      if (!isAdmin && profileId) {
        query = query.eq('professional_id', profileId);
      }

      const { count: assignedCount } = await query;
      setCount(assignedCount || 0);
    };

    fetchCount();

    const channel = supabase
      .channel(`pending-requests-${profile.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointment_requests',
      }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, companyId, isAdmin, profileId]);

  return count;
};
