import { useEffect, useRef, useState, useMemo } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Scissors, Sparkles, Clock, DollarSign, ChevronRight, ChevronLeft, CheckCircle2, Bell, Zap, CalendarPlus, MessageCircle, RotateCcw, Home, User, Phone, Mail, Cake, MapPin, Star, X, AlertTriangle, Calendar, ChevronDown } from 'lucide-react';
import { format, addMinutes, addDays, startOfDay, isSameDay, parseISO, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, subWeeks, isToday, startOfMonth, endOfMonth, eachMonthOfInterval, setMonth, getYear } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { sendAppointmentCreatedWebhook } from '@/lib/automations';
import { isPromoActive } from '@/lib/promotion-period';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from '@/contexts/AuthContext';

const tzYmd = (d: Date, tz: string) =>
  format(toZonedTime(d, tz), 'yyyy-MM-dd');
const isTodayTz = (d: Date, tz = 'America/Sao_Paulo') =>
  tzYmd(d, tz) === tzYmd(new Date(), tz);
const isTomorrowTz = (d: Date, tz = 'America/Sao_Paulo') => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tzYmd(d, tz) === tzYmd(tomorrow, tz);
};
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp, displayWhatsApp, isValidWhatsApp, buildWhatsAppUrl, trackWhatsAppClick, normalizePhone } from '@/lib/whatsapp';
import { type BusinessHours, type BusinessException, type ExistingAppointment, type BookingMode } from '@/lib/availability-engine';
import { getAvailableSlots } from '@/lib/availability-service';
import { PlatformBranding } from '@/components/PlatformBranding';
import { CustomRequestForm } from '@/components/CustomRequestForm';
import { getCompanyBranding, buildThemeFromBranding } from '@/hooks/useCompanyBranding';
import { usePreselectedSlot } from '@/hooks/usePreselectedSlot';
import { Lock } from 'lucide-react';
import { BookingErrorDialog, translateBookingError, type BookingErrorInfo } from '@/components/BookingErrorDialog';

const StarRating = ({ rating, size = 14 }: { rating: number; size?: number }) => {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => {
        const fill = rating >= s ? 1 : rating >= s - 0.5 ? 0.5 : 0;
        return (
          <svg key={s} width={size} height={size} viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id={`star-fill-${s}-${size}`}>
                <stop offset={`${fill * 100}%`} stopColor="#FDBA2D" />
                <stop offset={`${fill * 100}%`} stopColor="#374151" />
              </linearGradient>
            </defs>
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill={`url(#star-fill-${s}-${size})`} />
          </svg>
        );
      })}
    </div>
  );
};

const InteractiveStarRating = ({ rating, onRate, size = 32 }: { rating: number; onRate: (r: number) => void; size?: number }) => {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button key={s} onClick={() => onRate(s)} className="transition-all hover:scale-110">
          <Star
            style={{ width: size, height: size, color: s <= rating ? '#FDBA2D' : '#374151', fill: s <= rating ? '#FDBA2D' : 'none' }}
          />
        </button>
      ))}
    </div>
  );
};

type Step = 'services' | 'professional' | 'datetime' | 'confirm' | 'success';
type BusinessType = 'barbershop' | 'esthetic';

interface BookingPageProps {
  routeBusinessType?: BusinessType;
  customSlug?: string;
}

const DEFAULT_BOOKING_TIMEZONE = 'America/Sao_Paulo';

const formatSlotTime = (dateInput: string | Date) => {
  if (typeof dateInput === 'string' && /^\d{2}:\d{2}$/.test(dateInput)) {
    return dateInput;
  }

  const date = new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return typeof dateInput === 'string' ? dateInput : '';
  }

  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${hours}:${minutes}`;
};

const buildBookingUtcRange = (date: Date, time: string, durationMinutes: number, timezone: string) => {
  const [hours, minutes] = time.split(':').map(Number);
  const localDate = format(date, 'yyyy-MM-dd');
  const wallClock = `${localDate} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
  const start = fromZonedTime(wallClock, timezone);
  const end = addMinutes(start, durationMinutes);

  return { start, end };
};

const DEFAULT_T = {
  bg: '#0B132B',
  card: '#111827',
  cardHover: '#1a2332',
  accent: '#F59E0B',
  accentHover: '#D97706',
  text: '#FFFFFF',
  textSec: '#9CA3AF',
  border: '#1F2937',
  green: 'rgba(34,197,94,0.15)',
  greenText: '#4ADE80',
};

interface PromotionInfo {
  id: string;
  title: string;
  description: string | null;
  service_id: string | null;
  service_ids: string[] | null;
  service_name: string | null;
  service_duration: number | null;
  promotion_price: number | null;
  original_price: number | null;
  discount_type: string;
  discount_value: number | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  max_slots: number;
  used_slots: number;
  professional_ids: string[] | null;
  professional_filter: string;
  promotion_type?: string;
  cashback_validity_days?: number | null;
  cashback_rules_text?: string | null;
}

