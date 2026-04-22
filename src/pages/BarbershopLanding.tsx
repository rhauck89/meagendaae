import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Calendar, Clock, Scissors, Sparkles, Users, Instagram, Facebook, Globe, ExternalLink, RotateCcw, X } from 'lucide-react';
import { LocationBlock } from '@/components/LocationBlock';
import { SEOHead, buildLocalBusinessJsonLd } from '@/components/SEOHead';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PlatformBranding } from '@/components/PlatformBranding';
import { getCompanyBranding, buildThemeFromBranding, useApplyBranding } from '@/hooks/useCompanyBranding';
import { useCompanyAmenities } from '@/hooks/useCompanyAmenities';
import { AmenitiesDisplay } from '@/components/AmenitiesDisplay';

type BusinessType = 'barbershop' | 'esthetic';

interface BarbershopLandingProps {
  routeBusinessType?: BusinessType;
  customSlug?: string;
}

const formatReviewerName = (name: string): string => {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
};

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((s) => {
      const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
      return (
        <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
          <defs>
            <linearGradient id={`land-star-${s}-${size}`}>
              <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
              <stop offset={`${fill * 100}%`} stopColor="#374151" />
            </linearGradient>
          </defs>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#land-star-${s}-${size})`} />
        </svg>
      );
    })}
  </div>
);

