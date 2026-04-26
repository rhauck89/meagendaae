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
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const { amenities: companyAmenities } = useCompanyAmenities(company?.id);
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setIsLoggedIn(!!session?.user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setIsLoggedIn(!!session?.user));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => { if (slug && professionalSlug) load(); }, [slug, professionalSlug]);

  const load = async () => {
    setLoading(true);
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) { setLoading(false); return; }

    const { data: fullCompanyData } = await supabase.from('public_company' as any).select('*').eq('id', comp.id).single();
    const companyFull = { ...comp, ...((fullCompanyData as any) || {}) };
    setCompany(companyFull);
    setBusinessType(companyFull.business_type || 'barbershop');

    const { data: pubProfs } = await supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('slug', professionalSlug!);
    const prof = (pubProfs as any[])?.[0];
    if (!prof) { setLoading(false); return; }
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

    // Check for last booking if logged in
    if (isLoggedIn) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: appt } = await supabase
          .from('appointments')
          .select('id, start_time, total_price, professional_id, status')
          .eq('company_id', comp.id)
          .eq('user_id', user.id)
          .eq('professional_id', prof.id)
          .in('status', ['completed', 'confirmed'])
          .order('start_time', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (appt) {
          const { data: apptSvcs } = await supabase.from('appointment_services').select('service_id').eq('appointment_id', appt.id);
          if (apptSvcs && apptSvcs.length > 0) {
            const { data: svc } = await supabase.from('public_services' as any).select('name').eq('id', apptSvcs[0].service_id).maybeSingle();
            setLastBooking({
              ...appt,
              serviceName: svc?.name
            });
          }
        }
      }
    }

    const { data: spData } = await supabase.from('service_professionals').select('service_id, price_override').eq('professional_id', prof.id);
    const svcIds = (spData || []).map((s: any) => s.service_id);
    if (svcIds.length > 0) {
      const { data: svcData } = await supabase.from('public_services' as any).select('*').eq('company_id', comp.id).in('id', svcIds);
      const withOverrides = ((svcData as any[]) || []).map((s: any) => {
        const ov = (spData || []).find((sp: any) => sp.service_id === s.id);
        return ov?.price_override != null ? { ...s, price: ov.price_override } : s;
      });
      setServices(withOverrides);
    }

    // Rating
    const { data: ratingsData } = await supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id });
    if (ratingsData && Array.isArray(ratingsData)) {
      const r = (ratingsData as any[]).find((x: any) => x.professional_id === prof.id);
      if (r) setRating({ avg: Number(r.avg_rating), count: Number(r.review_count) });
    }

    // Reviews - fetch all for count, display limited
    const { data: allReviewsData } = await supabase
      .from('reviews')
      .select('rating, comment, created_at, appointment_id, review_type')
      .eq('professional_id', prof.id)
      .eq('review_type', 'professional')
      .order('created_at', { ascending: false });
    if (allReviewsData) {
      // Enrich with client display name (masked)
      const apptIds = allReviewsData.map((r: any) => r.appointment_id).filter(Boolean);
      let clientNames: Record<string, string> = {};
      if (apptIds.length > 0) {
        const { data: appts } = await supabase
          .from('appointments')
          .select('id, client_name, client_id')
          .in('id', apptIds);
        const clientIds = (appts || []).filter((a: any) => a.client_id).map((a: any) => a.client_id);
        let cnameMap: Record<string, string> = {};
        if (clientIds.length > 0) {
          const { data: clients } = await supabase.from('clients').select('id, name').in('id', clientIds);
          (clients || []).forEach((c: any) => { cnameMap[c.id] = c.name; });
        }
        (appts || []).forEach((a: any) => {
          const n = a.client_name || cnameMap[a.client_id];
          if (n) {
            const parts = n.trim().split(/\s+/);
            const first = parts[0] || '';
            const lastInitial = parts.length > 1 ? ` ${parts[parts.length - 1].charAt(0).toUpperCase()}.` : '';
            clientNames[a.id] = `${first}${lastInitial}`;
          }
        });
      }
      const enriched = allReviewsData.map((r: any) => ({
        ...r,
        client_display_name: r.appointment_id ? clientNames[r.appointment_id] || null : null,
      }));
      setReviews(enriched);
      setTotalReviews(enriched.length);
    }

    // Completed appointments count
    const { count } = await supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('professional_id', prof.id).eq('status', 'completed');
    setCompletedCount(count || 0);

    // Fetch company settings for branding
    const { data: csData } = await supabase.from('public_company_settings' as any).select('primary_color, secondary_color, background_color').eq('company_id', comp.id).single();
    if (csData) setCompanySettings(csData);

    // Check for active cashback promotions
    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: cbPromos } = await supabase
        .from('promotions')
        .select('discount_type, discount_value, professional_filter, professional_ids')
        .eq('company_id', comp.id)
        .eq('promotion_type', 'cashback')
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today);
      if (cbPromos && cbPromos.length > 0) {
        const eligible = cbPromos.find((p: any) =>
          p.professional_filter !== 'specific' || (p.professional_ids || []).includes(prof.id)
        );
        if (eligible) {
          const label = eligible.discount_type === 'percentage'
            ? `${eligible.discount_value}% de cashback`
            : `R$ ${Number(eligible.discount_value).toFixed(2)} de cashback`;
          setActiveCashback(label);
        }
      }
    } catch { /* ignore */ }

    // Next available slots
    await fetchNextSlots(comp, prof);
    setLoading(false);
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

  return (
    <div className="min-h-screen overflow-x-hidden pb-32" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={professional.avatar_url || company.logo_url}
        canonical={profileUrl}
      />

      {/* HERO SECTION */}
      <section className="relative w-full">
        <div className="relative h-[240px] overflow-hidden">
          <motion.div style={{ y: y1 }} className="absolute inset-0">
            {profile?.banner_url || company?.cover_url ? (
              <img src={profile?.banner_url || company?.cover_url} alt="Banner" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${T.accent}40, ${T.bg})` }} />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[var(--hero-fade)]" style={{ ['--hero-fade' as any]: T.bg }} />
          </motion.div>

          {/* Top Actions */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-20">
            <button
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md bg-black/20 border border-white/10 text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <button
              onClick={handleShare}
              className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md bg-black/20 border border-white/10 text-white"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Identity Card */}
        <div className="relative px-4 -mt-20 z-10 flex flex-col items-center">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative"
          >
            <div className="w-32 h-32 rounded-full border-4 shadow-xl overflow-hidden bg-background" style={{ borderColor: T.accent }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt={professional.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                  {professional.name?.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute bottom-1 right-1 bg-blue-500 rounded-full p-1 border-2 border-background shadow-lg">
              <BadgeCheck className="w-5 h-5 text-white" />
            </div>
          </motion.div>

          <div className="mt-4 text-center">
            <h1 className="text-3xl font-bold tracking-tight" style={{ color: T.text }}>{professional.name}</h1>
            <p className="text-sm font-medium mt-1 flex items-center justify-center gap-1.5 opacity-80" style={{ color: T.textSec }}>
              <Crown className="w-4 h-4" />
              {profile?.specialty}
            </p>
            
            {rating && rating.count > 0 && (
              <div className="flex items-center justify-center gap-1.5 mt-2 bg-yellow-400/10 px-3 py-1 rounded-full border border-yellow-400/20">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Star key={i} className={cn("w-3.5 h-3.5", i <= Math.round(rating.avg) ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                  ))}
                </div>
                <span className="text-sm font-bold" style={{ color: T.text }}>{rating.avg.toFixed(1)}</span>
                <span className="text-xs opacity-60" style={{ color: T.textSec }}>({rating.count} avaliações)</span>
              </div>
            )}
            
            <p className="text-xs mt-3 flex items-center justify-center gap-1 opacity-60" style={{ color: T.textSec }}>
              <MapPin className="w-3.5 h-3.5" />
              {company.city}, {company.state}
            </p>
          </div>
        </div>
      </section>

      <main className="max-w-md mx-auto px-4 mt-8 space-y-8">
        {/* PREMIUM BADGES */}
        <section className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-2xl border flex flex-col items-center text-center gap-2" style={{ background: T.card, borderColor: T.border }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${T.accent}15` }}>
              <Trophy className="w-5 h-5" style={{ color: T.accent }} />
            </div>
            <div>
              <p className="text-xs font-medium opacity-60" style={{ color: T.textSec }}>Experiência</p>
              <p className="text-sm font-bold" style={{ color: T.text }}>+{profile?.experience_years} anos</p>
            </div>
          </div>
          <div className="p-4 rounded-2xl border flex flex-col items-center text-center gap-2" style={{ background: T.card, borderColor: T.border }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-orange-500/15">
              <Flame className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs font-medium opacity-60" style={{ color: T.textSec }}>Status</p>
              <p className="text-sm font-bold" style={{ color: T.text }}>Altamente procurado</p>
            </div>
          </div>
        </section>

        {/* LAST APPOINTMENT / REBOOKING */}
        <AnimatePresence>
          {lastBooking && (
            <motion.section 
              initial={{ x: 20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              className="p-5 rounded-3xl border-2 overflow-hidden relative"
              style={{ background: `${T.accent}08`, borderColor: T.accent }}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-background border shadow-sm">
                  <Repeat className="w-6 h-6" style={{ color: T.accent }} />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold" style={{ color: T.text }}>Seu último atendimento com {professional.name.split(' ')[0]}</h3>
                  <p className="text-xs mt-0.5 opacity-70" style={{ color: T.textSec }}>
                    {lastBooking.serviceName} • {format(parseISO(lastBooking.start_time), "dd 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-[11px] mt-2 font-medium text-emerald-500 flex items-center gap-1">
                    <Zap className="w-3 h-3 fill-emerald-500" />
                    Dica: Para manter o visual, retorne em até 20 dias.
                  </p>
                  <Button 
                    onClick={() => navigate(`${bookingUrl}?rebook=true`)}
                    className="w-full mt-4 h-10 rounded-xl font-bold"
                    style={{ background: T.accent, color: T.bg }}
                  >
                    Repetir atendimento
                  </Button>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        {/* BIO SECTION */}
        {profile?.bio && (
          <section>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wider opacity-60 px-1" style={{ color: T.textSec }}>Sobre o profissional</h3>
            <div className="p-5 rounded-3xl border" style={{ background: T.card, borderColor: T.border }}>
              <p className="text-sm leading-relaxed" style={{ color: T.textSec }}>{profile.bio}</p>
            </div>
          </section>
        )}

        {/* NUMBERS SECTION */}
        <section className="grid grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className="p-4 rounded-3xl border" style={{ background: T.card, borderColor: T.border }}>
              <p className="text-2xl font-black" style={{ color: T.text }}>{completedCount}+</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50" style={{ color: T.textSec }}>Atendimentos</p>
            </div>
            <div className="p-4 rounded-3xl border" style={{ background: T.card, borderColor: T.border }}>
              <p className="text-2xl font-black" style={{ color: T.text }}>18d</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50" style={{ color: T.textSec }}>Média Retorno</p>
            </div>
          </div>
          <div className="space-y-4">
            <div className="p-4 rounded-3xl border" style={{ background: T.card, borderColor: T.border }}>
              <p className="text-2xl font-black" style={{ color: T.text }}>98%</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50" style={{ color: T.textSec }}>Satisfação</p>
            </div>
            <div className="p-4 rounded-3xl border" style={{ background: T.card, borderColor: T.border }}>
              <p className="text-2xl font-black" style={{ color: T.text }}>{rating?.avg || 5.0}</p>
              <p className="text-[10px] uppercase font-bold tracking-widest opacity-50" style={{ color: T.textSec }}>Nota Real</p>
            </div>
          </div>
        </section>

        {/* NEXT AVAILABLE */}
        {nextAvailable && (
          <section>
            <h3 className="text-sm font-bold mb-3 uppercase tracking-wider opacity-60 px-1" style={{ color: T.textSec }}>Próximas vagas</h3>
            <div className="p-6 rounded-3xl border-2" style={{ background: T.card, borderColor: `${T.accent}30` }}>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5" style={{ color: T.accent }} />
                <span className="text-sm font-bold capitalize" style={{ color: T.text }}>{nextAvailable.label}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {nextAvailable.slots.slice(0, 5).map(time => (
                  <button
                    key={time}
                    onClick={() => navigate(`${bookingUrl}?date=${format(nextAvailable.date, 'yyyy-MM-dd')}&time=${time}`)}
                    className="py-3 rounded-xl text-sm font-bold border transition-all hover:scale-105 active:scale-95"
                    style={{ background: `${T.accent}15`, borderColor: `${T.accent}30`, color: T.accent }}
                  >
                    {time}
                  </button>
                ))}
                <button
                  onClick={() => navigate(bookingUrl)}
                  className="py-3 rounded-xl text-[10px] font-bold border opacity-60"
                  style={{ background: 'transparent', borderColor: T.border, color: T.textSec }}
                >
                  Ver mais
                </button>
              </div>
            </div>
          </section>
        )}

        {/* SERVICES SECTION */}
        {services.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-60" style={{ color: T.textSec }}>Serviços Principais</h3>
              <button onClick={() => navigate(bookingUrl)} className="text-[10px] font-bold uppercase tracking-widest underline" style={{ color: T.accent }}>Ver todos</button>
            </div>
            <div className="space-y-3">
              {services.slice(0, 4).map(svc => (
                <div 
                  key={svc.id}
                  className="group p-4 rounded-3xl border flex items-center justify-between transition-all hover:border-accent"
                  style={{ background: T.card, borderColor: T.border }}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-background border">
                      {businessType === 'barbershop' ? <Scissors className="w-5 h-5" style={{ color: T.accent }} /> : <Sparkles className="w-5 h-5" style={{ color: T.accent }} />}
                    </div>
                    <div>
                      <p className="text-sm font-bold" style={{ color: T.text }}>{svc.name}</p>
                      <p className="text-[10px] font-medium opacity-50" style={{ color: T.textSec }}>{svc.duration_minutes} min</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* REVIEWS SECTION */}
        {reviews.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-sm font-bold uppercase tracking-wider opacity-60" style={{ color: T.textSec }}>O que dizem os clientes</h3>
              <button onClick={() => setShowAllReviews(true)} className="text-[10px] font-bold uppercase tracking-widest underline" style={{ color: T.accent }}>{totalReviews} avaliações</button>
            </div>
            <div className="space-y-4">
              {reviews.slice(0, 2).map((rev, i) => (
                <div 
                  key={i}
                  className="p-5 rounded-3xl border relative"
                  style={{ background: T.card, borderColor: T.border }}
                >
                  <div className="flex items-center gap-1 mb-3">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                    ))}
                  </div>
                  <p className="text-sm italic leading-relaxed mb-4 opacity-80" style={{ color: T.text }}>"{rev.comment || 'Atendimento excelente, super recomendo!'}"</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                        {rev.client_display_name?.charAt(0) || 'C'}
                      </div>
                      <span className="text-xs font-bold" style={{ color: T.text }}>{rev.client_display_name || 'Cliente'}</span>
                    </div>
                    <ShieldCheck className="w-4 h-4 text-emerald-500 opacity-50" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* CONFIDENCE ICONS / FOOTER */}
        <section className="pt-8 pb-12 text-center space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-2 justify-center opacity-60">
              <ShieldCheck className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Profissional Certificado</span>
            </div>
            <div className="flex items-center gap-2 justify-center opacity-60">
              <Heart className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Satisfação Garantida</span>
            </div>
          </div>
          
          <div className="opacity-40">
            <PlatformBranding isDark={isDark} />
          </div>
        </section>
      </main>

      {/* FLOATING ACTION BAR MOBILE */}
      <div className="fixed bottom-0 left-0 right-0 p-4 z-50 pointer-events-none">
        <div className="max-w-md mx-auto flex gap-3 pointer-events-auto">
          <Button 
            onClick={() => navigate(bookingUrl)}
            className="flex-1 h-14 rounded-2xl text-base font-black shadow-2xl shadow-accent/20"
            style={{ background: T.accent, color: T.bg }}
          >
            AGENDAR COM {professional.name.split(' ')[0].toUpperCase()}
          </Button>
          {whatsappDigits && (
            <a
              href={buildWhatsAppUrl(whatsappDigits, `Olá ${professional.name}! Gostaria de tirar uma dúvida.`)}
              className="w-14 h-14 rounded-2xl flex items-center justify-center bg-emerald-500 text-white shadow-2xl shadow-emerald-500/20"
            >
              <MessageCircle className="w-6 h-6" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
