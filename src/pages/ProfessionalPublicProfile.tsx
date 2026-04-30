import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Share2, Check, Calendar, Clock, Instagram, Sparkles, Scissors, BadgeCheck, Trophy, Flame, Crown, Users, ArrowLeft, Heart, ShieldCheck, Zap, Repeat } from 'lucide-react';
import { LocationBlock } from '@/components/LocationBlock';
import { SEOHead } from '@/components/SEOHead';
import { format, addDays, startOfDay, isToday, isTomorrow, differenceInYears, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';
import { type ExistingAppointment } from '@/lib/availability-engine';
import { getAvailableSlots } from '@/lib/availability-service';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PlatformBranding } from '@/components/PlatformBranding';
import { getCompanyBranding, buildThemeFromBranding, useApplyBranding } from '@/hooks/useCompanyBranding';
import { useCompanyAmenities } from '@/hooks/useCompanyAmenities';
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

type BusinessType = 'barbershop' | 'esthetic';

const DEFAULT_TZ = 'America/Sao_Paulo';

const timeStringToMinutes = (v: string) => { const [h, m] = v.split(':').map(Number); return h * 60 + m; };
const getAppointmentMinutesInTimezone = (v: string, tz: string) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(v));
  return Number(p.find(x => x.type === 'hour')?.value ?? '0') * 60 + Number(p.find(x => x.type === 'minute')?.value ?? '0');
};
const filterOverlapping = (slots: string[], apts: ExistingAppointment[], dur: number, buf: number, tz: string) =>
  slots.filter(s => { const ss = timeStringToMinutes(s), se = ss + dur; return !apts.some(a => { const as2 = getAppointmentMinutesInTimezone(a.start_time, tz), ae = getAppointmentMinutesInTimezone(a.end_time, tz) + buf; return as2 < se && ae > ss; }); });

