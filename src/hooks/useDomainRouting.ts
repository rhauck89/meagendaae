import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface DomainCompany {
  companyId: string;
  slug: string;
  businessType: string;
}

export const useDomainRouting = () => {
  const [domainCompany, setDomainCompany] = useState<DomainCompany | null>(null);
  const [isCustomDomain, setIsCustomDomain] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDomain = async () => {
      const hostname = window.location.hostname;

      // Skip for known platform domains
      if (
        hostname === 'localhost' ||
        hostname.includes('lovable.app') ||
        hostname.includes('agendapro.com') ||
        hostname.includes('127.0.0.1')
      ) {
        setLoading(false);
        return;
      }

      // Check if this hostname is a verified custom domain
      const { data } = await supabase
        .from('company_domains' as any)
        .select('company_id')
        .eq('domain', hostname)
        .eq('verified', true)
        .single();

      if (data) {
        const companyData = data as any;
        // Fetch company slug and business type
        const { data: company } = await supabase
          .from('public_company' as any)
          .select('id, slug, business_type')
          .eq('id', companyData.company_id)
          .single();

        if (company) {
          const c = company as any;
          setDomainCompany({
            companyId: c.id,
            slug: c.slug,
            businessType: c.business_type,
          });
          setIsCustomDomain(true);
        }
      }
      setLoading(false);
    };

    checkDomain();
  }, []);

  return { domainCompany, isCustomDomain, loading };
};
