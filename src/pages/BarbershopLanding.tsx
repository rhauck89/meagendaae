import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Calendar, Clock, Scissors, Sparkles, Users, Instagram, Facebook, Globe, ExternalLink, RotateCcw, X, Share2, ChevronRight, Map, ArrowLeft, Heart, Wifi, Car, Coffee, Snowflake, CreditCard, Home, Crown, BadgeCheck, Navigation } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
import { motion, useScroll, useTransform } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from 'sonner';

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
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [allReviewsList, setAllReviewsList] = useState<any[]>([]);
  const [isWhitelabel, setIsWhitelabel] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    serviceIds: string[]; serviceNames: string[]; serviceDurations: number[];
    professionalId: string; professionalName: string; professionalAvatar: string | null;
    totalPrice: number; totalDuration: number; bookedAt: string;
  } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

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
      try {
        const stored = localStorage.getItem(`last_booking_${company.id}`);
        if (stored) setLastBooking(JSON.parse(stored));
      } catch { /* ignore */ }
      return;
    }

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
          const stored = localStorage.getItem(`last_booking_${company.id}`);
          if (stored) setLastBooking(JSON.parse(stored));
          return;
        }
        const { data: appt } = await supabase
          .from('appointments')
          .select('id, start_time, total_price, professional_id')
          .eq('company_id', company.id)
          .eq('user_id', user.id)
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

    const { data: fullCompanyData } = await supabase.from('public_company' as any).select('*').eq('id', rpcComp.id).single();
    const comp = { ...rpcComp, ...((fullCompanyData as any) || {}) };
    setCompany(comp);
    const resolvedType: BusinessType = routeBusinessType || comp.business_type || 'barbershop';
    setBusinessType(resolvedType);

    try {
      const { data: compPlan } = await supabase.from('companies').select('plan_id').eq('id', comp.id).single();
      if (compPlan?.plan_id) {
        const { data: planData } = await supabase.from('plans').select('whitelabel').eq('id', compPlan.plan_id).single();
        if (planData?.whitelabel) setIsWhitelabel(true);
      }
    } catch { /* ignore */ }

    const [servicesRes, profsRes, ratingsRes, reviewsRes, settingsRes] = await Promise.all([
      supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
      supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('active', true),
      supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id }),
      supabase.from('reviews').select('rating, comment, created_at, professional_id, appointment_id, review_type').eq('company_id', comp.id).order('created_at', { ascending: false }),
      supabase.from('public_company_settings' as any).select('*').eq('company_id', comp.id).single(),
    ]);

    if (servicesRes.data) setServices(servicesRes.data as any[]);
    if (profsRes.data) setProfessionals(profsRes.data as any[]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    
    if (ratingsRes.data && Array.isArray(ratingsRes.data)) {
      const map: Record<string, { avg: number; count: number }> = {};
      for (const r of ratingsRes.data as any[]) {
        map[r.professional_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
      }
      setProfessionalRatings(map);
    }

    let enrichedReviews: any[] = [];
    if (reviewsRes.data && reviewsRes.data.length > 0) {
      const appointmentIds = reviewsRes.data.filter((r: any) => r.appointment_id).map((r: any) => r.appointment_id);
      let clientNameMap: Record<string, string> = {};
      if (appointmentIds.length > 0) {
        const { data: appts } = await supabase.from('appointments').select('id, client_name, client_id').in('id', appointmentIds);
        if (appts) {
          const clientIds = appts.filter((a: any) => a.client_id).map((a: any) => a.client_id);
          let clientNames: Record<string, string> = {};
          if (clientIds.length > 0) {
            const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
            if (clients) for (const c of clients) clientNames[c.id] = c.name;
          }
          for (const a of appts) {
            const name = a.client_name || clientNames[a.client_id] || null;
            if (name) clientNameMap[a.id] = name;
          }
        }
      }
      enrichedReviews = reviewsRes.data.map((r: any) => ({
        ...r,
        client_display_name: r.appointment_id && clientNameMap[r.appointment_id] ? formatReviewerName(clientNameMap[r.appointment_id]) : null,
      }));
    }

    const companyReviews = enrichedReviews.filter((r: any) => r.review_type === 'company');
    if (companyReviews.length > 0) {
      const avg = companyReviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / companyReviews.length;
      setCompanyStats({ avgRating: avg, reviewCount: companyReviews.length });
    } else {
      setCompanyStats({ avgRating: 0, reviewCount: 0 });
    }

    setAllReviewsList(companyReviews);
    setReviews(companyReviews.slice(0, 3));
    setLoading(false);
  };

  const bookingBasePath = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  const companyWhatsapp = company?.whatsapp ? formatWhatsApp(company.whatsapp) : (company?.phone ? formatWhatsApp(company.phone) : null);
  const fullAddress = [company?.address, company?.address_number, company?.district, company?.city, company?.state].filter(Boolean).join(', ');
  const shareUrl = `${window.location.origin}/${bookingBasePath}/${slug}`;

  const groupedServices = useMemo(() => {
    const groups: Record<string, any[]> = {
      '✂️ Cortes': [],
      '🧔 Barba': [],
      '💆 Estética': [],
      '👑 Premium': [],
      'Outros': []
    };
    
    services.forEach(svc => {
      const name = svc.name.toLowerCase();
      if (name.includes('corte') || name.includes('haircut')) groups['✂️ Cortes'].push(svc);
      else if (name.includes('barba') || name.includes('beard')) groups['🧔 Barba'].push(svc);
      else if (name.includes('estética') || name.includes('limpeza') || name.includes('facial') || name.includes('estetica')) groups['💆 Estética'].push(svc);
      else if (name.includes('premium') || name.includes('combo') || name.includes('completo')) groups['👑 Premium'].push(svc);
      else groups['Outros'].push(svc);
    });
    
    return Object.entries(groups).filter(([_, list]) => list.length > 0);
  }, [services]);


  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: company.name,
          text: `Agende seu horário na ${company.name}`,
          url: shareUrl
        });
      } catch (err) { /* ignore */ }
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copiado para a área de transferência!');
    }
  };

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
    <div className="min-h-screen overflow-x-hidden" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={company.cover_url || company.logo_url}
        canonical={shareUrl}
        jsonLd={buildLocalBusinessJsonLd(company)}
      />

      {/* Hero Section with Parallax */}
      <section className="relative w-full h-[300px] sm:h-[400px] overflow-hidden">
        <motion.div 
          style={{ y: y1 }}
          className="absolute inset-0 w-full h-full"
        >
          {company.cover_url ? (
            <>
              <img src={company.cover_url} alt={company.name} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            </>
          ) : (
            <div className="w-full h-full" style={{ background: `linear-gradient(to top, ${T.bg}, ${T.accent}30)` }} />
          )}
        </motion.div>
        
        {/* Logo and Quick Info Overlay */}
        <div className="absolute bottom-0 left-0 w-full p-6 text-white z-10">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center md:items-end gap-6">
            {company.logo_url && (
              <motion.div 
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="relative -mb-16 md:mb-0 z-20"
              >
                <img
                  src={company.logo_url}
                  alt={company.name}
                  className="w-24 h-24 md:w-32 md:h-32 object-contain rounded-2xl p-2 bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl"
                />
              </motion.div>
            )}
            <div className="flex-1 text-center md:text-left mt-12 md:mt-0">
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl md:text-4xl font-black tracking-tight"
              >
                {company.name}
              </motion.h1>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2 text-sm text-white/80">
                {companyStats && companyStats.reviewCount > 0 && (
                  <div className="flex items-center gap-1.5 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
                    <StarRating rating={companyStats.avgRating} size={12} />
                    <span className="font-bold text-yellow-400">{companyStats.avgRating.toFixed(1)}</span>
                    <span className="text-[10px]">({companyStats.reviewCount} avaliações)</span>
                  </div>
                )}
                {(company.district || company.city) && (
                  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-full backdrop-blur-sm">
                    <MapPin className="w-3 h-3" />
                    <span>{[company.district, company.city].filter(Boolean).join(' • ')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-4xl mx-auto px-4 pt-20 md:pt-12 pb-24 space-y-12">
        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="sm:col-span-2 h-14 text-lg font-black rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] transition-all active:scale-95 group"
            style={{ background: T.accent, color: '#000' }}
          >
            <Calendar className="w-6 h-6 mr-2 group-hover:animate-bounce" />
            INICIAR AGENDAMENTO
          </Button>
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-4">
            {companyWhatsapp && (
              <Button
                variant="outline"
                asChild
                className="h-14 rounded-2xl border-2 transition-all active:scale-95"
                style={{ borderColor: '#25D366', color: '#25D366', background: 'transparent' }}
              >
                <a
                  href={buildWhatsAppUrl(companyWhatsapp, `Olá! Vi a página da ${company.name} e gostaria de mais informações.`)}
                  onClick={() => trackWhatsAppClick('landing_premium')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="w-5 h-5" />
                </a>
              </Button>
            )}
            <Button
              variant="outline"
              onClick={handleShare}
              className="h-14 rounded-2xl border-2 transition-all active:scale-95"
              style={{ borderColor: T.accent, color: T.accent, background: 'transparent' }}
            >
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Amenities Tags */}
        {companyAmenities.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2 py-2 border-y border-white/5">
            {companyAmenities.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider" style={{ background: `${T.accent}10`, color: T.accent, border: `1px solid ${T.accent}20` }}>
                <span className="opacity-70">●</span> {a.name}
              </div>
            ))}
          </div>
        )}

        {/* Smart Rebooking Block */}
        {isLoggedIn && lastBooking && !rebookDismissed && (() => {
          const daysSince = Math.floor((Date.now() - new Date(lastBooking.bookedAt).getTime()) / (1000 * 60 * 60 * 24));
          const formattedDate = format(new Date(lastBooking.bookedAt), "d 'de' MMMM", { locale: ptBR });
          return (
            <motion.section 
              initial={{ scale: 0.95, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="relative overflow-hidden rounded-3xl p-6 border-2 shadow-xl"
              style={{ background: `${T.card}`, borderColor: `${T.accent}40` }}
            >
              <div className="absolute top-0 right-0 p-4">
                <button onClick={handleDismissRebook} style={{ color: T.textSec }}><X className="h-5 w-5" /></button>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-orange-500/20 text-orange-500">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <h2 className="text-xl font-black italic tracking-tight" style={{ color: T.text }}>SEU ÚLTIMO ATENDIMENTO</h2>
              </div>
              <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl border border-white/5 mb-4">
                {lastBooking.professionalAvatar ? (
                  <img src={lastBooking.professionalAvatar} alt="" className="w-14 h-14 rounded-full object-cover ring-4 ring-white/10" />
                ) : (
                  <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                    {lastBooking.professionalName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-bold text-base" style={{ color: T.text }}>{lastBooking.serviceNames.join(' + ')}</p>
                  <p className="text-sm opacity-60" style={{ color: T.textSec }}>{formattedDate} • com {lastBooking.professionalName}</p>
                </div>
              </div>
              <Button
                onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar?rebook=1`)}
                className="w-full h-12 text-sm font-bold rounded-xl"
                style={{ background: T.accent, color: '#000' }}
              >
                REPETIR ATENDIMENTO
              </Button>
            </motion.section>
          );
        })()}

        {/* Team Section */}
        {professionals.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter" style={{ color: T.text }}>NOSSA EQUIPE</h2>
              <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
              {professionals.map((p: any) => {
                const rating = professionalRatings[p.id];
                return (
                  <motion.div
                    key={p.id}
                    whileHover={{ y: -5 }}
                    className="flex-shrink-0 w-[200px] flex flex-col items-center gap-3 p-5 rounded-[2.5rem] border transition-all duration-300 group"
                    style={{ background: T.card, borderColor: T.border }}
                    onClick={() => navigate(`/${bookingBasePath}/${slug}/${p.slug ? `${p.slug}/agendar` : 'agendar'}`)}
                  >
                    <div className="relative">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.name} className="w-24 h-24 rounded-full object-cover shadow-xl grayscale-[0.5] group-hover:grayscale-0 transition-all border-2 border-transparent group-hover:border-orange-500" />
                      ) : (
                        <div className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold bg-white/5" style={{ color: T.accent }}>
                          {p.name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      {rating && rating.count > 0 && (
                        <div className="absolute -bottom-1 -right-1 bg-yellow-400 text-black text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1">
                          <Star className="w-2 h-2 fill-black" /> {rating.avg.toFixed(1)}
                        </div>
                      )}
                    </div>
                    <div className="text-center">
                      <p className="font-black text-sm uppercase tracking-tight" style={{ color: T.text }}>{p.name}</p>
                      <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5" style={{ color: T.textSec }}>Profissional</p>
                    </div>
                    <Button
                      size="sm"
                      className="w-full h-8 rounded-full text-[10px] font-black uppercase tracking-widest"
                      style={{ background: `${T.accent}15`, color: T.accent }}
                    >
                      VER PERFIL
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </section>
        )}

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter" style={{ color: T.text }}>AVALIAÇÕES</h2>
              <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {reviews.map((rev: any, i: number) => (
                <div key={i} className="p-6 rounded-3xl border flex flex-col gap-4 shadow-lg" style={{ background: T.card, borderColor: T.border }}>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-white/10")} />
                    ))}
                  </div>
                  <p className="text-sm font-medium leading-relaxed italic opacity-80" style={{ color: T.text }}>
                    "{rev.comment || 'Experiência excelente!'}"
                  </p>
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{rev.client_display_name || 'Cliente'}</span>
                    <span className="text-[9px] font-bold opacity-30">{format(new Date(rev.created_at), 'dd/MM/yy')}</span>
                  </div>
                </div>
              ))}
            </div>
            {allReviewsList.length > 3 && (
              <Button 
                variant="ghost" 
                className="w-full h-12 rounded-2xl font-bold uppercase tracking-widest text-xs"
                style={{ color: T.textSec, background: 'rgba(255,255,255,0.03)' }}
                onClick={() => navigate(`/${bookingBasePath}/${slug}/avaliacoes`)}
              >
                VER TODAS AS {allReviewsList.length} AVALIAÇÕES <ChevronRight className="ml-2 w-4 h-4" />
              </Button>
            )}
          </section>
        )}

        {/* Services Section */}
        {services.length > 0 && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black italic tracking-tighter" style={{ color: T.text }}>SERVIÇOS</h2>
              <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/10 to-transparent" />
            </div>
            <Accordion type="single" collapsible className="w-full space-y-4">
              {groupedServices.map(([category, list], idx) => (
                <AccordionItem key={category} value={`item-${idx}`} className="border-none">
                  <AccordionTrigger className="flex items-center gap-4 p-6 rounded-3xl border-2 hover:no-underline transition-all" style={{ background: T.card, borderColor: T.border }}>
                    <span className="text-lg font-black tracking-tight" style={{ color: T.text }}>{category}</span>
                    <span className="ml-auto mr-4 text-[10px] font-black uppercase tracking-widest opacity-30">{list.length} serviços</span>
                  </AccordionTrigger>
                  <AccordionContent className="pt-4 space-y-3 px-2">
                    {list.map((svc: any) => (
                      <div
                        key={svc.id}
                        className="flex items-center justify-between p-4 rounded-2xl border border-white/5 group transition-all hover:bg-white/5"
                        style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}
                      >
                        <div>
                          <p className="text-base font-bold tracking-tight" style={{ color: T.text }}>{svc.name}</p>
                          <div className="flex items-center gap-2 mt-1 opacity-50">
                            <Clock className="w-3 h-3" />
                            <span className="text-xs font-bold uppercase tracking-widest">{svc.duration_minutes} MIN</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black italic" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        )}

        {/* Location Section */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black italic tracking-tighter" style={{ color: T.text }}>LOCALIZAÇÃO</h2>
            <div className="h-px flex-1 mx-4 bg-gradient-to-r from-white/10 to-transparent" />
          </div>
          <div className="rounded-[2.5rem] overflow-hidden border-2 shadow-2xl" style={{ background: T.card, borderColor: T.border }}>
            <div className="aspect-video w-full bg-white/5 flex items-center justify-center relative">
               <Map className="w-12 h-12 opacity-10" />
               <div className="absolute inset-0 flex items-center justify-center">
                  <Button asChild className="rounded-full px-8 h-12 font-black shadow-xl" style={{ background: T.accent, color: '#000' }}>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                      VER NO MAPA <MapPin className="ml-2 w-4 h-4" />
                    </a>
                  </Button>
               </div>
            </div>
            <div className="p-8">
               <p className="text-lg font-black tracking-tight" style={{ color: T.text }}>{company.name}</p>
               <p className="text-sm font-medium mt-2 opacity-60 leading-relaxed" style={{ color: T.textSec }}>
                 {fullAddress}
               </p>
               <div className="grid grid-cols-2 gap-4 mt-8">
                  <Button variant="outline" asChild className="rounded-2xl h-12 font-bold border-2" style={{ borderColor: T.border, color: T.text }}>
                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                      COMO CHEGAR
                    </a>
                  </Button>
                  {companyWhatsapp && (
                    <Button variant="outline" asChild className="rounded-2xl h-12 font-bold border-2" style={{ borderColor: '#25D366', color: '#25D366' }}>
                      <a href={buildWhatsAppUrl(companyWhatsapp)} target="_blank" rel="noopener noreferrer">
                        WHATSAPP
                      </a>
                    </Button>
                  )}
               </div>
            </div>
          </div>
        </section>

        <PlatformBranding isDark={isDark} />
      </div>

      {/* Persistent Booking Button on Mobile */}
      <div className="fixed bottom-0 left-0 w-full p-4 sm:hidden z-50 pointer-events-none">
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="pointer-events-auto"
        >
          <Button
            onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
            className="w-full h-14 text-lg font-black rounded-2xl shadow-2xl"
            style={{ background: T.accent, color: '#000' }}
          >
            AGENDAR AGORA
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
