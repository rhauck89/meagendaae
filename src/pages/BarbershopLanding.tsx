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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter, DrawerClose } from "@/components/ui/drawer";
import { toast } from 'sonner';
import { IdentityModal } from '@/components/booking/IdentityModal';
import { ReviewForm } from '@/components/public-profile/ReviewForm';
import { useAuth } from '@/contexts/AuthContext';

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
  const { isAuthenticated: isAuthAuthenticated, isAdmin } = useAuth();
  
  // Rule: Admin session is ignored for client identification on landing
  const isAuthenticated = isAuthAuthenticated && !isAdmin;
  
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    serviceIds: string[]; serviceNames: string[]; serviceDurations: number[];
    professionalId: string; professionalName: string; professionalAvatar: string | null;
    totalPrice: number; totalDuration: number; bookedAt: string;
  } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);
  const [isServicesDrawerOpen, setIsServicesDrawerOpen] = useState(false);
  const [isTeamDrawerOpen, setIsTeamDrawerOpen] = useState(false);
  const [isReviewsDrawerOpen, setIsReviewsDrawerOpen] = useState(false);
  const [isAddReviewModalOpen, setIsAddReviewModalOpen] = useState(false);
  const [reviewFormRating, setReviewFormRating] = useState(0);
  const [reviewFormComment, setReviewFormComment] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

  // Detect logged-in user
  useEffect(() => {
  }, []);

  // Load last booking for smart rebooking on landing
  useEffect(() => {
    if (!company?.id) return;
    try {
      const dismissed = localStorage.getItem(`rebook_dismissed_${company.id}`) === '1';
      setRebookDismissed(dismissed);
    } catch { /* ignore */ }

    if (!isAuthenticated) {
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
  }, [company?.id, isAuthenticated]);

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
    try {
      const { data: compArr, error: rpcError } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
      if (rpcError) throw rpcError;
      
      const rpcComp = compArr?.[0];
      if (!rpcComp) {
        setLoading(false);
        return;
      }

      const { data: fullCompanyData, error: fullError } = await supabase.from('public_company' as any).select('*').eq('id', rpcComp.id).single();
      if (fullError) console.warn('[LANDING] Could not fetch full company data:', fullError);
      
      const comp = { ...rpcComp, ...((fullCompanyData as any) || {}) };
      setCompany(comp);
      const resolvedType: BusinessType = routeBusinessType || comp.business_type || 'barbershop';
      setBusinessType(resolvedType);

      // Whitelabel check (non-blocking)
      supabase.from('companies').select('plan_id').eq('id', comp.id).single().then(({ data: compPlan }) => {
        if (compPlan?.plan_id) {
          supabase.from('plans').select('whitelabel').eq('id', compPlan.plan_id).single().then(({ data: planData }) => {
            if (planData?.whitelabel) setIsWhitelabel(true);
          });
        }
      }).catch(() => {});

      const [servicesRes, profsRes, ratingsRes, reviewsRes, settingsRes] = await Promise.all([
        supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
        supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('active', true),
        supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id }),
        supabase.from('reviews').select('rating, comment, created_at, professional_id, appointment_id, review_type').eq('company_id', comp.id).order('created_at', { ascending: false }),
        supabase.from('public_company_settings' as any).select('*').eq('company_id', comp.id).maybeSingle(),
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
        // Enriched reviews logic... (abbreviated for the replace tool)
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
    } catch (err) {
      console.error('[LANDING] Error loading page data:', err);
    } finally {
      setLoading(false);
    }
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


  const handleStartBooking = async () => {
    console.log('[START_BOOKING] Checking identification...');
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        // Check if user has a client record in this company
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('company_id', company.id)
          .maybeSingle();

        if (client) {
          console.log('[START_BOOKING] User logged in and linked, proceeding...');
          navigate(`/${bookingBasePath}/${slug}/agendar`);
          return;
        }
      }
      
      console.log('[START_BOOKING] Identification required, opening modal...');
      setShowIdentityModal(true);
    } catch (err) {
      console.error('[START_BOOKING] Error checking session:', err);
      setShowIdentityModal(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (rating: number, comment: string) => {
    if (!company?.id) return;
    setIsSubmittingReview(true);
    try {
      // Find a professional to tie this review to
      const profId = professionals[0]?.id;
      if (!profId) {
        toast.error("Nenhum profissional disponível para registrar a avaliação.");
        return;
      }

      const { error } = await supabase.from('reviews').insert({
        company_id: company.id,
        professional_id: profId,
        rating: rating,
        comment: comment.trim() || null,
        review_type: 'company'
      });

      if (error) throw error;
      toast.success("Avaliação enviada com sucesso!");
      setIsAddReviewModalOpen(false);
      // Refresh reviews
      load(); 
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar avaliação");
      throw err;
    } finally {
      setIsSubmittingReview(false);
    }
  };

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

  // Amenity icon mapping
  const amenityIconMap: Record<string, any> = {
    'wi-fi': Wifi, 'wifi': Wifi, 'internet': Wifi,
    'estacionamento': Car, 'parking': Car,
    'café': Coffee, 'cafe': Coffee, 'coffee': Coffee,
    'ar-condicionado': Snowflake, 'ar condicionado': Snowflake, 'climatizado': Snowflake,
    'pix': CreditCard, 'cartão': CreditCard, 'cartao': CreditCard, 'pagamento': CreditCard,
  };
  const getAmenityIcon = (name: string) => {
    const key = name?.toLowerCase().trim();
    return amenityIconMap[key] || Sparkles;
  };

  // Category mapping with icons
  const categoryIconMap: Record<string, any> = {
    'Cortes': Scissors,
    'Barba': Crown,
    'Estética': Sparkles,
    'Premium': Crown,
    'Outros': Sparkles,
  };
  const cleanedGroups = groupedServices.map(([cat, list]) => {
    const cleanCat = cat.replace(/^[^\w\s]+\s*/, '').trim();
    return [cleanCat, list] as [string, any[]];
  });

  return (
    <div className="min-h-screen overflow-x-hidden pb-24" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={company.cover_url || company.logo_url}
        canonical={shareUrl}
        jsonLd={buildLocalBusinessJsonLd(company)}
      />

      {/* HERO with cover + centered avatar */}
      <section className="relative w-full">
        <div className="relative h-[260px] sm:h-[340px] overflow-hidden">
          <motion.div style={{ y: y1 }} className="absolute inset-0">
            {company.cover_url ? (
              <img src={company.cover_url} alt={company.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${T.accent}30, ${T.bg})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-[var(--hero-fade)]" style={{ ['--hero-fade' as any]: T.bg }} />
          </motion.div>

          {/* Top floating actions */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white hover:bg-black/60 transition"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white hover:bg-black/60 transition"
                aria-label="Compartilhar"
              >
                <Share2 className="w-5 h-5" />
              </button>
              <button
                className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white hover:bg-black/60 transition"
                aria-label="Favoritar"
              >
                <Heart className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Avatar floating over hero */}
        <div className="relative -mt-16 flex justify-center z-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="relative"
          >
            {company.logo_url ? (
              <img
                src={company.logo_url}
                alt={company.name}
                className="w-32 h-32 rounded-full object-cover border-4 shadow-2xl"
                style={{ borderColor: T.accent, background: T.card }}
              />
            ) : (
              <div
                className="w-32 h-32 rounded-full flex items-center justify-center text-5xl font-black border-4 shadow-2xl"
                style={{ borderColor: T.accent, background: T.card, color: T.accent }}
              >
                {company.name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </motion.div>
        </div>

        {/* Name + rating + location */}
        <div className="text-center px-4 pt-4 space-y-2">
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-3xl sm:text-4xl font-black tracking-tight inline-flex items-center gap-2"
            style={{ color: T.text }}
          >
            {company.name}
            <BadgeCheck className="w-6 h-6" style={{ color: T.accent }} fill={T.accent} stroke={T.bg} />
          </motion.h1>
          {companyStats && companyStats.reviewCount > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              <StarRating rating={companyStats.avgRating} size={16} />
              <span className="font-bold" style={{ color: T.accent }}>{companyStats.avgRating.toFixed(1)}</span>
              <span className="opacity-60" style={{ color: T.textSec }}>({companyStats.reviewCount} avaliações)</span>
            </div>
          )}
          {(company.city || company.state) && (
            <div className="flex items-center justify-center gap-1 text-sm opacity-70" style={{ color: T.textSec }}>
              <MapPin className="w-4 h-4" />
              <span>{[company.city, company.state].filter(Boolean).join(', ')}</span>
            </div>
          )}
        </div>
      </section>

      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-8">
        {/* Amenities chips */}
        {companyAmenities.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-1">
            {companyAmenities.slice(0, 8).map((a: any) => {
              const Icon = getAmenityIcon(a.name);
              return (
                <div
                  key={a.id}
                  className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium"
                  style={{ background: T.card, borderColor: T.border, color: T.text }}
                >
                  <Icon className="w-4 h-4" style={{ color: T.accent }} />
                  {a.name}
                </div>
              );
            })}
          </div>
        )}

        {/* Primary CTA */}
        <Button
          onClick={handleStartBooking}
          className="w-full h-14 text-base font-bold rounded-2xl shadow-xl flex items-center justify-between px-6 transition-all active:scale-[0.98]"
          style={{ background: T.accent, color: '#000' }}
        >
          <span className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Iniciar Agendamento
          </span>
          <ChevronRight className="w-5 h-5" />
        </Button>

        {/* Secondary actions */}
        <div className="grid grid-cols-2 gap-3 -mt-4">
          {companyWhatsapp && (
            <Button
              variant="outline"
              asChild
              className="h-12 rounded-xl border-2 font-semibold overflow-hidden"
              style={{ borderColor: '#25D366', color: '#25D366', background: 'transparent' }}
            >
              <a
                href={buildWhatsAppUrl(companyWhatsapp, `Olá! Vi a página da ${company.name} e gostaria de mais informações.`)}
                onClick={() => trackWhatsAppClick('landing_premium')}
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                <span className="sm:hidden">Contato</span>
                <span className="hidden sm:inline">Chamar no WhatsApp</span>
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleShare}
            className="h-12 rounded-xl border-2 font-semibold"
            style={{ borderColor: T.border, color: T.text, background: 'transparent' }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Compartilhar
          </Button>
        </div>

        {/* Smart Rebooking */}
        {isAuthenticated && lastBooking && !rebookDismissed && (() => {
          const formattedDate = format(new Date(lastBooking.bookedAt), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
          return (
            <motion.section
              initial={{ scale: 0.97, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              className="relative rounded-2xl p-5 border"
              style={{ background: T.card, borderColor: T.border }}
            >
              <div className="flex items-center gap-2 mb-3" style={{ color: T.text }}>
                <Calendar className="w-4 h-4" style={{ color: T.accent }} />
                <span className="font-semibold text-sm">Seu último atendimento</span>
              </div>
              <div className="flex flex-col sm:flex-row items-center sm:items-center gap-4 text-center sm:text-left">
                {lastBooking.professionalAvatar ? (
                  <img src={lastBooking.professionalAvatar} alt="" className="w-16 h-16 sm:w-12 sm:h-12 rounded-full object-cover" style={{ border: `2px solid ${T.accent}` }} />
                ) : (
                  <div className="w-16 h-16 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xl sm:text-base" style={{ background: `${T.accent}20`, color: T.accent, border: `2px solid ${T.accent}` }}>
                    {lastBooking.professionalName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0 w-full">
                  <p className="font-bold text-base sm:text-sm truncate" style={{ color: T.text }}>{lastBooking.serviceNames.join(' + ')}</p>
                  <p className="text-sm sm:text-xs opacity-60 mt-0.5" style={{ color: T.textSec }}>com {lastBooking.professionalName}</p>
                  <p className="text-xs opacity-50 mt-1 flex items-center justify-center sm:justify-start gap-1" style={{ color: T.textSec }}>
                    <Calendar className="w-3 h-3" /> {formattedDate}
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar?rebook=1`)}
                  variant="outline"
                  className="w-full sm:w-auto rounded-xl font-semibold text-sm border-2 h-11"
                  style={{ borderColor: T.accent, color: T.accent, background: 'transparent' }}
                >
                  Repetir atendimento
                </Button>
              </div>
              <button onClick={handleDismissRebook} className="absolute top-3 right-3 opacity-40 hover:opacity-80" style={{ color: T.textSec }}>
                <X className="h-4 w-4" />
              </button>
            </motion.section>
          );
        })()}

        {/* Team */}
        {professionals.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: T.text }}>
                <Users className="w-5 h-5" style={{ color: T.accent }} />
                Nossa equipe
              </h2>
              <button
                onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
                className="text-sm font-medium hover:underline"
                style={{ color: T.accent }}
              >
                Ver todos
              </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {professionals.slice(0, 4).map((p: any) => {
                const rating = professionalRatings[p.id];
                return (
                  <motion.button
                    key={p.id}
                    whileHover={{ y: -3 }}
                    onClick={() => navigate(`/${bookingBasePath}/${slug}/${p.slug ? `${p.slug}/agendar` : 'agendar'}`)}
                    className="flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all"
                    style={{ background: T.card, borderColor: T.border }}
                  >
                    {p.avatar_url ? (
                      <img
                        src={p.avatar_url}
                        alt={p.name}
                        className="w-20 h-20 rounded-full object-cover"
                        style={{ border: `2px solid ${T.accent}` }}
                      />
                    ) : (
                      <div
                        className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold"
                        style={{ background: `${T.accent}20`, color: T.accent, border: `2px solid ${T.accent}` }}
                      >
                        {p.name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <p className="font-bold text-sm text-center" style={{ color: T.text }}>{p.name}</p>
                    <p className="text-xs opacity-60" style={{ color: T.textSec }}>{p.role || 'Profissional'}</p>
                    {rating && rating.count > 0 && (
                      <div className="flex items-center gap-1 text-xs">
                        <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold" style={{ color: T.accent }}>{rating.avg.toFixed(1)}</span>
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </section>
        )}

        {/* Services */}
        {services.length > 0 && cleanedGroups.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: T.text }}>
                <Scissors className="w-5 h-5" style={{ color: T.accent }} />
                Nossos serviços
              </h2>
              <button
                onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
                className="text-sm font-medium hover:underline"
                style={{ color: T.accent }}
              >
                Ver todos
              </button>
            </div>
            <Tabs defaultValue={cleanedGroups[0][0]} className="w-full">
              <TabsList
                className="w-full grid h-auto p-1 rounded-2xl gap-1"
                style={{ background: T.card, gridTemplateColumns: `repeat(${cleanedGroups.length}, minmax(0, 1fr))` }}
              >
                {cleanedGroups.map(([cat]) => {
                  const Icon = categoryIconMap[cat] || Sparkles;
                  return (
                    <TabsTrigger
                      key={cat}
                      value={cat}
                      className="flex items-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold data-[state=active]:shadow-md"
                      style={{
                        color: T.textSec,
                      } as any}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden sm:inline">{cat}</span>
                      <span className="sm:hidden text-xs">{cat}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              {cleanedGroups.map(([cat, list]) => (
                <TabsContent key={cat} value={cat} className="mt-3">
                  <div className="rounded-2xl border overflow-hidden" style={{ background: T.card, borderColor: T.border }}>
                    {list.map((svc: any, i: number) => (
                      <button
                        key={svc.id}
                        onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
                        className="w-full flex items-center justify-between p-4 transition-all hover:bg-white/5 text-left"
                        style={{ borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}
                      >
                        <span className="font-semibold text-sm" style={{ color: T.text }}>{svc.name}</span>
                        <div className="flex items-center gap-4">
                          <span className="text-xs flex items-center gap-1 opacity-60" style={{ color: T.textSec }}>
                            <Clock className="w-3 h-3" /> {svc.duration_minutes} min
                          </span>
                          <span className="text-sm font-bold" style={{ color: T.accent, minWidth: 70, textAlign: 'right' }}>
                            R$ {Number(svc.price).toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </TabsContent>
              ))}
            </Tabs>
            <Button
              variant="outline"
              onClick={() => navigate(`/${bookingBasePath}/${slug}/agendar`)}
              className="w-full h-11 rounded-xl border-2 font-semibold"
              style={{ borderColor: T.accent, color: T.accent, background: 'transparent' }}
            >
              Ver todos os serviços
            </Button>
          </section>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: T.text }}>
                <Star className="w-5 h-5" style={{ color: T.accent }} />
                Avaliações
              </h2>
              {allReviewsList.length > 3 && (
                <button
                  onClick={() => navigate(`/${bookingBasePath}/${slug}/avaliacoes`)}
                  className="text-sm font-medium hover:underline"
                  style={{ color: T.accent }}
                >
                  Ver todas
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Average card */}
              {companyStats && companyStats.reviewCount > 0 && (
                <div className="p-5 rounded-2xl border flex flex-col items-center justify-center text-center" style={{ background: T.card, borderColor: T.border }}>
                  <p className="text-4xl font-black" style={{ color: T.text }}>{companyStats.avgRating.toFixed(1).replace('.', ',')}</p>
                  <div className="my-2"><StarRating rating={companyStats.avgRating} size={16} /></div>
                  <p className="text-xs opacity-60" style={{ color: T.textSec }}>{companyStats.reviewCount} avaliações</p>
                </div>
              )}
              {reviews.slice(0, 2).map((rev: any, i: number) => {
                const initial = (rev.client_display_name || 'C').charAt(0).toUpperCase();
                const colors = ['#A855F7', '#3B82F6', '#10B981', '#F59E0B'];
                const color = colors[i % colors.length];
                return (
                  <div key={i} className="p-4 rounded-2xl border flex flex-col gap-3" style={{ background: T.card, borderColor: T.border }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: color }}>
                          {initial}
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: T.text }}>{rev.client_display_name || 'Cliente'}</p>
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map(s => (
                              <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-white/10")} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs opacity-50" style={{ color: T.textSec }}>
                        {format(new Date(rev.created_at), 'dd/MM/yyyy')}
                      </span>
                    </div>
                    <p className="text-sm italic opacity-80 leading-relaxed" style={{ color: T.text }}>
                      "{rev.comment || 'Experiência excelente!'}"
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Location */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: T.text }}>
            <MapPin className="w-5 h-5" style={{ color: T.accent }} />
            Localização
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="p-5 rounded-2xl border" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-start gap-2 mb-3">
                <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="font-bold text-base" style={{ color: T.text }}>{company.name}</p>
                  <p className="text-sm opacity-70 leading-relaxed mt-1" style={{ color: T.textSec }}>
                    {[company.address, company.address_number].filter(Boolean).join(', ')}
                    {company.district && <><br />{company.district}</>}
                    {(company.city || company.state) && <><br />{[company.city, company.state].filter(Boolean).join(', ')}</>}
                    {company.postal_code && <><br />CEP {company.postal_code}</>}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-4">
                <Button
                  variant="outline"
                  asChild
                  className="rounded-xl h-10 font-semibold border-2 text-xs"
                  style={{ borderColor: T.accent, color: T.accent }}
                >
                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`} target="_blank" rel="noopener noreferrer">
                    <Navigation className="w-3.5 h-3.5 mr-1" />
                    Como chegar
                  </a>
                </Button>
                {companyWhatsapp && (
                  <Button
                    variant="outline"
                    asChild
                    className="rounded-xl h-10 font-semibold border-2 text-xs"
                    style={{ borderColor: '#25D366', color: '#25D366' }}
                  >
                    <a href={buildWhatsAppUrl(companyWhatsapp)} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-3.5 h-3.5 mr-1" />
                      WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-2xl border overflow-hidden block relative min-h-[200px]"
              style={{ background: T.card, borderColor: T.border }}
            >
              <iframe
                title="Mapa"
                src={`https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`}
                className="w-full h-full absolute inset-0 border-0"
                loading="lazy"
              />
            </a>
          </div>
        </section>

        <PlatformBranding isDark={isDark} />
      </div>

      {/* Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t backdrop-blur-xl"
        style={{ background: `${T.bg}E6`, borderColor: T.border }}
      >
        <div className="max-w-3xl mx-auto grid grid-cols-5 items-end px-2 py-2 relative">
          <button className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium" style={{ color: T.accent }}>
            <Home className="w-5 h-5" />
            <span>Início</span>
          </button>
          <button
            onClick={() => {
              const el = document.querySelector('[data-services-section]') as HTMLElement | null;
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
            className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium opacity-60"
            style={{ color: T.textSec }}
          >
            <Scissors className="w-5 h-5" />
            <span>Serviços</span>
          </button>
          {/* Floating booking button */}
          <button
            onClick={handleStartBooking}
            className="flex flex-col items-center -mt-8"
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center shadow-2xl"
              style={{ background: T.accent, color: '#000', border: `4px solid ${T.bg}` }}
            >
              <Calendar className="w-7 h-7" />
            </div>
            <span className="text-xs font-semibold mt-1" style={{ color: T.accent }}>Agendar</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium opacity-60" style={{ color: T.textSec }}>
            <Users className="w-5 h-5" />
            <span>Equipe</span>
          </button>
          <button className="flex flex-col items-center gap-0.5 py-2 text-xs font-medium opacity-60" style={{ color: T.textSec }}>
            <Star className="w-5 h-5" />
            <span>Avaliações</span>
          </button>
        </div>
      </nav>
      <IdentityModal
        isOpen={showIdentityModal}
        onClose={() => setShowIdentityModal(false)}
        companyId={company?.id}
        onLoginSuccess={() => {
          setShowIdentityModal(false);
          // O hook useAuth já atualizará o estado isAuthenticated
          navigate(`/${bookingBasePath}/${slug}/agendar`);
        }}
      />
    </div>
  );
}
