import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Share2, Check, Calendar, Clock, Instagram, Sparkles, Scissors } from 'lucide-react';
import { LocationBlock, buildMapsUrl } from '@/components/LocationBlock';
import { SEOHead } from '@/components/SEOHead';
import { format, addDays, startOfDay, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type BlockedTime, type ExistingAppointment } from '@/lib/availability-engine';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PlatformBranding } from '@/components/PlatformBranding';
import { getCompanyBranding, buildThemeFromBranding, useApplyBranding } from '@/hooks/useCompanyBranding';

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

  useEffect(() => { if (slug && professionalSlug) load(); }, [slug, professionalSlug]);

  const load = async () => {
    setLoading(true);
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) { setLoading(false); return; }

    // Fetch full company data from public_company view for address/cover fields
    const { data: fullCompanyData } = await supabase.from('public_company' as any).select('*').eq('id', comp.id).single();
    const companyFull = { ...comp, ...((fullCompanyData as any) || {}) };
    setCompany(companyFull);
    setBusinessType(companyFull.business_type || 'barbershop');

    const { data: pubProfs } = await supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('slug', professionalSlug!);
    const prof = (pubProfs as any[])?.[0];
    if (!prof) { setLoading(false); return; }
    setProfessional(prof);

    const { data: profileData } = await supabase.from('profiles').select('bio, social_links, whatsapp, avatar_url, banner_url').eq('id', prof.id).maybeSingle();
    setProfile(profileData);

    // Services
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
    const { data: allReviewsData } = await supabase.from('reviews').select('rating, comment, created_at').eq('professional_id', prof.id).order('created_at', { ascending: false });
    if (allReviewsData) {
      setReviews(allReviewsData);
      setTotalReviews(allReviewsData.length);
    }

    // Completed appointments count
    const { count } = await supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('professional_id', prof.id).eq('status', 'completed');
    setCompletedCount(count || 0);

    // Fetch company settings for branding
    const { data: csData } = await supabase.from('company_settings' as any).select('primary_color, secondary_color, background_color').eq('company_id', comp.id).single();
    if (csData) setCompanySettings(csData);

    // Next available slots
    await fetchNextSlots(comp, prof);
    setLoading(false);
  };

  const fetchNextSlots = async (comp: any, prof: any) => {
    setSlotsLoading(true);
    const [hoursRes, exceptionsRes, companyRes, settingsRes, profHoursRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('public_company' as any).select('buffer_minutes').eq('id', comp.id).single(),
      supabase.from('company_settings' as any).select('timezone, booking_buffer_minutes').eq('company_id', comp.id).single(),
      supabase.from('professional_working_hours' as any).select('*').eq('professional_id', prof.id),
    ]);

    const bh = (hoursRes.data || []) as BusinessHours[];
    const exc = (exceptionsRes.data || []) as BusinessException[];
    let buf = (companyRes.data as any)?.buffer_minutes || 0;
    const tz = (settingsRes.data as any)?.timezone || DEFAULT_TZ;
    if ((settingsRes.data as any)?.booking_buffer_minutes > 0) buf = (settingsRes.data as any).booking_buffer_minutes;
    const ph = ((profHoursRes.data as any[]) || []).length > 0 ? (profHoursRes.data as unknown as BusinessHours[]) : undefined;

    const avgDur = services.length > 0 ? Math.round(services.reduce((s, sv) => s + (sv.duration_minutes || 30), 0) / services.length) : 30;

    const now = new Date();
    for (let i = 0; i < 14; i++) {
      const day = addDays(startOfDay(new Date()), i);
      const dateStr = format(day, 'yyyy-MM-dd');
      const { data: aptData } = await (supabase as any).rpc('get_booking_appointments', { p_company_id: comp.id, p_professional_id: prof.id, p_selected_date: dateStr, p_timezone: tz });
      const apts = ((aptData as ExistingAppointment[]) || []).map(a => ({ start_time: a.start_time, end_time: a.end_time }));
      const { data: blockedData } = await supabase.from('blocked_times' as any).select('block_date, start_time, end_time').eq('company_id', comp.id).eq('professional_id', prof.id).eq('block_date', dateStr);

      let slots = calculateAvailableSlots({ date: day, totalDuration: avgDur, businessHours: bh, exceptions: exc, existingAppointments: apts, slotInterval: 15, bufferMinutes: buf, professionalHours: ph, blockedTimes: ((blockedData || []) as unknown as BlockedTime[]), professionalId: prof.id });
      slots = filterOverlapping(slots, apts, avgDur, buf, tz);
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

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: `${professional?.name} - ${company?.name}`, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const bookingUrl = company && professionalSlug
    ? `/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}`
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
    <div className="min-h-screen" style={{ background: T.bg }}>
      <SEOHead
        title={seoTitle}
        description={seoDescription}
        ogTitle={seoTitle}
        ogDescription={seoDescription}
        ogImage={professional.avatar_url || company.logo_url}
        canonical={`${window.location.origin}/barbearia/${slug}/${professionalSlug}`}
      />
      {/* Banner - professional banner first, fallback to company cover */}
      {(professional?.banner_url || company?.cover_url) && (
        <div className="w-full max-w-md mx-auto h-36 md:h-48 overflow-hidden">
          <img src={professional?.banner_url || company?.cover_url} alt="Banner" className="w-full h-full object-cover" />
        </div>
      )}
      <div className="max-w-md mx-auto px-4 flex flex-col items-center gap-6" style={{ paddingTop: (professional?.banner_url || company?.cover_url) ? '1rem' : '2rem', paddingBottom: '2rem' }}>

        {/* Avatar */}
        <div className="relative" style={{ marginTop: (professional?.banner_url || company?.cover_url) ? '-3rem' : '0' }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={professional.name} className="w-28 h-28 rounded-full object-cover border-4" style={{ borderColor: T.accent }} />
          ) : (
            <div className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
              {professional.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name & Company */}
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: T.text }}>{professional.name}</h1>
          <p className="text-sm mt-1" style={{ color: T.textSec }}>{company.name}</p>
        </div>

        {/* Rating & Completed Count */}
        <div className="flex flex-col items-center gap-1">
          {rating && rating.count > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} className={cn("w-4 h-4", i <= Math.round(rating.avg) ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                ))}
              </div>
              <span className="text-sm font-medium" style={{ color: T.accent }}>{rating.avg.toFixed(1)}</span>
              <span className="text-xs" style={{ color: T.textSec }}>({rating.count} avaliações)</span>
            </div>
          )}
          {completedCount > 0 && (
            <span className="text-xs font-medium" style={{ color: T.textSec }}>
              ✂️ {completedCount} cortes realizados
            </span>
          )}
        </div>

        {/* Bio */}
        {profile?.bio && (
          <p className="text-center text-sm leading-relaxed max-w-xs" style={{ color: isDark ? '#D1D5DB' : '#4B5563' }}>
            {profile.bio}
          </p>
        )}

        {/* Next Available Slot - Highlighted */}
        {nextAvailable && nextAvailable.slots.length > 0 && (
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🔥</span>
              <h3 className="text-sm font-semibold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Próximo horário disponível</h3>
            </div>

            {/* Primary highlighted slot */}
            <div
              className="rounded-xl p-4 border-2 mb-3"
              style={{
                background: isDark ? 'rgba(245,158,11,0.08)' : 'rgba(217,119,6,0.06)',
                borderColor: isDark ? '#F59E0B' : '#D97706',
              }}
            >
              <p className="text-lg font-bold text-center capitalize" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
                {nextAvailable.label} • {nextAvailable.slots[0]}
              </p>
              <Button
                onClick={() => navigate(`${bookingUrl}?date=${format(nextAvailable.date, 'yyyy-MM-dd')}&time=${nextAvailable.slots[0]}`)}
                className="w-full h-11 mt-3 text-sm font-semibold rounded-xl shadow-lg"
                style={{ background: isDark ? '#F59E0B' : '#D97706', color: '#0B132B' }}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Agendar este horário
              </Button>
            </div>

            {/* Secondary slots */}
            {nextAvailable.slots.length > 1 && (
              <div className="flex gap-2">
                {nextAvailable.slots.slice(1, 3).map(time => (
                  <button
                    key={time}
                    onClick={() => navigate(`${bookingUrl}?date=${format(nextAvailable.date, 'yyyy-MM-dd')}&time=${time}`)}
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: isDark ? 'rgba(245,158,11,0.15)' : 'rgba(217,119,6,0.1)',
                      color: isDark ? '#F59E0B' : '#D97706',
                      border: `1px solid ${isDark ? 'rgba(245,158,11,0.25)' : 'rgba(217,119,6,0.2)'}`,
                    }}
                  >
                    {time}
                  </button>
                ))}
              </div>
            )}
            {nextAvailable.slots.length > 3 && (
              <button
                onClick={() => navigate(`${bookingUrl}?date=${format(nextAvailable.date, 'yyyy-MM-dd')}`)}
                className="w-full text-xs mt-2 py-1"
                style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}
              >
                +{nextAvailable.slots.length - 3} horários disponíveis →
              </button>
            )}
          </div>
        )}

        {/* Primary CTA */}
        <Button
          onClick={() => navigate(bookingUrl)}
          className="w-full max-w-xs h-12 text-base font-semibold rounded-xl shadow-lg"
          style={{ background: isDark ? '#F59E0B' : '#D97706', color: '#0B132B' }}
        >
          <Calendar className="w-5 h-5 mr-2" />
          Agendar horário
        </Button>

        {/* WhatsApp CTA */}
        {whatsappDigits && (
          <a
            href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá ${professional.name}! Vi seu perfil e gostaria de agendar um horário.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full max-w-xs flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
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

        {/* Secondary Buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          {instagramUrl && (
            <a
              href={instagramUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: isDark ? '#1F2937' : '#E5E7EB',
                background: isDark ? '#111827' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#1F2937',
              }}
            >
              <Instagram className="w-4 h-4" style={{ color: '#E1306C' }} />
              Instagram
            </a>
          )}


          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
            style={{
              borderColor: isDark ? '#1F2937' : '#E5E7EB',
              background: isDark ? '#111827' : '#FFFFFF',
              color: isDark ? '#FFFFFF' : '#1F2937',
            }}
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Link copiado!' : 'Compartilhar perfil'}
          </button>
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              {isDark ? <Scissors className="w-4 h-4" style={{ color: '#F59E0B' }} /> : <Sparkles className="w-4 h-4" style={{ color: '#D97706' }} />}
              <h3 className="text-sm font-semibold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Serviços</h3>
            </div>
            <div className="flex flex-col gap-2">
              {services.map(svc => (
                <div
                  key={svc.id}
                  className="flex items-center justify-between p-3 rounded-xl border"
                  style={{
                    background: isDark ? '#111827' : '#FFFFFF',
                    borderColor: isDark ? '#1F2937' : '#E5E7EB',
                  }}
                >
                  <div>
                    <p className="text-sm font-medium" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{svc.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock className="w-3 h-3" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }} />
                      <span className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>{svc.duration_minutes}min</span>
                    </div>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: isDark ? '#F59E0B' : '#D97706' }}>
                    R$ {Number(svc.price).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        {reviews.length > 0 && (
          <div className="w-full max-w-xs">
            <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>
              Avaliações ({totalReviews})
            </h3>
            <div className="flex flex-col gap-3">
              {displayedReviews.map((rev, i) => (
                <div
                  key={i}
                  className="p-3 rounded-xl border"
                  style={{
                    background: isDark ? '#111827' : '#FFFFFF',
                    borderColor: isDark ? '#1F2937' : '#E5E7EB',
                  }}
                >
                  <div className="flex items-center gap-1 mb-1">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} className={cn("w-3 h-3", s <= rev.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
                    ))}
                    <span className="text-xs ml-2" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
                      {format(new Date(rev.created_at), 'dd/MM/yyyy')}
                    </span>
                  </div>
                  {rev.comment && (
                    <p className="text-xs leading-relaxed" style={{ color: isDark ? '#D1D5DB' : '#4B5563' }}>
                      "{rev.comment}"
                    </p>
                  )}
                </div>
              ))}
            </div>
            {totalReviews > 3 && !showAllReviews && (
              <button
                onClick={() => setShowAllReviews(true)}
                className="w-full text-xs font-medium mt-3 py-2 rounded-lg transition-colors hover:opacity-80"
                style={{ color: isDark ? '#F59E0B' : '#D97706' }}
              >
                Ver todas avaliações ({totalReviews})
              </button>
            )}
          </div>
        )}

        {/* Location */}
        <div className="w-full max-w-xs">
          <LocationBlock company={company} isDark={isDark} />
        </div>

        {/* Footer */}
        <div className="flex flex-col items-center gap-2 mt-4">
          {company.logo_url ? (
            <img src={company.logo_url} alt={company.name} className="max-h-[40px] object-contain" />
          ) : (
            <p className="text-xs font-medium" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
              {company.name}
            </p>
          )}
          <PlatformBranding isDark={isDark} />
        </div>
      </div>
    </div>
  );
}
