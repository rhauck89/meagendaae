import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

export interface ProfessionalPermissions {
  clients: boolean;
  promotions: boolean;
  events: boolean;
  requests: boolean;
  finance: boolean;
  loading: boolean;
}

export const useProfessionalPermissions = (): ProfessionalPermissions => {
  const { companyId } = useAuth();
  const [perms, setPerms] = useState<Omit<ProfessionalPermissions, 'loading'>>({
    clients: true,
    promotions: true,
    events: true,
    requests: true,
    finance: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('companies')
      .select('prof_perm_clients, prof_perm_promotions, prof_perm_events, prof_perm_requests, prof_perm_finance')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data) {
          const d = data as any;
          setPerms({
            clients: d.prof_perm_clients ?? true,
            promotions: d.prof_perm_promotions ?? true,
            events: d.prof_perm_events ?? true,
            requests: d.prof_perm_requests ?? true,
            finance: d.prof_perm_finance ?? true,
          });
        }
        setLoading(false);
      });
  }, [companyId]);

  return { ...perms, loading };
};
