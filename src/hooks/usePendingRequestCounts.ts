import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export const usePendingRequestCounts = () => {
  const [count, setCount] = useState(0);
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile?.id) return;

    const fetchCount = async () => {
      const { count: total } = await supabase
        .from('appointment_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .eq('professional_id', profile.id);

      setCount(total || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('pending-requests-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointment_requests' }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  return count;
};