const BookingPage = ({ routeBusinessType, customSlug }: BookingPageProps) => {
  const { slug: paramSlug, professionalSlug } = useParams<{ slug: string; professionalSlug?: string }>();
  const slug = customSlug || paramSlug;
  const [searchParams] = useSearchParams();
  const preselected = usePreselectedSlot();
  const promoIdRef = useRef(searchParams.get('promo'));
  const [company, setCompany] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [noProfessionals, setNoProfessionals] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [exceptions, setExceptions] = useState<BusinessException[]>([]);
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [bookingMode, setBookingMode] = useState<BookingMode>('fixed_grid');
  const [fixedSlotInterval, setFixedSlotInterval] = useState(15);
  const [professionalHours, setProfessionalHours] = useState<BusinessHours[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [professionalRatings, setProfessionalRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [recentBookings, setRecentBookings] = useState<number | null>(null);
  const [companyStats, setCompanyStats] = useState<{ avgRating: number; reviewCount: number; completedCount: number } | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [isWhitelabel, setIsWhitelabel] = useState(false);
  const [showCustomRequestForm, setShowCustomRequestForm] = useState(false);
  const [allowCustomRequests, setAllowCustomRequests] = useState(false);
  const [promoData, setPromoData] = useState<PromotionInfo | null>(null);
  const isPromoMode = !!promoData;

  const [step, setStep] = useState<Step>('services');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState<BookingErrorInfo | null>(null);
  const [clientForm, setClientForm] = useState({ full_name: '', email: '', whatsapp: '', birth_date: '' });
  const skipTimeResetRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [appointmentsForSelectedDate, setAppointmentsForSelectedDate] = useState<ExistingAppointment[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistSuccess, setWaitlistSuccess] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ name: '', whatsapp: '', email: '' });
  const [nextSlots, setNextSlots] = useState<{ date: Date; slots: string[] }[]>([]);
  const [nextSlotsLoading, setNextSlotsLoading] = useState(false);
  const [smartSuggestion, setSmartSuggestion] = useState<{ date: Date; slot: string; reason: 'tight-fit' | 'first-available' } | null>(null);
  const [quickSlotSelected, setQuickSlotSelected] = useState(false);
  const [cashbackCredits, setCashbackCredits] = useState<{ id: string; amount: number; expires_at: string }[]>([]);
  const [useCashback, setUseCashback] = useState(false);
  const cashbackTotal = cashbackCredits.reduce((s, c) => s + Number(c.amount), 0);
  const [autoCashbackPromos, setAutoCashbackPromos] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(0);
  const slotRequestRef = useRef(0);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { locale: ptBR }));

  const [bookingResult, setBookingResult] = useState<{
    appointmentId: string;
    success?: boolean;
    professionalName?: string;
    professionalAvatar?: string | null;
    serviceNames?: string[];
    date?: Date;
    time?: string;
    totalPrice?: number;
    totalDuration?: number;
    companyName?: string;
    companyPhone?: string | null;
    companyAddress?: string | null;
    companyCity?: string | null;
    companyState?: string | null;
    companyPostalCode?: string | null;
  } | null>(null);

  const isDark = businessType === 'barbershop';
  const bookingTimezone = companySettings?.timezone || DEFAULT_BOOKING_TIMEZONE;

  const T = useMemo(() => {
    const branding = getCompanyBranding(companySettings, isDark);
    const theme = buildThemeFromBranding(branding, isDark);
    return {
      bg: theme.bg,
      card: theme.card,
      cardHover: isDark ? (() => { const r = Math.min(255, parseInt(theme.card.slice(1, 3), 16) + 10); const g = Math.min(255, parseInt(theme.card.slice(3, 5), 16) + 10); const b = Math.min(255, parseInt(theme.card.slice(5, 7), 16) + 10); return `#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${b.toString(16).padStart(2,'0')}`; })() : '#F9FAFB',
      accent: theme.accent,
      accentHover: theme.accentHover,
      text: theme.text,
      textSec: theme.textSec,
      border: theme.border,
      green: 'rgba(34,197,94,0.15)',
      greenText: '#4ADE80',
    };
  }, [companySettings, isDark]);

  useEffect(() => {
    if (slug) {
      fetchCompany().then((comp) => {
        if (!professionalSlug && !promoIdRef.current && comp?.id) {
          fetchProfessionals(comp.id);
        }
      });
    }
  }, [slug, professionalSlug]);

  useEffect(() => {
    if (company?.id && !professionalSlug && !promoIdRef.current) {
      fetchProfessionals(company.id);
    }
  }, [selectedServices, company?.id]);

  const fetchCompany = async () => {
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) return null;
    setCompany(comp);

    const resolvedType: BusinessType = routeBusinessType || comp.business_type || 'barbershop';
    setBusinessType(resolvedType);

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
    } catch { }

    const [servicesRes, hoursRes, exceptionsRes, companyRes, settingsRes] = await Promise.all([
      supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('public_company' as any).select('buffer_minutes, booking_mode, fixed_slot_interval, allow_custom_requests').eq('id', comp.id).single(),
      supabase.from('public_company_settings' as any).select('*').eq('company_id', comp.id).single(),
    ]);

    if (servicesRes.data) setServices(servicesRes.data);
    if (hoursRes.data) setBusinessHours(hoursRes.data as BusinessHours[]);
    if (exceptionsRes.data) setExceptions(exceptionsRes.data as BusinessException[]);
    if (companyRes.data) {
      setBufferMinutes((companyRes.data as any).buffer_minutes || 0);
      setBookingMode(((companyRes.data as any).booking_mode as BookingMode) || 'hybrid');
      setFixedSlotInterval((companyRes.data as any).fixed_slot_interval || 15);
      setAllowCustomRequests((companyRes.data as any).allow_custom_requests || false);
    }
    if (settingsRes.data) {
      setCompanySettings(settingsRes.data);
      if ((settingsRes.data as any).booking_buffer_minutes > 0) {
        setBufferMinutes((settingsRes.data as any).booking_buffer_minutes);
      }
    }

    const { data: ratingsData } = await supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id });
    if (ratingsData && Array.isArray(ratingsData)) {
      const ratingsMap: Record<string, { avg: number; count: number }> = {};
      for (const r of ratingsData as any[]) {
        ratingsMap[r.professional_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
      }
      setProfessionalRatings(ratingsMap);
    }

    const [reviewsRes, completedRes] = await Promise.all([
      supabase.from('reviews').select('rating').eq('company_id', comp.id),
      supabase.from('appointments').select('id', { count: 'exact', head: true }).eq('company_id', comp.id).eq('status', 'completed'),
    ]);
    const reviews = reviewsRes.data || [];
    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0 ? reviews.reduce((sum: number, r: any) => sum + Number(r.rating), 0) / reviewCount : 0;
    const completedCount = completedRes.count || 0;
    if (reviewCount > 0 || completedCount > 0) {
      setCompanyStats({ avgRating, reviewCount, completedCount });
    }

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: cbPromos } = await supabase
        .from('promotions')
        .select('id, promotion_type, discount_type, discount_value, cashback_validity_days, service_id, service_ids, professional_filter, professional_ids')
        .eq('company_id', comp.id)
        .eq('promotion_type', 'cashback')
        .eq('status', 'active')
        .lte('start_date', today)
        .gte('end_date', today);
      if (cbPromos) setAutoCashbackPromos(cbPromos);
    } catch { }

    if (!professionalSlug && !promoIdRef.current) {
      const { data: allProfs } = await supabase
        .from('public_professionals' as any)
        .select('id')
        .eq('company_id', comp.id)
        .eq('active', true)
        .limit(1);
      if (!allProfs || (allProfs as any[]).length === 0) {
        setNoProfessionals(true);
        return;
      }
    }

    if (professionalSlug) {
      const { data: pubProfs } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', comp.id)
        .eq('slug', professionalSlug);

      if (pubProfs && (pubProfs as any[]).length > 0) {
        const prof = (pubProfs as any[])[0];
        const profileId = prof.id as string;
        setSelectedProfessional(profileId);

        const { data: profServices } = await supabase
          .from('service_professionals')
          .select('service_id, price_override')
          .eq('professional_id', profileId);

        if (profServices && profServices.length > 0) {
          const profServiceIds = profServices.map((ps: any) => ps.service_id);
          const filteredServices = (servicesRes.data || []).filter((s: any) => profServiceIds.includes(s.id));
          const withOverrides = filteredServices.map((s: any) => {
            const override = profServices.find((ps: any) => ps.service_id === s.id);
            return override?.price_override != null ? { ...s, price: override.price_override } : s;
          });
          setServices(withOverrides);
        }

        const { data: profHours } = await supabase
          .from('professional_working_hours' as any)
          .select('*')
          .eq('professional_id', profileId);
        if (profHours && (profHours as any[]).length > 0) {
          setProfessionalHours(profHours as unknown as BusinessHours[]);
        }

        setProfessionals([{ id: prof.id, full_name: prof.name, avatar_url: prof.avatar_url }]);
      }
    }

    if (promoIdRef.current) {
      const { data: promos } = await supabase
        .from('public_promotions' as any)
        .select('*')
        .eq('id', promoIdRef.current)
        .limit(1);
      const pd = (promos as any)?.[0];
      if (pd && pd.company_id === comp.id && isPromoActive(pd)) {
        setPromoData(pd as PromotionInfo);
        const promoServiceIds = pd.service_ids || (pd.service_id ? [pd.service_id] : []);
        if (promoServiceIds.length > 0) {
          setSelectedServices(promoServiceIds);
        }
        if (pd.start_date) {
          const pDate = parseISO(pd.start_date);
          if (pDate >= startOfDay(new Date())) {
            setSelectedDate(pDate);
          }
        }
        const targetProfs = pd.professional_ids || [];
        if (targetProfs.length > 0) {
          const profId = targetProfs[0];
          setSelectedProfessional(profId);
          const { data: profHoursData } = await supabase
            .from('professional_working_hours' as any)
            .select('*')
            .eq('professional_id', profId);
          if (profHoursData && (profHoursData as any[]).length > 0) {
            setProfessionalHours(profHoursData as unknown as BusinessHours[]);
          }
          const { data: promoProfs } = await supabase
            .from('public_professionals' as any)
            .select('*')
            .eq('company_id', comp.id)
            .in('id', targetProfs);
          if (promoProfs) {
            setProfessionals((promoProfs as any[]).map((p: any) => ({
              id: p.id, name: p.name, full_name: p.name, avatar_url: p.avatar_url, slug: p.slug,
            })));
          }
        }
        if (pd.professional_ids?.length === 1) {
          setStep('datetime');
        } else if (pd.professional_ids?.length > 1) {
          setStep('professional');
        } else {
          setStep('datetime');
        }
      }
      promoIdRef.current = null;
    }
  };

  const fetchProfessionals = async (compId?: string): Promise<any[]> => {
    const targetCompanyId = compId || company?.id;
    if (!targetCompanyId) return [];

    const { data: pubProfs } = await supabase
      .from('public_professionals' as any)
      .select('*')
      .eq('company_id', targetCompanyId)
      .eq('active', true);

    let allProfs = ((pubProfs as any[]) || []).map((p: any) => ({
      id: p.id,
      name: p.name || 'Profissional',
      full_name: p.name || 'Profissional',
      avatar_url: p.avatar_url || null,
      slug: p.slug,
    }));

    let mappedProfs: any[] = [];

    if (selectedServices.length > 0) {
      const { data: spData } = await supabase
        .from('service_professionals')
        .select('professional_id, service_id')
        .in('service_id', selectedServices);

      if (spData && spData.length > 0) {
        const profServiceMap = new Map<string, Set<string>>();
        for (const sp of spData) {
          if (!profServiceMap.has(sp.professional_id)) {
            profServiceMap.set(sp.professional_id, new Set());
          }
          profServiceMap.get(sp.professional_id)!.add(sp.service_id);
        }
        const linkedProfIds = [...profServiceMap.entries()]
          .filter(([, serviceIds]) => selectedServices.every((sid) => serviceIds.has(sid)))
          .map(([pid]) => pid);
        mappedProfs = allProfs.filter((p) => linkedProfIds.includes(p.id));
      }

      if (mappedProfs.length === 0) {
        mappedProfs = allProfs;
        const autoLinks: any[] = [];
        for (const prof of mappedProfs) {
          for (const svcId of selectedServices) {
            autoLinks.push({ service_id: svcId, professional_id: prof.id, company_id: targetCompanyId });
          }
        }
        if (autoLinks.length > 0) {
          try {
            await supabase.from('service_professionals').insert(autoLinks as any);
          } catch (e) { }
        }
      }
    } else {
      mappedProfs = allProfs;
    }

    setProfessionals(mappedProfs);

    if (mappedProfs.length === 1 && !selectedProfessional) {
      setSelectedProfessional(mappedProfs[0].id);
      fetchProfessionalHours(mappedProfs[0].id);
    }

    return mappedProfs;
  };

  const fetchProfessionalHours = async (profileId: string) => {
    const [hoursRes, configRes] = await Promise.all([
      supabase
        .from('professional_working_hours' as any)
        .select('*')
        .eq('professional_id', profileId),
      supabase
        .from('public_professionals' as any)
        .select('booking_mode, grid_interval, break_time')
        .eq('id', profileId)
        .single(),
    ]);
    if (hoursRes.data && (hoursRes.data as any[]).length > 0) {
      setProfessionalHours(hoursRes.data as unknown as BusinessHours[]);
    } else {
      setProfessionalHours([]);
    }
    if (configRes.data) {
      const cfg = configRes.data as any;
      if (cfg.booking_mode) setBookingMode(cfg.booking_mode as BookingMode);
      if (cfg.grid_interval) setFixedSlotInterval(cfg.grid_interval);
      if (cfg.break_time != null) setBufferMinutes(cfg.break_time);
    }
  };

  const totalDuration = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);

  const isCashbackPromo = isPromoMode && promoData?.promotion_type === 'cashback';

  const totalPrice = (() => {
    if (isCashbackPromo) {
      return services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0);
    }
    if (!isPromoMode || !promoData) {
      return services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0);
    }
    const promoServiceIds = promoData.service_ids || (promoData.service_id ? [promoData.service_id] : []);
    if (promoData.discount_type === 'fixed_price' && promoData.promotion_price != null && promoServiceIds.length <= 1) {
      return Number(promoData.promotion_price);
    }
    return services.filter(s => selectedServices.includes(s.id)).reduce((sum, s) => {
      if (promoServiceIds.includes(s.id)) {
        const orig = Number(s.price);
        if (promoData.discount_type === 'percentage' && promoData.discount_value) {
          return sum + orig * (1 - Number(promoData.discount_value) / 100);
        } else if (promoData.discount_type === 'fixed_amount' && promoData.discount_value) {
          return sum + Math.max(0, orig - Number(promoData.discount_value));
        } else if (promoData.discount_type === 'fixed_price' && promoData.promotion_price != null) {
          return sum + Number(promoData.promotion_price);
        }
      }
      return sum + Number(s.price);
    }, 0);
  })();

  const cashbackEarnAmount = (() => {
    if (isCashbackPromo && promoData) {
      const promoServiceIds = promoData.service_ids || (promoData.service_id ? [promoData.service_id] : []);
      const promoServicesTotal = services
        .filter(s => selectedServices.includes(s.id) && promoServiceIds.includes(s.id))
        .reduce((sum, s) => sum + Number(s.price), 0);
      if (promoData.discount_type === 'percentage' && promoData.discount_value) {
        return promoServicesTotal * Number(promoData.discount_value) / 100;
      } else if (promoData.discount_type === 'fixed_amount' && promoData.discount_value) {
        return Number(promoData.discount_value);
      }
      return 0;
    }
    if (!isPromoMode && autoCashbackPromos.length > 0 && selectedProfessional && selectedServices.length > 0) {
      let total = 0;
      for (const promo of autoCashbackPromos) {
        if (promo.professional_filter === 'specific' && promo.professional_ids) {
          if (!promo.professional_ids.includes(selectedProfessional)) continue;
        }
        const promoServiceIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
        const eligible = services
          .filter(s => selectedServices.includes(s.id) && (promoServiceIds.length === 0 || promoServiceIds.includes(s.id)));
        if (eligible.length === 0) continue;
        const eligibleTotal = eligible.reduce((sum, s) => sum + Number(s.price), 0);
        if (promo.discount_type === 'percentage' && promo.discount_value) {
          total += eligibleTotal * Number(promo.discount_value) / 100;
        } else if (promo.discount_type === 'fixed_amount' && promo.discount_value) {
          total += Number(promo.discount_value);
        }
      }
      return total;
    }
    return 0;
  })();

  const cashbackDiscount = useCashback ? Math.min(cashbackTotal, totalPrice) : 0;
  const finalPrice = Math.max(0, totalPrice - cashbackDiscount);

  const toggleService = (id: string) => {
    setSelectedServices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const calculateSlots = async (date: Date) => {
    if (!company || !selectedProfessional || businessHours.length === 0 || totalDuration <= 0) {
      setAvailableSlots([]);
      setSlotsLoading(false);
      return;
    }

    const requestId = ++slotRequestRef.current;
    setSlotsLoading(true);
    setAppointmentsLoaded(false);
    setAppointmentsForSelectedDate([]);
    setAvailableSlots([]);
    setGeneratedSlots([]);

    try {
      const result = await getAvailableSlots({
        source: 'public',
        companyId: company.id,
        professionalId: selectedProfessional,
        date,
        totalDuration,
        filterPastForToday: true,
        prefetchData: {
          businessHours,
          professionalHours,
          exceptions,
        }
      });

      if (requestId !== slotRequestRef.current) return;

      let slots = result.slots;

      if (promoData) {
        if (promoData.start_time) {
          slots = slots.filter(s => s >= promoData.start_time!);
        }
        if (promoData.end_time) {
          slots = slots.filter(s => s <= promoData.end_time!);
        }
      }

      setAppointmentsForSelectedDate(result.existingAppointments);
      setAppointmentsLoaded(true);
      setGeneratedSlots(slots);
      setAvailableSlots(slots);
    } catch (error) {
      setAppointmentsLoaded(true);
      setAvailableSlots([]);
      setGeneratedSlots([]);
    } finally {
      if (requestId === slotRequestRef.current) setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (preselected.isLockedTime(selectedTime)) {
    } else if (skipTimeResetRef.current) {
      skipTimeResetRef.current = false;
    } else {
      setSelectedTime(null);
    }
    setAppointmentsLoaded(false);
    setAppointmentsForSelectedDate([]);
    setAvailableSlots([]);
    setGeneratedSlots([]);
  }, [selectedDate, selectedProfessional, selectedServices, totalDuration]);

  useEffect(() => {
    if (selectedDate && selectedProfessional && company && businessHours.length > 0 && totalDuration > 0) {
      calculateSlots(selectedDate);
    }
  }, [selectedDate, selectedProfessional, selectedServices, totalDuration, company]);

  useEffect(() => {
    if (professionals.length === 1 && selectedProfessional !== professionals[0].id) {
      setSelectedProfessional(professionals[0].id);
      fetchProfessionalHours(professionals[0].id);
      if (step === 'professional') setStep(preselected.isActive() && selectedDate && selectedTime ? 'confirm' : 'datetime');
    }
  }, [professionals, selectedProfessional, step]);

  const fetchNextAvailableSlots = async () => {
    if (!company || !selectedProfessional || businessHours.length === 0 || totalDuration <= 0) {
      setNextSlots([]);
      setSmartSuggestion(null);
      return;
    }
    
    setNextSlotsLoading(true);
    const days = eachDayOfInterval({
      start: currentWeekStart,
      end: addDays(currentWeekStart, 6)
    });
    
    if (selectedDate && !days.some(d => isSameDay(d, selectedDate))) {
      days.push(selectedDate);
    }
    
    try {
      const dayResults = await Promise.all(
        days.map(day => 
          getAvailableSlots({
            source: 'public',
            companyId: company.id,
            professionalId: selectedProfessional,
            date: day,
            totalDuration,
            filterPastForToday: true,
            prefetchData: {
              businessHours,
              professionalHours,
              exceptions,
            }
          }).then(res => ({ date: day, slots: res.slots }))
        )
      );

      const results: { date: Date; slots: string[] }[] = [];
      let suggestion: { date: Date; slot: string; reason: 'tight-fit' | 'first-available' } | null = null;

      const getFirstSlot = (res: { date: Date; slots: string[] }) => {
        let slots = res.slots;
        if (promoData) {
          if (promoData.start_time) slots = slots.filter(s => s >= promoData.start_time!);
          if (promoData.end_time) slots = slots.filter(s => s <= promoData.end_time!);
        }
        return slots.length > 0 ? slots[0] : null;
      };

      for (const res of dayResults) {
        results.push({ date: res.date, slots: res.slots });
      }

      if (selectedDate) {
        const res = dayResults.find(r => isSameDay(r.date, selectedDate));
        const slot = res ? getFirstSlot(res) : null;
        if (slot) {
          suggestion = { date: selectedDate, slot, reason: 'first-available' };
        }
      } else {
        for (const res of dayResults) {
          const slot = getFirstSlot(res);
          if (slot && (isToday(res.date) || res.date > new Date())) {
            suggestion = { date: res.date, slot, reason: 'first-available' };
            break;
          }
        }
      }

      setNextSlots(results);
      setSmartSuggestion(suggestion);
    } catch (error) {
    } finally {
      setNextSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProfessional && businessHours.length > 0 && totalDuration > 0 && step !== 'confirm') {
      fetchNextAvailableSlots();
    }
  }, [selectedProfessional, professionalHours, businessHours, totalDuration, currentWeekStart, selectedDate]);

  const handleQuickSlot = (date: Date, time: string) => {
    skipTimeResetRef.current = true;
    setSelectedDate(date);
    setSelectedTime(time);
    setQuickSlotSelected(true);
  };

  const handleBook = async () => {
    if (!company || !selectedDate || !selectedTime || !selectedProfessional) {
      toast.error('Não foi possível concluir o agendamento. Por favor selecione um horário válido.');
      if (!selectedTime || !selectedDate) setStep('datetime');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Selecione pelo menos um serviço.');
      setStep('services');
      return;
    }
    if (!clientForm.full_name || !clientForm.whatsapp) {
      toast.error('Por favor, informe seu nome e WhatsApp para concluir.');
      return;
    }

    setLoading(true);
    try {
      const normalizedPhone = normalizePhone(clientForm.whatsapp);
      const formattedWhatsapp = clientForm.whatsapp ? normalizedPhone : null;

      const { start: startTime, end: endTime } = buildBookingUtcRange(
        selectedDate,
        selectedTime,
        totalDuration,
        bookingTimezone,
      );

      const aptServicesPayload = selectedServices.map((sid) => {
        const svc = services.find((s) => s.id === sid);
        return { 
          service_id: sid, 
          price: svc ? Number(svc.price) : 0, 
          duration_minutes: svc ? Number(svc.duration_minutes) : 0 
        };
      });

      const appointmentPayloadV2 = {
        p_company_id: company.id,
        p_professional_id: selectedProfessional,
        p_client_id: null,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_total_price: finalPrice,
        p_client_name: clientForm.full_name ?? null,
        p_client_whatsapp: formattedWhatsapp ?? null,
        p_notes: null as string | null,
        p_promotion_id: promoData?.id ?? null,
        p_services: aptServicesPayload,
        p_cashback_ids: [],
        p_user_id: null
      };

      const { data: appointmentId, error: aptError } = await supabase
        .rpc('create_appointment_v2' as any, appointmentPayloadV2 as any);

      if (aptError) throw aptError;
      if (!appointmentId) throw new Error('Falha ao processar agendamento.');

      try {
        const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
        const serviceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean).join(', ');
        sendAppointmentCreatedWebhook({
          appointment_id: String(appointmentId),
          company_id: company.id,
          client_name: clientForm.full_name,
          client_phone: formattedWhatsapp || null,
          professional_name: professionalProfile?.full_name || '',
          service_name: serviceNames,
          service_price: Number(totalPrice),
          appointment_date: format(startTime, 'yyyy-MM-dd'),
          appointment_time: format(startTime, 'HH:mm'),
          datetime_iso: startTime.toISOString(),
          origin: 'public',
        });
      } catch { }

      const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
      const bookedServiceNames = selectedServices
        .map((sid) => services.find((s) => s.id === sid)?.name)
        .filter(Boolean) as string[];

      setBookingResult({
        appointmentId: appointmentId as string,
        professionalName: professionalProfile?.full_name || 'Profissional',
        professionalAvatar: professionalProfile?.avatar_url || null,
        serviceNames: bookedServiceNames.length > 0 ? bookedServiceNames : ['Serviço'], 
        date: selectedDate, 
        time: selectedTime,
        totalPrice: Number(finalPrice || 0), 
        totalDuration: Number(totalDuration || 0), 
        companyName: company?.name || 'Estabelecimento',
        companyPhone: (company as any)?.whatsapp || company?.phone || companySettings?.whatsapp_number || null,
        companyAddress: [(company as any)?.address, (company as any)?.address_number ? `${(company as any).address_number}` : null].filter(Boolean).join(', ') + ((company as any)?.district ? ` - ${(company as any).district}` : '') || null,
        companyCity: (company as any)?.city || null,
        companyState: (company as any)?.state || null,
        companyPostalCode: (company as any)?.postal_code || null,
      });

      setStep('success');
    } catch (err: any) {
      const info = translateBookingError(err);
      setBookingError(info);
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: `${T.accent} transparent transparent transparent` }} />
          <p style={{ color: T.textSec }}>Carregando...</p>
        </div>
      </div>
    );
  }

  if (noProfessionals) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <div className="flex flex-col items-center gap-4 text-center px-6 max-w-md">
          <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: `${T.accent}20` }}>
            <AlertTriangle style={{ color: T.accent }} className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Agenda indisponível</h2>
          <p className="text-sm" style={{ color: T.textSec }}>
            Esta empresa ainda não possui profissionais disponíveis para agendamento. Tente novamente mais tarde.
          </p>
        </div>
      </div>
    );
  }

  const Icon = isDark ? Scissors : Sparkles;
  const skipProfessionalStep = !!professionalSlug || professionals.length === 1;
  const displayLogoUrl = company.logo_url || companySettings?.logo_url;

  const stepList: Step[] = skipProfessionalStep
    ? ['services', 'datetime', 'confirm']
    : ['services', 'professional', 'datetime', 'confirm'];
  const currentStepIdx = stepList.indexOf(step);

  const companySlugPath = company.business_type === 'esthetic' ? 'estetica' : 'barbearia';
  const companyPageUrl = `/${companySlugPath}/${company.slug}`;
  const companyWhatsapp = company.phone || companySettings?.whatsapp_number;

  return (
    <div className="min-h-screen pb-20 sm:pb-0 font-sans tracking-tight" style={{ background: T.bg, color: T.text }}>
      <header 
        className="sticky top-0 z-50 backdrop-blur-xl transition-all duration-500"
        style={{ 
          background: `${T.card}F2`, 
          borderBottom: `2px solid ${T.accent}44`,
          boxShadow: '0 15px 50px -12px rgba(0,0,0,0.6)'
        }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <a href={companyPageUrl} className="shrink-0">
              {displayLogoUrl ? (
                <img src={displayLogoUrl} alt={company.name} className="h-12 w-12 rounded-2xl object-contain bg-white/5 p-1.5 shadow-xl" style={{ border: `1px solid ${T.accent}22` }} />
              ) : (
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: T.accent }}>
                  <Icon className="h-6 w-6 text-black" />
                </div>
              )}
            </a>
            <div className="min-w-0">
              <h1 className="font-black text-lg tracking-tighter truncate uppercase">{company.name}</h1>
              <div className="flex items-center gap-1.5">
                <StarRating rating={companyStats?.avgRating || 5} size={10} />
                <span className="text-[10px] font-black" style={{ color: T.accent }}>{companyStats?.avgRating?.toFixed(1) || '5.0'} • Premium</span>
              </div>
            </div>
          </div>

          {step !== 'success' && (
            <div className="flex-1 max-w-[140px] hidden sm:block">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Etapa {currentStepIdx + 1}/{stepList.length}</span>
              </div>
              <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                <div 
                  className="h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(245,158,11,0.5)]" 
                  style={{ 
                    background: `linear-gradient(90deg, ${T.accent}, #F4C752)`,
                    width: `${((currentStepIdx + 1) / stepList.length) * 100}%` 
                  }} 
                />
              </div>
            </div>
          )}

          <button
            onClick={() => setShowReviewModal(true)}
            className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-xl border transition-all hover:scale-105 active:scale-95 shadow-lg"
            style={{ borderColor: `${T.accent}40`, color: T.accent, background: `${T.accent}08` }}
          >
            Avaliar
          </button>
        </div>
        
        {step !== 'success' && (
          <div className="h-1 w-full bg-white/5 sm:hidden">
            <div 
              className="h-full transition-all duration-700 ease-out" 
              style={{ 
                background: `linear-gradient(90deg, ${T.accent}, #F4C752)`,
                width: `${((currentStepIdx + 1) / stepList.length) * 100}%` 
              }} 
            />
          </div>
        )}
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {isPromoMode && promoData && step !== 'success' && (
          <div 
            className="rounded-3xl p-5 relative overflow-hidden group animate-in zoom-in-95 duration-500" 
            style={{ 
              background: `linear-gradient(135deg, ${T.accent}15, rgba(0,0,0,0.1))`, 
              border: `1px solid ${T.accent}30` 
            }}
          >
            <div className="absolute top-0 right-0 p-8 blur-3xl rounded-full -mr-10 -mt-10 opacity-20 pointer-events-none" style={{ background: T.accent }} />
            <div className="relative z-10 space-y-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg" style={{ background: `${T.accent}20` }}>
                  <Sparkles className="h-4 w-4" style={{ color: T.accent }} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: T.accent }}>
                  {isCashbackPromo ? 'Ganhe Cashback Agora' : 'Oferta Especial Ativa'}
                </span>
              </div>
              <p className="font-black text-xl leading-tight">{promoData.title}</p>
            </div>
          </div>
        )}

        {step === 'services' && (
          <div className="space-y-5 animate-fade-in">
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: T.text }}>
                Escolha seus Serviços
              </h2>
            </div>

            <div className="space-y-4">
              {services.map((svc, idx) => {
                const sel = selectedServices.includes(svc.id);
                return (
                  <div
                    key={svc.id}
                    onClick={() => toggleService(svc.id)}
                    className="p-5 rounded-[2.5rem] transition-all duration-300 cursor-pointer relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: sel ? `linear-gradient(135deg, ${T.accent}20, ${T.card})` : T.card,
                      border: `2px solid ${sel ? T.accent : T.border}`,
                      boxShadow: sel ? `0 20px 40px -20px ${T.accent}40` : '0 4px 12px rgba(0,0,0,0.1)',
                    }}
                  >
                    {sel && (
                      <div className="absolute top-4 right-4 animate-in zoom-in duration-300">
                        <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/40">
                          <CheckCircle2 className="h-4 w-4 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-5">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-12" style={{ background: sel ? T.accent : `${T.accent}15` }}>
                        <Scissors className="h-7 w-7" style={{ color: sel ? '#000' : T.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-black text-lg tracking-tight group-hover:text-amber-500 transition-colors">{svc.name}</p>
                        <div className="flex items-center gap-3 mt-1 opacity-70">
                          <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
                            <Clock className="h-3 w-3" /> {svc.duration_minutes} min
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-black text-xl" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {selectedServices.length > 0 && (
              <div className="fixed bottom-0 left-0 right-0 p-4 z-40 sm:relative sm:p-0">
                <div 
                  className="max-w-2xl mx-auto rounded-[2.5rem] p-4 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-10 duration-500 shadow-2xl shadow-black/50" 
                  style={{ background: T.card, border: `1px solid ${T.border}` }}
                >
                  <div className="pl-4">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total Estimado</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black" style={{ color: T.accent }}>R$ {totalPrice.toFixed(2)}</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => setStep(skipProfessionalStep ? 'datetime' : 'professional')}
                    className="rounded-full px-8 py-7 font-black text-base transition-all hover:scale-105 active:scale-95 group"
                    style={{ background: `linear-gradient(135deg, ${T.accent}, #F4C752)`, color: '#000' }}
                  >
                    Continuar
                    <ChevronRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 'professional' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button onClick={() => setStep('services')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: T.text }}>Escolha seu Expert</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {professionals.map((p) => {
                const sel = selectedProfessional === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedProfessional(p.id); fetchProfessionalHours(p.id); setStep('datetime'); }}
                    className="p-6 rounded-[2.5rem] cursor-pointer transition-all duration-300 relative group overflow-hidden"
                    style={{
                      background: sel ? `linear-gradient(135deg, ${T.accent}20, ${T.card})` : T.card,
                      border: `2px solid ${sel ? T.accent : T.border}`,
                    }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name} className="w-24 h-24 rounded-3xl object-cover" style={{ border: `3px solid ${sel ? T.accent : T.border}` }} />
                        ) : (
                          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-black" style={{ background: `${T.accent}15`, color: T.accent, border: `3px solid ${sel ? T.accent : T.border}` }}>
                            {p.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                      </div>
                      <p className="font-black text-lg">{p.full_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'datetime' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button onClick={() => setStep(skipProfessionalStep ? 'services' : 'professional')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none">Escolha seu Horário</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-white/5 p-2 rounded-[2rem] border border-white/5">
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}><ChevronLeft className="h-4 w-4" /></Button>
                <div className="flex-1 flex justify-around">
                  {eachDayOfInterval({ start: currentWeekStart, end: addDays(currentWeekStart, 6) }).map((date) => {
                    const isSel = selectedDate && isSameDay(date, selectedDate);
                    return (
                      <button key={date.toISOString()} onClick={() => { setSelectedDate(date); setSelectedTime(null); }} className="flex flex-col items-center p-2 rounded-2xl" style={{ background: isSel ? T.accent : 'transparent' }}>
                        <span className="text-[9px] font-black uppercase opacity-60">{format(date, "EEE", { locale: ptBR })}</span>
                        <span className="text-sm font-black">{format(date, "dd")}</span>
                      </button>
                    );
                  })}
                </div>
                <Button variant="ghost" size="icon" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}><ChevronRight className="h-4 w-4" /></Button>
              </div>
              {selectedDate && (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                  {(nextSlots.find(d => isSameDay(d.date, selectedDate))?.slots || []).map((slot) => (
                    <button key={slot} onClick={() => { setSelectedTime(slot); setStep('confirm'); }} className="py-5 rounded-3xl text-sm font-black border-2" style={{ background: selectedTime === slot ? T.accent : T.card }}>
                      {formatSlotTime(slot)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'confirm' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button onClick={() => setStep('datetime')} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="rounded-[2.5rem] p-6 space-y-6" style={{ background: T.card, border: `2px solid ${T.border}` }}>
              <div className="space-y-4">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Nome Completo</Label>
                <Input value={clientForm.full_name} onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })} className="rounded-2xl h-12 bg-white/5 border-white/10 text-white font-bold" />
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">WhatsApp</Label>
                <Input value={clientForm.whatsapp} onChange={(e) => setClientForm({ ...clientForm, whatsapp: e.target.value })} className="rounded-2xl h-12 bg-white/5 border-white/10 text-white font-bold" />
              </div>
              <Button onClick={handleBook} disabled={loading} className="w-full rounded-full py-8 font-black text-lg" style={{ background: T.accent, color: '#000' }}>
                {loading ? 'Confirmando...' : 'Finalizar Agendamento'}
              </Button>
            </div>
          </div>
        )}

        {step === 'success' && bookingResult && (
          <div className="text-center space-y-6 pt-10">
            <div className="w-24 h-24 rounded-full bg-green-500/10 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="text-4xl font-black tracking-tighter">Ticket Confirmado!</h2>
            <p className="text-xl font-black" style={{ color: T.accent }}>{clientForm.full_name.split(' ')[0]}, seu momento está reservado.</p>
            <Button onClick={() => window.location.reload()} className="rounded-full px-8 py-6 font-black">Fazer novo agendamento</Button>
          </div>
        )}
      </div>

      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-sm" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}>
          <DialogHeader>
            <DialogTitle className="text-center text-lg" style={{ color: T.text }}>Avaliar {company?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            <div className="flex flex-col items-center gap-2">
              <p className="text-sm" style={{ color: T.textSec }}>Como foi sua experiência?</p>
              <InteractiveStarRating rating={reviewRating} onRate={setReviewRating} size={36} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium" style={{ color: T.textSec }}>Comentário (opcional)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value.slice(0, 500))}
                maxLength={500}
                rows={3}
                placeholder="Conte como foi..."
                className="w-full rounded-xl px-4 py-3 text-sm resize-none outline-none placeholder:opacity-50"
                style={{ background: T.bg, border: `1px solid ${T.border}`, color: T.text }}
              />
            </div>
            <Button
              disabled={submittingReview || reviewRating < 1}
              onClick={async () => {
                if (!company || reviewRating < 1) return;
                setSubmittingReview(true);
                try {
                  const { error } = await supabase.from('reviews').insert({
                    company_id: company.id,
                    professional_id: company.user_id || selectedProfessional || professionals[0]?.id,
                    appointment_id: null as any,
                    rating: reviewRating,
                    comment: reviewComment.trim() || null,
                  } as any);
                  if (error) throw error;
                  toast.success('Avaliação enviada com sucesso!');
                  setShowReviewModal(false);
                  setReviewRating(0);
                  setReviewComment('');
                } catch (err: any) {
                  toast.error(err.message || 'Erro ao enviar avaliação');
                } finally {
                  setSubmittingReview(false);
                }
              }}
              className="w-full rounded-xl py-5 font-semibold text-base"
              style={{ background: reviewRating > 0 ? '#FDBA2D' : T.border, color: reviewRating > 0 ? '#000' : T.textSec }}
            >
              {submittingReview ? 'Enviando...' : '⭐ Enviar avaliação'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BookingPage;
