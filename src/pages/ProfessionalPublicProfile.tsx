import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Star, MessageCircle, MapPin, Share2, Copy, Check, Calendar, Clock, DollarSign, Instagram, Sparkles, Scissors, Zap } from 'lucide-react';
import { format, addDays, startOfDay, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type BlockedTime, type ExistingAppointment } from '@/lib/availability-engine';

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
  const [weekSlots, setWeekSlots] = useState<{ date: Date; slots: string[] }[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (slug && professionalSlug) load(); }, [slug, professionalSlug]);

  const load = async () => {
    setLoading(true);
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) { setLoading(false); return; }
    setCompany(comp);
    setBusinessType(comp.business_type || 'barbershop');

    const { data: pubProfs } = await supabase.from('public_professionals' as any).select('*').eq('company_id', comp.id).eq('slug', professionalSlug!);
    const prof = (pubProfs as any[])?.[0];
    if (!prof) { setLoading(false); return; }
    setProfessional(prof);

    // Fetch profile details (bio, social_links, whatsapp) via profiles view
    const { data: profileData } = await supabase.from('profiles').select('bio, social_links, whatsapp, avatar_url').eq('id', prof.id).maybeSingle();
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

    // Reviews
    const { data: reviewsData } = await supabase.from('reviews').select('rating, comment, created_at').eq('professional_id', prof.id).order('created_at', { ascending: false }).limit(5);
    if (reviewsData) setReviews(reviewsData);

    // Next available slots
    await fetchNextSlots(comp, prof);
    setLoading(false);
  };

  const fetchNextSlots = async (comp: any, prof: any) => {
    setSlotsLoading(true);
    const [hoursRes, exceptionsRes, companyRes, settingsRes, profHoursRes] = await Promise.all([
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('companies').select('buffer_minutes').eq('id', comp.id).single(),
      supabase.from('company_settings' as any).select('timezone, booking_buffer_minutes').eq('company_id', comp.id).single(),
      supabase.from('professional_working_hours' as any).select('*').eq('professional_id', prof.id),
    ]);

    const bh = (hoursRes.data || []) as BusinessHours[];
    const exc = (exceptionsRes.data || []) as BusinessException[];
    let buf = (companyRes.data as any)?.buffer_minutes || 0;
    const tz = (settingsRes.data as any)?.timezone || DEFAULT_TZ;
    if ((settingsRes.data as any)?.booking_buffer_minutes > 0) buf = (settingsRes.data as any).booking_buffer_minutes;
    const ph = ((profHoursRes.data as any[]) || []).length > 0 ? (profHoursRes.data as unknown as BusinessHours[]) : undefined;

    // Use average service duration for slot preview
    const avgDur = services.length > 0 ? Math.round(services.reduce((s, sv) => s + (sv.duration_minutes || 30), 0) / services.length) : 30;

    const results: { date: Date; slots: string[] }[] = [];
    const now = new Date();
    for (let i = 0; i < 7; i++) {
      const day = addDays(startOfDay(new Date()), i);
      const dateStr = format(day, 'yyyy-MM-dd');
      const { data: aptData } = await (supabase as any).rpc('get_booking_appointments', { p_company_id: comp.id, p_professional_id: prof.id, p_selected_date: dateStr, p_timezone: tz });
      const apts = ((aptData as ExistingAppointment[]) || []).map(a => ({ start_time: a.start_time, end_time: a.end_time }));
      const { data: blockedData } = await supabase.from('blocked_times' as any).select('block_date, start_time, end_time').eq('company_id', comp.id).eq('professional_id', prof.id).eq('block_date', dateStr);

      let slots = calculateAvailableSlots({ date: day, totalDuration: avgDur, businessHours: bh, exceptions: exc, existingAppointments: apts, slotInterval: 15, bufferMinutes: buf, professionalHours: ph, blockedTimes: ((blockedData || []) as unknown as BlockedTime[]), professionalId: prof.id });
      slots = filterOverlapping(slots, apts, avgDur, buf, tz);
      if (isToday(day)) { const ct = format(now, 'HH:mm'); slots = slots.filter(s => s > ct); }
      results.push({ date: day, slots });
    }
    setWeekSlots(results);
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

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bookingUrl = company && professionalSlug
    ? `/${businessType === 'esthetic' ? 'estetica' : 'barbearia'}/${slug}/${professionalSlug}`
    : '#';

  const isDark = businessType === 'barbershop';
  const avatarUrl = profile?.avatar_url || professional?.avatar_url;
  const socialLinks = profile?.social_links as any;
  const instagramUrl = socialLinks?.instagram ? (socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram.replace('@', '')}`) : null;
  const whatsappNumber = profile?.whatsapp;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="w-24 h-24 rounded-full bg-gray-700" />
          <div className="h-4 w-32 bg-gray-700 rounded" />
        </div>
      </div>
    );
  }

  if (!professional || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: isDark ? '#0B132B' : '#FFF7ED' }}>
        <p className="text-lg" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>Profissional não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: isDark ? '#0B132B' : 'linear-gradient(180deg, #FFF7ED, #FFFFFF)' }}>
      <div className="max-w-md mx-auto px-4 py-8 flex flex-col items-center gap-6">

        {/* Avatar */}
        <div className="relative">
          {avatarUrl ? (
            <img src={avatarUrl} alt={professional.name} className="w-28 h-28 rounded-full object-cover border-4" style={{ borderColor: isDark ? '#F59E0B' : '#D97706' }} />
          ) : (
            <div className="w-28 h-28 rounded-full flex items-center justify-center text-3xl font-bold" style={{ background: isDark ? '#1F2937' : '#FED7AA', color: isDark ? '#F59E0B' : '#9A3412' }}>
              {professional.name?.charAt(0)?.toUpperCase()}
            </div>
          )}
        </div>

        {/* Name & Company */}
        <div className="text-center">
          <h1 className="text-2xl font-bold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>{professional.name}</h1>
          <p className="text-sm mt-1" style={{ color: isDark ? '#9CA3AF' : '#6B7280' }}>{company.name}</p>
        </div>

        {/* Rating */}
        {rating && rating.count > 0 && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <Star key={i} className={cn("w-4 h-4", i <= Math.round(rating.avg) ? "fill-yellow-400 text-yellow-400" : "text-gray-600")} />
              ))}
            </div>
            <span className="text-sm font-medium" style={{ color: isDark ? '#F59E0B' : '#D97706' }}>{rating.avg.toFixed(1)}</span>
            <span className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>({rating.count} avaliações)</span>
          </div>
        )}

        {/* Bio */}
        {profile?.bio && (
          <p className="text-center text-sm leading-relaxed max-w-xs" style={{ color: isDark ? '#D1D5DB' : '#4B5563' }}>
            {profile.bio}
          </p>
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

        {/* Secondary Buttons */}
        <div className="w-full max-w-xs flex flex-col gap-3">
          {whatsappNumber && (
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: isDark ? '#1F2937' : '#E5E7EB',
                background: isDark ? '#111827' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#1F2937',
              }}
            >
              <MessageCircle className="w-4 h-4" style={{ color: '#25D366' }} />
              WhatsApp
            </a>
          )}

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

          {company.address && (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(company.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border text-sm font-medium transition-colors hover:opacity-90"
              style={{
                borderColor: isDark ? '#1F2937' : '#E5E7EB',
                background: isDark ? '#111827' : '#FFFFFF',
                color: isDark ? '#FFFFFF' : '#1F2937',
              }}
            >
              <MapPin className="w-4 h-4" style={{ color: '#EF4444' }} />
              Localização
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

        {/* Next Available Slots */}
        {nextSlots.length > 0 && (
          <div className="w-full max-w-xs">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <h3 className="text-sm font-semibold" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Próximos horários</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {nextSlots.map(group =>
                group.slots.map(time => (
                  <button
                    key={`${format(group.date, 'yyyy-MM-dd')}-${time}`}
                    onClick={() => navigate(bookingUrl)}
                    className="px-3 py-2 rounded-lg text-xs font-medium transition-all hover:scale-105"
                    style={{
                      background: isDark ? 'rgba(245,158,11,0.12)' : 'rgba(217,119,6,0.1)',
                      color: isDark ? '#F59E0B' : '#D97706',
                      border: `1px solid ${isDark ? 'rgba(245,158,11,0.2)' : 'rgba(217,119,6,0.2)'}`,
                    }}
                  >
                    <span className="block text-[10px] opacity-70">
                      {isToday(group.date) ? 'Hoje' : format(group.date, "EEE, dd/MM", { locale: ptBR })}
                    </span>
                    {time}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {slotsLoading && (
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: isDark ? '#F59E0B' : '#D97706', borderTopColor: 'transparent' }} />
            <span className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>Carregando horários...</span>
          </div>
        )}

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
            <h3 className="text-sm font-semibold mb-3" style={{ color: isDark ? '#FFFFFF' : '#1F2937' }}>Avaliações</h3>
            <div className="flex flex-col gap-3">
              {reviews.map((rev, i) => (
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
          </div>
        )}

        {/* Footer */}
        <p className="text-xs mt-4" style={{ color: isDark ? '#4B5563' : '#9CA3AF' }}>
          {company.name}
        </p>
      </div>
    </div>
  );
}
