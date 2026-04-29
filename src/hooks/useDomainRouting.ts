import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const PLATFORM_DOMAIN = 'meagendae.com.br';
const PLATFORM_HOSTS = [
  'localhost',
  '127.0.0.1',
  'lovable.app',
  PLATFORM_DOMAIN,
  `www.${PLATFORM_DOMAIN}`,
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
      // Safety timeout to never leave the app stuck in "Carregando..."
      const timeoutId = setTimeout(() => {
        if (loading) {
          console.warn('[DOMAIN_ROUTING] Resolution timeout reached, falling back to platform');
          setLoading(false);
        }
      }, 5000);

      try {
        const hostname = window.location.hostname;
        console.log('[DOMAIN_ROUTING] Resolving for:', hostname);

        // 1) Dashboard domain — skip tenant resolution
        if (hostname === `dashboard.${PLATFORM_DOMAIN}`) {
          setIsDashboard(true);
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // 2) Known platform / dev hosts — use path-based routing
        if (PLATFORM_HOSTS.some((h) => hostname === h || hostname.includes('lovable.app') || hostname.includes('lovableproject.com'))) {
          console.log('[DOMAIN_ROUTING] Platform/Dev host detected');
          setLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // 3) Try custom domain first (verified only)
        const { data: domainRecord, error: domainError } = await supabase
          .from('company_domains')
          .select('company_id')
          .eq('domain', hostname)
          .eq('verified', true)
          .maybeSingle();

        if (domainError) {
          console.error('[DOMAIN_ROUTING] Error fetching domain:', domainError);
        }

        if (domainRecord) {
          const company = await fetchCompanyById(domainRecord.company_id);
          if (company) {
            setTenant({ ...company, source: 'custom_domain' });
            setLoading(false);
            clearTimeout(timeoutId);
            return;
          }
        }

        // 4) Try subdomain of platform domain (e.g. hckbarber.meagendae.com.br)
        if (hostname.endsWith(`.${PLATFORM_DOMAIN}`)) {
          const slug = hostname.replace(`.${PLATFORM_DOMAIN}`, '');
          // Ignore known subdomains
          if (['dashboard', 'www', 'api', 'app', 'static', 'admin'].includes(slug)) {
            setLoading(false);
            clearTimeout(timeoutId);
            return;
          }

          const { data: company } = await supabase
            .from('public_company' as any)
            .select('id, slug, business_type')
            .eq('slug', slug)
            .maybeSingle();

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
      } catch (err) {
        console.error('[DOMAIN_ROUTING] Critical error in resolution:', err);
      } finally {
        setLoading(false);
        clearTimeout(timeoutId);
      }
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