export default function BarbershopLanding({ routeBusinessType, customSlug }: BarbershopLandingProps) {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = customSlug || paramSlug;
  const navigate = useNavigate();

  const [company, setCompany] = useState<any>(null);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [companyStats, setCompanyStats] = useState<{ avgRating: number; reviewCount: number } | null>(null);
  const [professionalRatings, setProfessionalRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [galleryImages, setGalleryImages] = useState<any[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [allReviewsList, setAllReviewsList] = useState<any[]>([]);
  const [companyEvents, setCompanyEvents] = useState<any[]>([]);
  const [companyPromotions, setCompanyPromotions] = useState<any[]>([]);
  const [isWhitelabel, setIsWhitelabel] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    serviceIds: string[]; serviceNames: string[]; serviceDurations: number[];
    professionalId: string; professionalName: string; professionalAvatar: string | null;
    totalPrice: number; totalDuration: number; bookedAt: string;
  } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);

  // Detect logged-in user
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  // Load last booking for smart rebooking on landing
  useEffect(() => {
    if (!company?.id) return;
    try {
      const dismissed = localStorage.getItem(`rebook_dismissed_${company.id}`) === '1';
      setRebookDismissed(dismissed);
    } catch { /* ignore */ }

    if (!isLoggedIn) {
      // Fallback to localStorage for non-logged-in
      try {
        const stored = localStorage.getItem(`last_booking_${company.id}`);
        if (stored) setLastBooking(JSON.parse(stored));
      } catch { /* ignore */ }
      return;
    }

    // Logged-in: load real last appointment from DB
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', user.id)
          .eq('company_id', company.id)
          .maybeSingle();
        if (!profile?.id) {
          // fallback to localStorage
          const stored = localStorage.getItem(`last_booking_${company.id}`);
          if (stored) setLastBooking(JSON.parse(stored));
          return;
        }
        const { data: appt } = await supabase
          .from('appointments')
          .select('id, start_time, total_price, professional_id')
          .eq('company_id', company.id)
          .eq('client_id', profile.id)
          .in('status', ['completed', 'confirmed', 'pending'])
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!appt) {
          const stored = localStorage.getItem(`last_booking_${company.id}`);
          if (stored) setLastBooking(JSON.parse(stored));
          return;
        }
        const [{ data: apptSvcs }, { data: prof }] = await Promise.all([
          supabase.from('appointment_services').select('service_id, duration_minutes, price').eq('appointment_id', appt.id),
          supabase.from('public_professionals' as any).select('id, name, avatar_url').eq('id', appt.professional_id).maybeSingle(),
        ]);
        const svcIds = (apptSvcs || []).map((s: any) => s.service_id);
        let svcNames: string[] = [];
        if (svcIds.length) {
          const { data: svcs } = await supabase.from('public_services' as any).select('id, name').in('id', svcIds);
          svcNames = svcIds.map((id: string) => (svcs as any[])?.find((s: any) => s.id === id)?.name).filter(Boolean);
        }
        const totalDuration = (apptSvcs || []).reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
        setLastBooking({
          serviceIds: svcIds,
          serviceNames: svcNames,
          serviceDurations: (apptSvcs || []).map((s: any) => s.duration_minutes),
          professionalId: appt.professional_id,
          professionalName: (prof as any)?.name || 'Profissional',
          professionalAvatar: (prof as any)?.avatar_url || null,
          totalPrice: Number(appt.total_price || 0),
          totalDuration,
          bookedAt: appt.start_time,
        });
      } catch { /* ignore */ }
    })();
  }, [company?.id, isLoggedIn]);

  const handleDismissRebook = () => {
    if (!company?.id) return;
    try { localStorage.setItem(`rebook_dismissed_${company.id}`, '1'); } catch { /* ignore */ }
    setRebookDismissed(true);
  };

  const isDark = businessType === 'barbershop';

  const branding = getCompanyBranding(companySettings, isDark);
  useApplyBranding(branding);
  const T = buildThemeFromBranding(branding, isDark);

  useEffect(() => { if (slug) load(); }, [slug]);

  const load = async () => {
    setLoading(true);
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const rpcComp = compArr?.[0];
    if (!rpcComp) { setLoading(false); return; }

    // Fetch full company data from public_company view for address/cover fields
    const { data: fullCompanyData } = await supabase.from('public_company' as any).select('*').eq('id', rpcComp.id).single();
    const comp = { ...rpcComp, ...((fullCompanyData as any) || {}) };
    setCompany(comp);
    const resolvedType: BusinessType = routeBusinessType || comp.business_type || 'barbershop';
    setBusinessType(resolvedType);

    // Check whitelabel via company plan (best-effort, may fail without auth)
    try {
      const { data: compPlan } = await supabase
        .from('companies')
        .select('plan_id')
        .eq('id', comp.id)
        .single();
      if (compPlan?.plan_id) {
        const { data: planData } = await supabase.from('plans').select('whitelabel').eq('id', compPlan.plan_id).single();
        if (planData?.whitelabel) setIsWhitelabel(true);
      }
    } catch { /* ignore - will show platform branding by default */ }

    const [servicesRes, profsRes, ratingsRes, reviewsRes, settingsRes, galleryRes, eventsRes, promosRes] = await Promise.all([
      supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
      supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('active', true),
      supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id }),
      supabase.from('reviews').select('rating, comment, created_at, professional_id, appointment_id').eq('company_id', comp.id).order('created_at', { ascending: false }),
      supabase.from('public_company_settings' as any).select('*').eq('company_id', comp.id).single(),
      supabase.from('company_gallery' as any).select('*').eq('company_id', comp.id).order('sort_order'),
      supabase.from('events' as any).select('*').eq('company_id', comp.id).eq('status', 'published').order('start_date') as any,
      supabase.from('public_promotions' as any).select('*').eq('company_id', comp.id).order('start_date') as any,
    ]);

    if (servicesRes.data) setServices(servicesRes.data as any[]);
    if (profsRes.data) setProfessionals(profsRes.data as any[]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    if (galleryRes.data) setGalleryImages(galleryRes.data as any[]);
    
    // Load events with slot stats
    if (eventsRes.data) {
      const eventsList = eventsRes.data as any[];
      if (eventsList.length > 0) {
        const eventIds = eventsList.map((e: any) => e.id);
        const { data: slotsData } = await supabase
          .from('event_slots')
          .select('event_id, max_bookings, current_bookings')
          .in('event_id', eventIds);
        
        const statsMap: Record<string, { total: number; booked: number }> = {};
        (slotsData || []).forEach((s: any) => {
          if (!statsMap[s.event_id]) statsMap[s.event_id] = { total: 0, booked: 0 };
          statsMap[s.event_id].total += s.max_bookings;
          statsMap[s.event_id].booked += s.current_bookings;
        });
        
        const enriched = eventsList.map((evt: any) => ({
          ...evt,
          _remaining: statsMap[evt.id] ? statsMap[evt.id].total - statsMap[evt.id].booked : 0,
          _total: statsMap[evt.id]?.total || 0,
        }));
        setCompanyEvents(enriched);
      } else {
        setCompanyEvents([]);
      }
    }

    // Load promotions
    if (promosRes.data) {
      setCompanyPromotions(promosRes.data as any[]);
    }

    // Ratings map
    if (ratingsRes.data && Array.isArray(ratingsRes.data)) {
      const map: Record<string, { avg: number; count: number }> = {};
      for (const r of ratingsRes.data as any[]) {
        map[r.professional_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
      }
      setProfessionalRatings(map);
    }

    // Enrich reviews with client names from appointments
    let enrichedReviews: any[] = [];
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const appointmentIds = reviewsRes.data
        .filter((r: any) => r.appointment_id)
        .map((r: any) => r.appointment_id);
      
      let clientNameMap: Record<string, string> = {};
      if (appointmentIds.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, client_name, client_id')
          .in('id', appointmentIds);
        
        if (appts) {
          // Get client names from clients table for those with client_id
          const clientIds = appts.filter((a: any) => a.client_id).map((a: any) => a.client_id);
          let clientNames: Record<string, string> = {};
          if (clientIds.length > 0) {
            const { data: clients } = await supabase
              .from('clients')
              .select('id, name')
              .in('id', clientIds);
            if (clients) {
              for (const c of clients) {
                clientNames[c.id] = c.name;
              }
            }
          }
          
          for (const a of appts) {
            const name = a.client_name || clientNames[a.client_id] || null;
            if (name) clientNameMap[a.id] = name;
          }
        }
      }
      
      enrichedReviews = reviewsRes.data.map((r: any) => ({
        ...r,
        client_display_name: r.appointment_id && clientNameMap[r.appointment_id]
          ? formatReviewerName(clientNameMap[r.appointment_id])
          : null,
      }));
    }

    // Company-level stats
    const revs = enrichedReviews;
    if (revs.length > 0) {
      const avg = revs.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / revs.length;
      setCompanyStats({ avgRating: avg, reviewCount: revs.length });
    }

    setAllReviewsList(enrichedReviews);
    setReviews(enrichedReviews.slice(0, 3));
    setLoading(false);
  };

    const bookingBasePath = businessType === 'esthetic' ? 'estetica' : 'barbearia';
    const companyWhatsapp = company?.whatsapp ? formatWhatsApp(company.whatsapp) : (company?.phone ? formatWhatsApp(company.phone) : null);
    const fullAddress = [company?.address, company?.address_number, company?.district, company?.city, company?.state].filter(Boolean).join(', ');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full" style={{ background: isDark ? '#1F2937' : '#FED7AA' }} />
          <div className="h-4 w-48 rounded" style={{ background: isDark ? '#1F2937' : '#FED7AA' }} />
        </div>
      </div>
    );
  }

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <p className="text-lg" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Empresa não encontrada.</p>
      </div>
    );
  }

  const seoTitle = `${company.name} | ${businessType === 'esthetic' ? 'Estética' : 'Barbearia'} em ${company.city || ''} ${company.state || ''}`.trim();
  const seoDescription = `Agende seu horário na ${company.name}. ${businessType === 'esthetic' ? 'Estética' : 'Barbearia'} em ${company.city || ''} ${company.state || ''} com profissionais e agendamento online.`.trim();

  return (
    <div className="min-h-screen" style={{ background: isDark ? T.bg : T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={company.cover_url || company.logo_url}
        canonical={`${window.location.origin}/barbearia/${slug}`}
        jsonLd={buildLocalBusinessJsonLd(company)}
      />
      {/* 1) Cover Image */}
      {company.cover_url && (
        <div className="w-full h-44 sm:h-56 overflow-hidden">
          <img src={company.cover_url} alt={company.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* 2) Logo + 3) Company Name + 4) Rating */}
      <div className="max-w-lg mx-auto px-4 flex flex-col items-center gap-4" style={{ paddingTop: company.cover_url ? '1rem' : '2rem' }}>
        {/* Logo */}
        {company.logo_url && (
          <div style={{ marginTop: company.cover_url ? '-2.5rem' : '0' }}>
            <img
              src={company.logo_url}
              alt={company.name}
              className="max-h-[72px] max-w-[180px] object-contain drop-shadow-lg"
              style={{ background: isDark ? 'rgba(17,24,39,0.8)' : 'rgba(255,255,255,0.8)', borderRadius: '12px', padding: '8px' }}
            />
          </div>
        )}

        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>{company.name}</h1>
          {company.description && (
            <p className="text-sm mt-2 leading-relaxed max-w-sm" style={{ color: T.textSec }}>{company.description}</p>
          )}
        </div>

        {/* Rating Summary */}
        {companyStats && companyStats.reviewCount > 0 && (
          <div className="flex items-center gap-2">
            <StarRating rating={companyStats.avgRating} size={16} />
            <span className="text-sm font-semibold" style={{ color: '#FDBA2D' }}>{companyStats.avgRating.toFixed(1)}</span>
            <span className="text-xs" style={{ color: T.textSec }}>({companyStats.reviewCount} avaliações)</span>
          </div>
        )}

        {/* Amenities - above action buttons */}
        {companyAmenities.length > 0 && (
          <AmenitiesDisplay amenities={companyAmenities} theme={T} />
        )}

        {/* 5) Primary Buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3 mt-2">
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="w-full h-12 text-base font-semibold rounded-xl shadow-lg transition-all hover:scale-105"
            style={{ background: T.accent, color: '#0B132B' }}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Agendar horário
          </Button>

          {companyWhatsapp && (
            <a
              href={buildWhatsAppUrl(companyWhatsapp, `Olá! Vi a página da ${company.name} e gostaria de mais informações.`)}
              onClick={() => trackWhatsAppClick('landingpage')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: '#25D366',
                background: isDark ? 'rgba(37,211,102,0.1)' : 'rgba(37,211,102,0.08)',
                color: '#25D366',
              }}
            >
              <MessageCircle className="w-4 h-4" />
              Chamar no WhatsApp
            </a>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-8">
        {/* Smart Rebooking Block — only for logged-in users with history */}
        {isLoggedIn && lastBooking && !rebookDismissed && (() => {
          const daysSince = Math.floor((Date.now() - new Date(lastBooking.bookedAt).getTime()) / (1000 * 60 * 60 * 24));
          const formattedDate = format(new Date(lastBooking.bookedAt), "d 'de' MMMM 'de' yyyy", { locale: ptBR });
          return (
            <section className="rounded-2xl p-5 space-y-4" style={{ background: `${T.accent}10`, border: `1.5px solid ${T.accent}40` }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5" style={{ color: T.accent }} />
                  <span className="font-bold text-base" style={{ color: T.text }}>Seu último atendimento</span>
                </div>
                <button
                  onClick={handleDismissRebook}
                  className="p-1 rounded-full hover:opacity-70"
                  style={{ color: T.textSec }}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {daysSince >= 14 && (
                <p className="text-sm font-medium" style={{ color: T.accent }}>
                  👀 Está na hora de agendar novamente — faz {daysSince} dias!
                </p>
              )}
              <div className="flex items-center gap-4 p-3 rounded-xl" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                {lastBooking.professionalAvatar ? (
                  <img src={lastBooking.professionalAvatar} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0" style={{ background: `${T.accent}20`, color: T.accent }}>
                    {lastBooking.professionalName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate" style={{ color: T.text }}>{lastBooking.serviceNames.join(', ')}</p>
                  <p className="text-xs mt-0.5" style={{ color: T.textSec }}>
                    <Clock className="h-3 w-3 inline mr-1" />{lastBooking.totalDuration} min • com {lastBooking.professionalName}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: T.textSec }}>
                    <Calendar className="h-3 w-3 inline mr-1" />{formattedDate}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Button
                  onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar?rebook=1`)}
                  className="w-full rounded-xl py-5 font-semibold text-base"
                  style={{ background: T.accent, color: '#000' }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" /> Repetir atendimento
                </Button>
                <button
                  onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
                  className="w-full py-2 text-sm font-medium rounded-xl hover:opacity-80"
                  style={{ color: T.textSec }}
                >
                  Ver outros serviços
                </button>
              </div>
            </section>
          );
        })()}

        {/* 6) Team Section */}
        {professionals.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Nossa Equipe</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {professionals.map((p: any) => {
                const rating = professionalRatings[p.id];
                return (
                  <div
                    key={p.id}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl transition-all hover:scale-[1.02]"
                    style={{ background: T.card, border: `1px solid ${T.border}` }}
                  >
                    {p.avatar_url ? (
                      <img src={p.avatar_url} alt={p.name} className="w-16 h-16 rounded-full object-cover" style={{ border: `2px solid ${T.accent}` }} />
                    ) : (
                      <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                        {p.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-center truncate w-full" style={{ color: T.text }}>{p.name}</p>
                    {rating && rating.count > 0 && (
                      <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium" style={{ color: '#FDBA2D' }}>{rating.avg.toFixed(1)}</span>
                      </div>
                    )}
                    <Button
                      onClick={() => {
                        if (p.slug) {
                          navigate(`/${bookingBasePath}/${slug}/${p.slug}/agendar`);
                        } else {
                          navigate(`/${bookingBasePath}/${slug}/agendar`);
                        }
                      }}
                      className="w-full h-8 text-xs font-medium rounded-lg"
                      style={{ background: `${T.accent}20`, color: T.accent }}
                    >
                      Ver agenda
                    </Button>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* 7) Services List */}
        {services.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              {isDark ? <Scissors className="w-5 h-5" style={{ color: T.accent }} /> : <Sparkles className="w-5 h-5" style={{ color: T.accent }} />}
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Serviços</h2>
            </div>
            <div className="flex flex-col gap-2">
              {services.map((svc: any) => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: T.text }}>{svc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: T.textSec }} />
                      <span className="text-xs" style={{ color: T.textSec }}>{svc.duration_minutes}min</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: T.accent }}>
                    R$ {Number(svc.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 8) Reviews */}
        {reviews.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5" style={{ color: '#FDBA2D' }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Avaliações</h2>
              {companyStats && (
                <span className="text-xs ml-auto" style={{ color: T.textSec }}>
                  {companyStats.reviewCount} avaliações
                </span>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {(showAllReviews ? allReviewsList : reviews).map((rev: any, i: number) => (
                <div
                  key={i}
                  className="p-4 rounded-xl"
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {rev.client_display_name && (
                        <span className="text-sm font-semibold" style={{ color: T.text }}>
                          {rev.client_display_name}
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                        ))}
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: T.textSec }}>
                      {format(new Date(rev.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="text-sm leading-relaxed" style={{ color: isDark ? '#D1D5DB' : '#4B5563' }}>
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
            {allReviewsList.length > 3 && !showAllReviews && (
              <button
                onClick={() => setShowAllReviews(true)}
                className="w-full mt-3 py-2 text-sm font-medium rounded-xl transition-colors"
                style={{ color: T.accent, background: `${T.accent}15`, border: `1px solid ${T.accent}30` }}
              >
                Ver todas as {allReviewsList.length} avaliações
              </button>
            )}
            {showAllReviews && allReviewsList.length > 3 && (
              <button
                onClick={() => setShowAllReviews(false)}
                className="w-full mt-3 py-2 text-sm font-medium rounded-xl transition-colors"
                style={{ color: T.textSec }}
              >
                Mostrar menos
              </button>
            )}
          </section>
        )}


        {/* Agenda Aberta */}
        {companyEvents.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Agenda Aberta</h2>
            </div>
            <div className="space-y-3">
              {companyEvents.map((evt: any) => {
                const remaining = evt._remaining ?? 0;
                const total = evt._total ?? 0;
                const isLow = remaining > 0 && remaining <= 5;
                return (
                  <button
                    key={evt.id}
                    onClick={() => navigate(`/evento/${evt.slug}`)}
                    className="w-full rounded-xl overflow-hidden text-left transition-transform hover:scale-[1.02]"
                    style={{ background: T.card, border: `1px solid ${T.border}` }}
                  >
                    {evt.cover_image && (
                      <div className="h-32 overflow-hidden">
                        <img src={evt.cover_image} alt={evt.name} className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold" style={{ color: T.text }}>{evt.name}</p>
                      <p className="text-sm mt-1" style={{ color: T.textSec }}>
                        📅 {format(parseISO(evt.start_date), "dd/MM/yyyy", { locale: ptBR })}
                        {evt.start_date !== evt.end_date && ` - ${format(parseISO(evt.end_date), "dd/MM/yyyy", { locale: ptBR })}`}
                      </p>
                      {evt.description && <p className="text-sm mt-1 line-clamp-2" style={{ color: T.textSec }}>{evt.description}</p>}
                      {total > 0 && (
                        <p className={cn('text-sm font-semibold mt-2', 
                          remaining === 0 ? 'text-destructive' : isLow ? 'text-orange-500' : ''
                        )} style={remaining > 5 ? { color: T.accent } : undefined}>
                          {remaining === 0 ? '❌ Esgotado' :
                           isLow ? `🔥 Últimas ${remaining} vagas` :
                           `${remaining} vagas disponíveis`}
                        </p>
                      )}
                      <span className="inline-block mt-2 text-sm font-semibold" style={{ color: T.accent }}>Ver horários →</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Promoções */}
        {companyPromotions.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Promoções</h2>
            </div>
            <div className="space-y-3">
              {companyPromotions.map((promo: any) => {
                const remaining = promo.max_slots > 0 ? promo.max_slots - promo.used_slots : null;
                const isLow = remaining !== null && remaining > 0 && remaining <= 5;
                const isSoldOut = remaining !== null && remaining === 0;
                return (
                  <div
                    key={promo.id}
                    className={cn(
                      "rounded-xl p-4 transition-all duration-200",
                      isSoldOut ? "opacity-60" : "cursor-pointer hover:scale-[1.02]"
                    )}
                    style={{
                      background: T.card,
                      border: `1px solid ${T.border}`,
                    }}
                    onMouseEnter={e => { if (!isSoldOut) e.currentTarget.style.borderColor = `${T.accent}60`; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = T.border; }}
                    onClick={() => {
                      if (isSoldOut) return;
                      navigate(`/${bookingBasePath}/${slug}/agendar?promo=${promo.id}`);
                    }}
                  >
                    <p className="font-bold" style={{ color: T.text }}>{promo.title}</p>
                    {promo.description && (
                      <p className="text-sm mt-1 line-clamp-2" style={{ color: T.textSec }}>{promo.description}</p>
                    )}
                    <p className="text-sm mt-1" style={{ color: T.textSec }}>
                      📅 {format(parseISO(promo.start_date), "dd/MM/yyyy", { locale: ptBR })}
                      {promo.start_date !== promo.end_date && ` - ${format(parseISO(promo.end_date), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                    {promo.start_time && promo.end_time && (
                      <p className="text-sm" style={{ color: T.textSec }}>
                        ⏰ {promo.start_time.slice(0, 5)} - {promo.end_time.slice(0, 5)}
                      </p>
                    )}
                    {remaining !== null && (
                      <p className={cn('text-sm font-semibold mt-2',
                        isSoldOut ? 'text-destructive' : isLow ? 'text-orange-500' : ''
                      )} style={!isSoldOut && !isLow ? { color: T.accent } : undefined}>
                        {isSoldOut ? '❌ Esgotado' :
                         isLow ? `🔥 Últimas ${remaining} vagas` :
                         `${remaining} vagas disponíveis`}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <LocationBlock company={company} isDark={isDark} />

        {/* Social Links */}
        {(company.instagram || company.facebook || company.website) && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Redes Sociais</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              {company.instagram && (
                <a
                  href={company.instagram.startsWith('http') ? company.instagram : `https://instagram.com/${company.instagram.replace('@', '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <Instagram className="w-4 h-4" style={{ color: '#E1306C' }} />
                  Instagram
                </a>
              )}
              {company.facebook && (
                <a
                  href={company.facebook.startsWith('http') ? company.facebook : `https://facebook.com/${company.facebook}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <Facebook className="w-4 h-4" style={{ color: '#1877F2' }} />
                  Facebook
                </a>
              )}
              {company.website && (
                <a
                  href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
                >
                  <Globe className="w-4 h-4" style={{ color: T.accent }} />
                  Website
                </a>
              )}
            </div>
          </section>
        )}

        {/* 10) Photo Gallery */}
        {galleryImages.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-5 h-5" style={{ color: T.accent }} />
              <h2 className="text-lg font-bold" style={{ color: T.text }}>Galeria</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {galleryImages.slice(0, 8).map((img: any, i: number) => (
                <div key={img.id || i} className="rounded-xl overflow-hidden aspect-square">
                  <img src={img.image_url} alt={img.caption || 'Galeria'} className="w-full h-full object-cover" />
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Footer */}
        <div className="flex flex-col items-center gap-3 pt-4">
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="w-full max-w-xs h-12 text-base font-semibold rounded-xl shadow-lg"
            style={{ background: T.accent, color: '#0B132B' }}
          >
            <Calendar className="w-5 h-5 mr-2" />
            Agendar horário
          </Button>

          <div className="flex flex-col items-center gap-2 mt-4">
            {company.logo_url ? (
              <img src={company.logo_url} alt={company.name} className="max-h-[40px] object-contain" />
            ) : (
              <p className="text-xs font-medium" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>{company.name}</p>
            )}
            <PlatformBranding isDark={isDark} hide={isWhitelabel} />
          </div>
        </div>
      </div>

      {/* Floating WhatsApp */}
      {companyWhatsapp && (
        <a
          href={buildWhatsAppUrl(companyWhatsapp)}
          onClick={() => trackWhatsAppClick('landingpage')}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 w-14 h-14 rounded-full flex items-center justify-center shadow-xl z-50 transition-transform hover:scale-110"
          style={{ background: '#25D366' }}
        >
          <MessageCircle className="w-7 h-7 text-white" />
        </a>
      )}
    </div>
  );
}
