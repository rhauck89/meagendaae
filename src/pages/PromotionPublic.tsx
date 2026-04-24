import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Página legada de promoção. Mantemos a rota apenas para compatibilidade
 * com links já compartilhados (WhatsApp, Instagram, etc) — agora apenas
 * resolve a promoção pelo slug e redireciona para o perfil público da
 * empresa com `?promo=ID`, deixando o card/UX no próprio perfil.
 */
export default function PromotionPublic() {
  const { promoSlug, slug: companySlug } = useParams<{ promoSlug: string; slug?: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!promoSlug) { navigate('/', { replace: true }); return; }

      let promoData: any = null;
      let companyRecord: any = null;

      if (companySlug) {
        const { data: comp } = await supabase
          .from('public_company' as any)
          .select('id, slug, business_type')
          .eq('slug', companySlug)
          .maybeSingle();
        companyRecord = comp;
        if (comp) {
          const { data: promos } = await supabase
            .from('public_promotions' as any)
            .select('id, company_id')
            .eq('company_id', (comp as any).id)
            .eq('slug', promoSlug)
            .limit(1);
          promoData = (promos as any)?.[0];
        }
      } else {
        const { data: promos } = await supabase
          .from('public_promotions' as any)
          .select('id, company_id')
          .eq('slug', promoSlug)
          .limit(1);
        promoData = (promos as any)?.[0];
        if (promoData) {
          const { data: comp } = await supabase
            .from('public_company' as any)
            .select('id, slug, business_type')
            .eq('id', promoData.company_id)
            .maybeSingle();
          companyRecord = comp;
        }
      }

      if (cancelled) return;

      if (!promoData || !companyRecord) {
        navigate('/', { replace: true });
        return;
      }

      // Track click (best-effort)
      supabase.from('promotion_clicks' as any).insert({
        promotion_id: promoData.id,
        company_id: promoData.company_id,
      }).then(() => {});

      const routeType = companyRecord.business_type === 'esthetic' ? 'estetica' : 'barbearia';
      navigate(`/${routeType}/${companyRecord.slug}?promo=${promoData.id}`, { replace: true });
    })();
    return () => { cancelled = true; };
  }, [promoSlug, companySlug, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-sm text-muted-foreground">Abrindo promoção…</p>
    </div>
  );
}
