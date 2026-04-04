import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingRequestCounts = () => {
  const [count, setCount] = useState(0);
  const { profile, companyId } = useAuth();

  useEffect(() => {
    if (!profile?.id || !companyId) return;

    const fetchCount = async () => {
      // Count requests where professional_id matches OR is null (unassigned) for this company
      const { count: assignedCount } = await supabase
        .from('appointment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('company_id', companyId);

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
  }, [profile?.id, companyId]);

  return count;
};
