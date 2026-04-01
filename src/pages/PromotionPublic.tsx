import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Scissors, Clock, Calendar, Sparkles, ArrowRight } from 'lucide-react';
import { PlatformBranding } from '@/components/PlatformBranding';
import { getCompanyBranding, buildThemeFromBranding, useApplyBranding } from '@/hooks/useCompanyBranding';

interface PromotionData {
  id: string;
  company_id: string;
  title: string;
  description: string | null;
  slug: string;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  max_slots: number;
  used_slots: number;
  service_id: string | null;
  service_name: string | null;
  service_duration: number | null;
  promotion_price: number | null;
  original_price: number | null;
  professional_filter: string;
  professional_ids: string[] | null;
  created_by: string | null;
}

export default function PromotionPublic() {
  const { promoSlug, slug: companySlug } = useParams<{ promoSlug: string; slug?: string }>();
  const navigate = useNavigate();
  const [promo, setPromo] = useState<PromotionData | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const isDark = company?.business_type === 'barbershop';
  const branding = getCompanyBranding(companySettings, isDark);
  useApplyBranding(branding);
  const T = buildThemeFromBranding(branding, isDark);

  useEffect(() => {
    if (promoSlug) load();
  }, [promoSlug]);

  const load = async () => {
    setLoading(true);

    // Find promotion via public view
    const { data: promos } = await supabase
      .from('public_promotions' as any)
      .select('*')
      .eq('slug', promoSlug!)
      .limit(1);

    const promoData = (promos as any)?.[0];
    if (!promoData) { setLoading(false); return; }
    setPromo(promoData);

    // Track click
    await supabase.from('promotion_clicks' as any).insert({
      promotion_id: promoData.id,
      company_id: promoData.company_id,
    });

    // Get company
    const { data: comp } = await supabase.from('public_company' as any).select('*').eq('id', promoData.company_id).single();
    if (comp) setCompany(comp);

    // Get settings
    const { data: settings } = await supabase.from('public_company_settings' as any).select('*').eq('company_id', promoData.company_id).single();
    if (settings) setCompanySettings(settings);

    // Get professionals
    if (promoData.professional_ids?.length) {
      const { data: profs } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', promoData.company_id)
        .in('id', promoData.professional_ids);
      if (profs) setProfessionals(profs as any[]);
    } else {
      const { data: profs } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', promoData.company_id)
        .eq('active', true);
      if (profs) setProfessionals(profs as any[]);
    }

    setLoading(false);
  };

  const handleBooking = (profSlug?: string) => {
    const routeType = company?.business_type === 'esthetic' ? 'estetica' : 'barbearia';
    const slug = companySlug || company?.slug;
    if (profSlug) {
      navigate(`/${routeType}/${slug}/${profSlug}/agendar?promo=${promo?.id}`);
    } else {
      navigate(`/${routeType}/${slug}/agendar?promo=${promo?.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <p style={{ color: T.textSec }}>Carregando...</p>
      </div>
    );
  }

  if (!promo || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <div className="text-center">
          <h2 className="text-xl font-bold" style={{ color: T.text }}>Promoção não encontrada</h2>
          <p className="mt-2" style={{ color: T.textSec }}>Esta promoção pode ter expirado.</p>
        </div>
      </div>
    );
  }

  const remaining = promo.max_slots > 0 ? promo.max_slots - promo.used_slots : null;
  const isLow = remaining !== null && remaining > 0 && remaining <= 5;
  const isSoldOut = remaining !== null && remaining <= 0;

  return (
    <div className="min-h-screen" style={{ background: T.bg }}>
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Company header */}
        <div className="text-center">
          {company.logo_url && (
            <img src={company.logo_url} alt={company.name} className="w-16 h-16 rounded-full mx-auto mb-3 object-cover" />
          )}
          <p className="text-sm font-medium" style={{ color: T.textSec }}>{company.name}</p>
        </div>

        {/* Promo card */}
        <Card className="overflow-hidden border-0 shadow-xl" style={{ background: T.card }}>
          <div className="p-1" style={{ background: `linear-gradient(135deg, ${T.accent}, ${T.accentHover})` }} />
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" style={{ color: T.accent }} />
              <Badge style={{ background: T.accent, color: '#fff' }}>PROMOÇÃO</Badge>
            </div>

            <h1 className="text-2xl font-bold" style={{ color: T.text }}>{promo.title}</h1>

            {promo.description && (
              <p className="text-sm" style={{ color: T.textSec }}>{promo.description}</p>
            )}

            {/* Service & pricing */}
            {promo.service_name && (
              <div className="rounded-lg p-4" style={{ background: T.bg, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-2 mb-2">
                  <Scissors className="h-4 w-4" style={{ color: T.accent }} />
                  <span className="font-semibold" style={{ color: T.text }}>{promo.service_name}</span>
                </div>
                {promo.service_duration && (
                  <div className="flex items-center gap-1 text-xs mb-3" style={{ color: T.textSec }}>
                    <Clock className="h-3 w-3" />{promo.service_duration} min
                  </div>
                )}
                {promo.original_price && promo.promotion_price && (
                  <div className="flex items-center gap-3">
                    <span className="text-lg line-through" style={{ color: T.textSec }}>R$ {Number(promo.original_price).toFixed(2)}</span>
                    <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {Number(promo.promotion_price).toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Date range */}
            <div className="flex items-center gap-2 text-sm" style={{ color: T.textSec }}>
              <Calendar className="h-4 w-4" />
              <span>
                {format(parseISO(promo.start_date), "dd 'de' MMMM", { locale: ptBR })}
                {promo.start_date !== promo.end_date && ` até ${format(parseISO(promo.end_date), "dd 'de' MMMM", { locale: ptBR })}`}
              </span>
            </div>

            {promo.start_time && promo.end_time && (
              <div className="flex items-center gap-2 text-sm" style={{ color: T.textSec }}>
                <Clock className="h-4 w-4" />
                <span>{promo.start_time.slice(0, 5)} — {promo.end_time.slice(0, 5)}</span>
              </div>
            )}

            {/* Slots */}
            {remaining !== null && (
              <div className={`text-center py-2 rounded-lg font-semibold ${isSoldOut ? 'bg-destructive/10 text-destructive' : isLow ? 'bg-orange-500/10 text-orange-600' : ''}`}
                style={!isSoldOut && !isLow ? { color: T.accent } : undefined}>
                {isSoldOut ? '❌ Vagas esgotadas' : isLow ? `🔥 Últimas ${remaining} vagas!` : `${remaining} vagas disponíveis`}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Professionals */}
        {professionals.length > 0 && !isSoldOut && (
          <div className="space-y-3">
            <h3 className="font-semibold" style={{ color: T.text }}>Agendar com:</h3>
            {professionals.map((prof: any) => (
              <button
                key={prof.id}
                onClick={() => handleBooking(prof.slug)}
                className="w-full flex items-center gap-3 p-3 rounded-xl transition-colors"
                style={{ background: T.card, border: `1px solid ${T.border}` }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden" style={{ background: T.accent, color: '#fff' }}>
                  {prof.avatar_url ? (
                    <img src={prof.avatar_url} alt={prof.name} className="w-full h-full object-cover" />
                  ) : prof.name?.charAt(0)?.toUpperCase()}
                </div>
                <span className="flex-1 text-left font-medium" style={{ color: T.text }}>{prof.name}</span>
                <ArrowRight className="h-4 w-4" style={{ color: T.accent }} />
              </button>
            ))}
          </div>
        )}

        {/* Generic booking button */}
        {!isSoldOut && professionals.length === 0 && (
          <Button
            className="w-full h-12 text-lg font-semibold"
            style={{ background: T.accent, color: '#fff' }}
            onClick={() => handleBooking()}
          >
            Agendar Agora <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        )}

        <PlatformBranding />
      </div>
    </div>
  );
}
