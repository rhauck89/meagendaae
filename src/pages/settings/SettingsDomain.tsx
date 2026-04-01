import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import DomainSettings from '@/components/DomainSettings';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsDomain = () => {
  const { companyId } = useAuth();
  const [companySlug, setCompanySlug] = useState('');

  useEffect(() => {
    if (companyId) {
      supabase.from('companies').select('slug').eq('id', companyId).single().then(({ data }) => {
        if (data) setCompanySlug((data as any).slug ?? '');
      });
    }
  }, [companyId]);

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Domínio" />
      <div>
        <h2 className="text-xl font-display font-bold">Domínio</h2>
        <p className="text-sm text-muted-foreground">Configure seu subdomínio padrão e domínio personalizado</p>
      </div>
      {companyId && <DomainSettings companyId={companyId} companySlug={companySlug} />}
    </div>
  );
};

export default SettingsDomain;