export default function ProfessionalPublicProfile() {
  const { slug, professionalSlug } = useParams<{ slug: string; professionalSlug: string }>();
  const navigate = useNavigate();

  const [company, setCompany] = useState<any>(null);
  const [professional, setProfessional] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [totalReviews, setTotalReviews] = useState(0);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [nextAvailable, setNextAvailable] = useState<{ date: Date; slots: string[]; label: string } | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [activeCashback, setActiveCashback] = useState<string | null>(null);
  const [lastBooking, setLastBooking] = useState<any>(null);
  const { isAuthenticated: isAuthAuthenticated, isAdmin } = useAuth();
  
  // Rule: Admin/Professional session is ignored for client identification on public profile
  const isAuthenticated = isAuthAuthenticated && !isAdmin;

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

  useEffect(() => {
  }, []);

  useEffect(() => { 
    if (slug && professionalSlug) {
      load(); 
      
      // Defensive timeout: max 5 seconds for initial loading
      const timeoutId = setTimeout(() => {
        setLoading(prev => {
          if (prev) {
            console.warn('[PROFILE] Loading timeout reached after 5s');
            return false;
          }
          return prev;
        });
      }, 5000);

      return () => clearTimeout(timeoutId);
    }
  }, [slug, professionalSlug]);

  const load = async () => {
    setLoading(true);
    try {
      console.log('[PROFILE] Starting load for:', slug, professionalSlug, 'Authenticated:', isAuthenticated, 'isAdmin:', isAdmin);
      
      // 1. Critical Data: Company (Bypass RLS via RPC)
      const { data: compArr, error: compError } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
      if (compError) {
        console.error('[PROFILE] RPC Error (get_company_by_slug):', compError);
        setLoading(false);
        return;
      }
      
      const rpcComp = compArr?.[0];
      if (!rpcComp) {
        console.warn('[PROFILE] Company not found for slug:', slug);
        setLoading(false);
        return;
      }

      console.log('[PROFILE] Company found:', rpcComp.id, 'Querying professional:', professionalSlug);

      // 2. Critical Data: Professional (Using session-agnostic view)
      const { data: pubProfs, error: profError } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', rpcComp.id)
        .eq('slug', professionalSlug!);

      if (profError) {
        console.error('[PROFILE] Professional Fetch Error:', profError);
        setLoading(false);
        return;
      }
      
      const prof = (pubProfs as any[])?.[0];
      if (!prof) {
        console.warn('[PROFILE] Professional not found. CompanyID:', rpcComp.id, 'Slug:', professionalSlug, 'Result count:', pubProfs?.length);
        setLoading(false);
        return;
      }

      console.log('[PROFILE] Professional found:', prof.id, prof.name);

      // Fetch other critical info in parallel
      const [fullCompanyRes, spDataRes] = await Promise.all([
        supabase.from('public_company' as any).select('*').eq('id', rpcComp.id).maybeSingle(),
        supabase.from('service_professionals').select('service_id, price_override').eq('professional_id', prof.id),
      ]);
      
      const companyFull = { ...(rpcComp as any), ...(fullCompanyRes.data as any || {}) };
      setCompany(companyFull);
      setBusinessType(companyFull.business_type || 'barbershop');
      setProfessional(prof);
      setProfile({ 
        bio: prof.bio, 
        social_links: prof.social_links, 
        whatsapp: prof.whatsapp, 
        avatar_url: prof.avatar_url, 
        banner_url: prof.banner_url,
        specialty: prof.specialty || (companyFull.business_type === 'barbershop' ? 'Especialista em barba e corte' : 'Especialista em estética facial'),
        experience_years: prof.experience_years || 5
      });

      // 3. Critical Data: Services (for basic render)
      const spData = spDataRes.data || [];
      const svcIds = spData.map((s: any) => s.service_id);
      if (svcIds.length > 0) {
        const { data: svcData } = await supabase.from('public_services' as any).select('*').eq('company_id', rpcComp.id).in('id', svcIds);
        const withOverrides = ((svcData as any[]) || []).map((s: any) => {
          const ov = spData.find((sp: any) => sp.service_id === s.id);
          return ov?.price_override != null ? { ...s, price: ov.price_override } : s;
        });
        setServices(withOverrides);
      }

      // EXIT LOADING AS SOON AS MAIN STRUCTURE IS READY
      setLoading(false);
      console.log('[PROFILE] Critical data loaded, loading set to false');

      // 4. Secondary Data (Non-blocking)
      
      // Fetch Next Slots (Non-blocking)
      // Call without await to allow background loading
      fetchNextSlots(companyFull, prof).catch(err => {
        console.warn('[PROFILE] Error fetching slots in background:', err);
        setSlotsLoading(false);
      });

      // Rating
      supabase.rpc('get_professional_ratings' as any, { p_company_id: rpcComp.id }).then(({ data: ratingsData }) => {
        if (ratingsData && Array.isArray(ratingsData)) {
          const r = (ratingsData as any[]).find((x: any) => x.professional_id === prof.id);
          if (r) setRating({ avg: Number(r.avg_rating), count: Number(r.review_count) });
        }
      }, () => {});

      // Reviews
      supabase
        .from('reviews')
        .select('rating, comment, created_at, appointment_id, review_type')
        .eq('professional_id', prof.id)
        .eq('review_type', 'professional')
        .order('created_at', { ascending: false })
        .then(({ data: allReviewsData }) => {
          if (allReviewsData) {
            const apptIds = allReviewsData.map((r: any) => r.appointment_id).filter(Boolean);
            if (apptIds.length > 0) {
              supabase
                .from('appointments')
                .select('id, client_name, client_id')
                .in('id', apptIds)
                .then(({ data: appts }) => {
                  const clientIds = (appts || []).filter((a: any) => a.client_id).map((a: any) => a.client_id);
                  if (clientIds.length > 0) {
                    supabase.from('clients').select('id, name').in('id', clientIds).then(({ data: clients }) => {
                      let cnameMap: Record<string, string> = {};
                      (clients || []).forEach((c: any) => { cnameMap[c.id] = c.name; });
                      let clientNames: Record<string, string> = {};
                      (appts || []).forEach((a: any) => {
                        const n = a.client_name || cnameMap[a.client_id];
                        if (n) {
                          const parts = n.trim().split(/\s+/);
                          const first = parts[0] || '';
                          const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
                          clientNames[a.id] = `${first}${lastInitial}`;
                        }
                      });
                      const enriched = allReviewsData.map((r: any) => ({
                        ...r,
                        client_display_name: r.appointment_id ? clientNames[r.appointment_id] || null : null,
                      }));
                      setReviews(enriched);
                      setTotalReviews(enriched.length);
                    });
                  }
                }, () => {});
            } else {
              setReviews(allReviewsData);
              setTotalReviews(allReviewsData.length);
            }
          }
        }, () => {});

      // Stats and Settings
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('professional_id', prof.id).eq('status', 'completed').then(({ count }) => {
        setCompletedCount(count || 0);
      }, () => {});

      supabase.from('public_company_settings' as any).select('timezone, booking_buffer_minutes').eq('company_id', rpcComp.id).single().then(({ data: csData }) => {
        if (csData) setCompanySettings(csData);
      }, () => {});

      // Last Booking - Only for real clients (ignore admins/professionals)
      if (isAuthenticated) {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            supabase
              .from('appointments')
              .select('id, start_time, total_price, professional_id, status')
              .eq('company_id', rpcComp.id)
              .eq('user_id', user.id)
              .eq('professional_id', prof.id)
              .in('status', ['completed', 'confirmed'])
              .order('start_time', { ascending: false })
              .limit(1)
              .maybeSingle()
              .then(({ data: appt }) => {
                if (appt) {
                  supabase.from('appointment_services').select('service_id').eq('appointment_id', appt.id).then(({ data: apptSvcs }) => {
                    if (apptSvcs && apptSvcs.length > 0) {
                      supabase.from('public_services' as any).select('name').eq('id', apptSvcs[0].service_id).maybeSingle().then(({ data: svc }) => {
                        setLastBooking({
                          ...appt,
                          serviceName: (svc as any)?.name
                        });
                      });
                    }
                  });
                }
              });
          }
        }, () => {});
      }

    } catch (err) {
      console.error('[PROFILE] Unexpected error loading page data:', err);
    } finally {
      // Final guard to ensure loading is false
      setLoading(false);
    }
  };

  const fetchNextSlots = async (comp: any, prof: any) => {
    setSlotsLoading(true);
    const [, , , settingsRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('public_company' as any).select('buffer_minutes').eq('id', comp.id).single(),
      supabase.from('public_company_settings' as any).select('timezone, booking_buffer_minutes').eq('company_id', comp.id).single(),
      supabase.from('professional_working_hours' as any).select('*').eq('professional_id', prof.id),
    ]);

    const tz = (settingsRes.data as any)?.timezone || DEFAULT_TZ;

    const avgDur = services.length > 0 ? Math.round(services.reduce((s, sv) => s + (sv.duration_minutes || 30), 0) / services.length) : 30;

    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const day = addDays(startOfDay(new Date()), i);
      const dateStr = format(day, 'yyyy-MM-dd');
      const result = await getAvailableSlots({
        source: 'public',
        companyId: comp.id,
        professionalId: prof.id,
        date: day,
        totalDuration: avgDur,
        filterPastForToday: false,
      });

      const apts = ((result.existingAppointments as ExistingAppointment[]) || []).map(a => ({ start_time: a.start_time, end_time: a.end_time }));
      let slots = filterOverlapping(result.slots, apts, avgDur, result.bufferMinutes, tz);
      if (isToday(day)) { const ct = format(now, 'HH:mm'); slots = slots.filter(s => s > ct); }

      if (slots.length > 0) {
        let label: string;
        if (isToday(day)) {
          label = '🔥 Hoje';
        } else if (isTomorrow(day)) {
          label = '📅 Amanhã';
        } else {
          label = `📅 ${format(day, "EEEE • dd/MM", { locale: ptBR })}`;
        }
        setNextAvailable({ date: day, slots, label });
        setSlotsLoading(false);
        return;
      }
    }
    setNextAvailable(null);
    setSlotsLoading(false);
  };

  const profileUrl = slug && professionalSlug
    ? `${window.location.origin}/perfil/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}`
    : window.location.href;

  const handleShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: `${professional?.name} - ${company?.name}`, url: profileUrl }); } catch {}
    } else {
      await navigator.clipboard.writeText(profileUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bookingUrl = company && professionalSlug
    ? `/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}/agendar`
    : '#';

  const isDark = businessType === 'barbershop';
  const branding = getCompanyBranding(companySettings, isDark);
  useApplyBranding(branding);
  const T = buildThemeFromBranding(branding, isDark);
  const avatarUrl = profile?.avatar_url || professional?.avatar_url;
  const socialLinks = profile?.social_links as any;
  const instagramUrl = socialLinks?.instagram ? (socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram.replace('@', '')}`) : null;
  const whatsappNumber = profile?.whatsapp;
  const whatsappDigits = whatsappNumber ? formatWhatsApp(whatsappNumber) : null;

  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 3);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-700" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!professional || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg }}>
        <p className="text-lg" style={{ color: T.textSec }}>Profissional não encontrado.</p>
      </div>
    );
  }

  const seoTitle = `${professional.name} | ${businessType === 'esthetic' ? 'Profissional' : 'Barbeiro'} na ${company.name}`;
  const seoDescription = `Agende com ${professional.name} na ${company.name} em ${company.city || ''} ${company.state || ''}.`.trim();

  const firstName = professional.name.split(' ')[0];
  const goldGradient = `linear-gradient(135deg, ${T.accent} 0%, #F4C752 50%, ${T.accent} 100%)`;

  return (
    <div className="min-h-screen overflow-x-hidden pb-28" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={professional.avatar_url || company.logo_url}
        canonical={profileUrl}
      />

      {/* HERO — banner ocupando topo, avatar SOBRE o banner */}
      <section className="relative w-full">
        <div className="relative h-[420px] sm:h-[460px] overflow-hidden">
          <motion.div style={{ y: y1 }} className="absolute inset-0">
            {profile?.banner_url || company?.cover_url ? (
              <img src={profile?.banner_url || company?.cover_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${T.accent}40, ${T.bg})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-[var(--hero-fade)]" style={{ ['--hero-fade' as any]: T.bg }} />
          </motion.div>

          {/* Top icons */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={handleShare}
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white"
                aria-label="Compartilhar"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                className="w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-md bg-black/40 border border-white/10 text-white"
                aria-label="Favoritar"
              >
                <Heart className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Avatar centralizado SOBRE o banner */}
          <div className="absolute inset-x-0 bottom-24 flex justify-center z-10">
            <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative">
              <div className="w-28 h-28 rounded-full p-[3px] shadow-2xl" style={{ background: goldGradient }}>
                <div className="w-full h-full rounded-full overflow-hidden bg-background">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={professional.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-3xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                      {professional.name?.charAt(0)}
                    </div>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 right-0 rounded-full p-0.5 shadow-lg" style={{ background: goldGradient }}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ background: T.bg }}>
                  <BadgeCheck className="w-4 h-4" style={{ color: T.accent }} fill={T.accent} stroke={T.bg} />
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Identidade */}
        <div className="text-center -mt-16 px-4 relative z-10">
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-black tracking-tight" style={{ color: T.text }}>{professional.name}</h1>
            <BadgeCheck className="w-6 h-6" style={{ color: T.accent }} fill={T.accent} stroke={T.bg} />
          </div>
          <p className="text-sm mt-1.5 opacity-80" style={{ color: T.textSec }}>{profile?.specialty}</p>

          <div className="flex items-center justify-center gap-4 mt-3 text-sm" style={{ color: T.textSec }}>
            <div className="flex items-center gap-1.5">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-bold" style={{ color: T.text }}>{rating?.avg?.toFixed(1) || '5.0'}</span>
              <span className="opacity-60">({rating?.count || 0} avaliações)</span>
            </div>
            <span className="opacity-30">•</span>
            <div className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              <span>{company.city}, {company.state}</span>
            </div>
          </div>
        </div>
      </section>

      <main className="max-w-3xl mx-auto px-4 mt-8 space-y-6">
        {/* BADGES — 4 colunas horizontais */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: Scissors, label: `${profile?.experience_years} anos de experiência` },
            { icon: Trophy, label: 'Especialista' },
            { icon: MessageCircle, label: 'Atendimento personalizado' },
            { icon: Crown, label: 'Top Profissional' },
          ].map((b, i) => (
            <div key={i} className="px-3 py-3 rounded-2xl border flex items-center gap-2 justify-center" style={{ background: T.card, borderColor: T.border }}>
              <b.icon className="w-4 h-4 flex-shrink-0" style={{ color: T.accent }} />
              <span className="text-xs font-semibold leading-tight" style={{ color: T.text }}>{b.label}</span>
            </div>
          ))}
        </section>

        {/* CTA PRINCIPAL DOURADO */}
        <button
          onClick={() => navigate(bookingUrl)}
          className="w-full rounded-2xl py-4 px-6 flex items-center justify-center gap-3 shadow-2xl transition-transform hover:scale-[1.01] active:scale-[0.99]"
          style={{ background: goldGradient, boxShadow: `0 10px 40px -10px ${T.accent}80` }}
        >
          <Calendar className="w-5 h-5" style={{ color: '#1a1a1a' }} />
          <span className="text-base font-black" style={{ color: '#1a1a1a' }}>Agendar com {firstName}</span>
          <span className="ml-auto" style={{ color: '#1a1a1a' }}>›</span>
        </button>

        {/* BOTÕES SECUNDÁRIOS */}
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {whatsappDigits ? (
            <a
              href={buildWhatsAppUrl(whatsappDigits, `Olá ${professional.name}!`)}
              onClick={() => trackWhatsAppClick('professional-profile')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1 sm:gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm transition-colors px-2 text-center"
              style={{ borderColor: '#25D36680', background: 'transparent', color: '#25D366' }}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">WhatsApp</span>
            </a>
          ) : (
            <button onClick={handleShare} className="flex items-center justify-center gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm px-2" style={{ borderColor: T.border, background: 'transparent', color: T.text }}>
              <Share2 className="w-4 h-4 shrink-0" /> Compartilhar
            </button>
          )}
          <button
            onClick={() => navigate(`${bookingUrl}?request=true`)}
            className="flex items-center justify-center gap-1 sm:gap-2 h-12 rounded-xl border font-bold text-xs sm:text-sm px-2 text-center"
            style={{ borderColor: T.border, background: 'transparent', color: T.text }}
          >
            <MessageCircle className="w-4 h-4 shrink-0" />
            <span className="truncate">Mensagem</span>
          </button>
        </div>

        {/* ÚLTIMO ATENDIMENTO */}
        <AnimatePresence>
          {lastBooking && (
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border p-5"
              style={{ background: T.card, borderColor: T.border }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Seu último atendimento com {firstName}</h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[auto,1fr,auto] gap-4 items-center">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-full overflow-hidden border-2" style={{ borderColor: T.accent }}>
                    {avatarUrl ? <img src={avatarUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full" style={{ background: T.accent }} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold" style={{ color: T.text }}>{lastBooking.serviceName || 'Serviço'}</p>
                    <p className="text-xs opacity-70" style={{ color: T.textSec }}>
                      {format(parseISO(lastBooking.start_time), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                    <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-500">Concluído</span>
                  </div>
                </div>
                <div className="px-4 sm:border-l" style={{ borderColor: T.border }}>
                  <p className="text-xs font-bold flex items-center gap-1" style={{ color: T.accent }}>
                    💡 Dica do {firstName}
                  </p>
                  <p className="text-xs mt-1 opacity-80" style={{ color: T.textSec }}>
                    Para manter o degradê sempre alinhado, retorne em até 20 dias.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`${bookingUrl}?rebook=true`)}
                  className="h-11 px-5 rounded-xl font-bold whitespace-nowrap"
                  style={{ background: T.accent, color: '#1a1a1a' }}
                >
                  Repetir atendimento
                </Button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* AVALIAÇÕES — Nota gigante + 2 depoimentos */}
        {reviews.length > 0 && (
          <section className="rounded-2xl border p-5" style={{ background: T.card, borderColor: T.border }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Avaliações</h3>
              </div>
              <button onClick={() => setShowAllReviews(true)} className="text-xs font-semibold" style={{ color: T.accent }}>Ver todas</button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-[200px,1fr,1fr] gap-5 items-center">
              {/* Nota gigante */}
              <div className="text-center md:border-r pr-0 md:pr-4" style={{ borderColor: T.border }}>
                <p className="text-5xl font-black" style={{ color: T.text }}>{rating?.avg?.toFixed(1) || '5.0'}</p>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1, 2, 3, 4, 5].map(s => (
                    <Star key={s} className={cn("w-4 h-4", s <= Math.round(rating?.avg || 5) ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                  ))}
                </div>
                <p className="text-xs mt-2 opacity-60" style={{ color: T.textSec }}>{totalReviews} avaliações</p>
              </div>

              {/* Depoimentos */}
              {reviews.slice(0, 2).map((rev, i) => (
                <div key={i} className="text-sm">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${T.accent}25`, color: T.accent }}>
                        {rev.client_display_name?.charAt(0) || 'C'}
                      </div>
                      <span className="text-xs font-bold" style={{ color: T.text }}>{rev.client_display_name || 'Cliente'}</span>
                    </div>
                    <span className="text-[10px] opacity-50" style={{ color: T.textSec }}>{format(new Date(rev.created_at), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="flex items-center gap-0.5 mb-1.5">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                    ))}
                  </div>
                  <p className="text-xs italic leading-relaxed opacity-80" style={{ color: T.text }}>
                    "{rev.comment || 'Profissional impecável! Atendimento top e corte sempre perfeito.'}"
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SERVIÇOS + AGENDA — duas colunas */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Serviços */}
          {services.length > 0 && (
            <div className="rounded-2xl border p-5" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-4">
                <Scissors className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Serviços de {firstName}</h3>
              </div>
              <div className="space-y-1">
                {services.slice(0, 5).map(svc => (
                  <div key={svc.id} className="flex items-center justify-between py-2.5 border-b last:border-b-0" style={{ borderColor: `${T.border}80` }}>
                    <div className="flex items-center gap-2 min-w-0">
                      <Scissors className="w-3.5 h-3.5 flex-shrink-0 opacity-60" style={{ color: T.textSec }} />
                      <span className="text-sm font-medium truncate" style={{ color: T.text }}>{svc.name}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs opacity-60" style={{ color: T.textSec }}>{svc.duration_minutes} min</span>
                      <span className="text-sm font-bold" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate(bookingUrl)}
                className="w-full mt-4 py-2.5 rounded-xl border text-xs font-semibold"
                style={{ borderColor: T.border, color: T.text, background: 'transparent' }}
              >
                Ver todos os serviços
              </button>
            </div>
          )}

          {/* Agenda */}
          {nextAvailable && (
            <div className="rounded-2xl border p-5" style={{ background: T.card, borderColor: T.border }}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4" style={{ color: T.accent }} />
                <h3 className="text-sm font-bold" style={{ color: T.text }}>Agenda disponível</h3>
              </div>

              {/* Seletor de data */}
              <div className="flex items-center gap-2 mb-4">
                <div
                  className="flex-1 px-3 py-2.5 rounded-lg border flex items-center justify-between text-sm"
                  style={{ borderColor: T.border, color: T.text, background: T.bg }}
                >
                  <span className="capitalize">{nextAvailable.label.replace(/[^\w\s,]/g, '').trim() || format(nextAvailable.date, "dd 'de' MMMM", { locale: ptBR })}</span>
                  <span className="opacity-50">▾</span>
                </div>
                <button className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ borderColor: T.border, color: T.textSec }}>‹</button>
                <button className="w-9 h-9 rounded-lg border flex items-center justify-center" style={{ borderColor: T.border, color: T.textSec }}>›</button>
              </div>

              {/* Grade de horários */}
              <div className="grid grid-cols-3 gap-2">
                {nextAvailable.slots.slice(0, 9).map(time => (
                  <button
                    key={time}
                    onClick={() => navigate(`${bookingUrl}?date=${format(nextAvailable.date, 'yyyy-MM-dd')}&time=${time}`)}
                    className="py-2.5 rounded-lg text-sm font-bold border transition-all hover:scale-105"
                    style={{ background: 'transparent', borderColor: `${T.accent}40`, color: T.accent }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* FAIXA VERDE — CTA secundário */}
        <section
          className="rounded-2xl p-5 flex items-center gap-4 justify-between"
          style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center bg-emerald-500/20 flex-shrink-0">
              <Calendar className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: T.text }}>Agende seu horário com {firstName}</p>
              <p className="text-xs opacity-70 truncate" style={{ color: T.textSec }}>Escolha o melhor horário e garanta seu atendimento!</p>
            </div>
          </div>
          <Button
            onClick={() => navigate(bookingUrl)}
            className="h-11 px-4 rounded-xl font-bold whitespace-nowrap bg-emerald-500 hover:bg-emerald-600 text-white flex-shrink-0"
          >
            Ver horários ›
          </Button>
        </section>

        {/* RODAPÉ — 4 ícones de confiança */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {[
            { icon: Users, title: 'Atendimento', sub: 'Personalizado' },
            { icon: Crown, title: 'Ambiente', sub: 'Premium' },
            { icon: ShieldCheck, title: 'Profissional', sub: 'Certificado' },
            { icon: Heart, title: 'Satisfação', sub: 'Garantida' },
          ].map((item, i) => (
            <div key={i} className="rounded-2xl border px-4 py-3 flex items-center gap-3" style={{ background: T.card, borderColor: T.border }}>
              <item.icon className="w-5 h-5 flex-shrink-0" style={{ color: T.accent }} />
              <div className="min-w-0">
                <p className="text-xs font-bold" style={{ color: T.text }}>{item.title}</p>
                <p className="text-[10px] opacity-60" style={{ color: T.textSec }}>{item.sub}</p>
              </div>
            </div>
          ))}
        </section>

        <div className="pt-6 pb-4 opacity-40 text-center">
          <PlatformBranding isDark={isDark} />
        </div>
      </main>

      {/* Floating CTA mobile */}
      <div className="fixed bottom-0 left-0 right-0 p-3 z-50 pointer-events-none md:hidden" style={{ background: `linear-gradient(to top, ${T.bg}, transparent)` }}>
        <div className="max-w-md mx-auto flex gap-2 pointer-events-auto">
          <Button
            onClick={() => navigate(bookingUrl)}
            className="flex-1 h-13 rounded-xl text-sm font-black shadow-2xl"
            style={{ background: goldGradient, color: '#1a1a1a', boxShadow: `0 10px 30px -8px ${T.accent}90` }}
          >
            AGENDAR COM {firstName.toUpperCase()}
          </Button>
          {whatsappDigits && (
            <a
              href={buildWhatsAppUrl(whatsappDigits, `Olá ${professional.name}!`)}
              className="w-13 h-13 px-3 rounded-xl flex items-center justify-center bg-emerald-500 text-white shadow-xl"
            >
              <MessageCircle className="w-5 h-5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
