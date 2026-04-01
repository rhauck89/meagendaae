import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PLATFORM_DOMAIN = 'agendapro.com';
const PLATFORM_HOSTS = [
  'localhost',
  '127.0.0.1',
  'lovable.app',
  `dashboard.${PLATFORM_DOMAIN}`,
];

interface TenantContext {
  companyId: string;
  slug: string;
  businessType: string;
  source: 'subdomain' | 'custom_domain';
}

export const useDomainRouting = () => {
  const [tenant, setTenant] = useState<TenantContext | null>(null);
  const [isDashboard, setIsDashboard] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const resolveTenant = async () => {
      const hostname = window.location.hostname;

      // 1) Dashboard domain — skip tenant resolution
      if (hostname === `dashboard.${PLATFORM_DOMAIN}`) {
        setIsDashboard(true);
        setLoading(false);
        return;
      }

      // 2) Known platform / dev hosts — use path-based routing
      if (PLATFORM_HOSTS.some((h) => hostname === h || hostname.includes('lovable.app'))) {
        setLoading(false);
        return;
      }

      // 3) Try custom domain first (verified only)
      const { data: domainRecord } = await supabase
        .from('company_domains')
        .select('company_id')
        .eq('domain', hostname)
        .eq('verified', true)
        .single();

      if (domainRecord) {
        const company = await fetchCompanyById(domainRecord.company_id);
        if (company) {
          setTenant({ ...company, source: 'custom_domain' });
          setLoading(false);
          return;
        }
      }

      // 4) Try subdomain of platform domain (e.g. hckbarber.agendapro.com)
      if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
        const slug = hostname.replace(`.${PLATFORM_DOMAIN}`, '');
        // Ignore known subdomains like "dashboard", "www", "api"
        if (['dashboard', 'www', 'api', 'app'].includes(slug)) {
          setLoading(false);
          return;
        }

        const { data: company } = await supabase
          .from('public_company' as any)
          .select('id, slug, business_type')
          .eq('slug', slug)
          .single();

        if (company) {
          const c = company as any;
          setTenant({
            companyId: c.id,
            slug: c.slug,
            businessType: c.business_type,
            source: 'subdomain',
          });
        }
      }

      setLoading(false);
    };

    resolveTenant();
  }, []);

  return {
    tenant,
    isTenantResolved: !!tenant,
    isDashboard,
    loading,
    // Legacy compatibility
    domainCompany: tenant
      ? { companyId: tenant.companyId, slug: tenant.slug, businessType: tenant.businessType }
      : null,
    isCustomDomain: tenant?.source === 'custom_domain' || tenant?.source === 'subdomain',
  };
};

async function fetchCompanyById(companyId: string) {
  const { data } = await supabase
    .from('public_company' as any)
    .select('id, slug, business_type')
    .eq('id', companyId)
    .single();

  if (!data) return null;
  const c = data as any;
  return {
    companyId: c.id,
    slug: c.slug,
    businessType: c.business_type,
  };
}
