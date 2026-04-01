import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { supabase } from '@/integrations/supabase/client';

interface CompanyBrandInfo {
  logo_url: string | null;
  name: string;
  isWhitelabel: boolean;
  loading: boolean;
}

export const useCompanyBrandInfo = (): CompanyBrandInfo => {
  const { companyId } = useAuth();
  const { isFeatureEnabled, loading: planLoading } = useCompanyPlan();
  const [logo, setLogo] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    supabase
      .from('companies')
      .select('logo_url, name')
      .eq('id', companyId)
      .single()
      .then(({ data }) => {
        if (data) {
          setLogo(data.logo_url);
          setName(data.name);
        }
        setLoading(false);
      });
  }, [companyId]);

  return {
    logo_url: logo,
    name,
    isWhitelabel: !planLoading && isFeatureEnabled('whitelabel'),
    loading: loading || planLoading,
  };
};
