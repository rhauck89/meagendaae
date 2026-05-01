import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface TicketCounts {
  open: number;
  in_progress: number;
  answered: number;
  total_pending: number;
}

export const useSupportTicketCounts = (isSuperAdmin: boolean) => {
  const [counts, setCounts] = useState<TicketCounts>({ open: 0, in_progress: 0, answered: 0, total_pending: 0 });

  useEffect(() => {
    const count = (window as any)._trace_useSupportTicketCounts = ((window as any)._trace_useSupportTicketCounts || 0) + 1;
    console.log('[SUPER_ADMIN_EFFECT_TRACE]', { component: "useSupportTicketCounts", effect: "isSuperAdmin-change", count, deps: [isSuperAdmin] });
    
    if (!isSuperAdmin) return;


    const fetchCounts = async () => {
      const { data } = await supabase
        .from('support_tickets')
        .select('status');
      
      if (data) {
        const open = data.filter(t => t.status === 'open').length;
        const in_progress = data.filter(t => t.status === 'in_progress').length;
        const answered = data.filter(t => t.status === 'answered').length;
        setCounts({
          open,
          in_progress,
          answered,
          total_pending: open + in_progress,
        });
      }
    };

    fetchCounts();

    const channel = supabase
      .channel('support-tickets-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isSuperAdmin]);

  return counts;
};

export const useUserTicketCounts = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('support_tickets')
        .select('id, status')
        .eq('user_id', user.id)
        .in('status', ['answered', 'in_progress']);
      
      setUnreadCount(data?.length || 0);
    };

    fetchUnread();

    const channel = supabase
      .channel('user-tickets-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return unreadCount;
};
