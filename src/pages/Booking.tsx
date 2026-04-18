import { useEffect, useRef, useState, useMemo } from 'react';
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
import { Scissors, Sparkles, Clock, DollarSign, ChevronRight, ChevronLeft, CheckCircle2, Bell, Zap, CalendarPlus, MessageCircle, RotateCcw, Home, User, Phone, Mail, Cake, MapPin, Star, X, AlertTriangle, Calendar } from 'lucide-react';
import { format, addMinutes, addDays, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp, displayWhatsApp, isValidWhatsApp, buildWhatsAppUrl } from '@/lib/whatsapp';
import { validateTimeSlot, type BusinessHours, type BusinessException, type ExistingAppointment, type BookingMode } from '@/lib/availability-engine';
import { getAvailableSlots } from '@/lib/availability-service';
import { PlatformBranding } from '@/components/PlatformBranding';
import { CustomRequestForm } from '@/components/CustomRequestForm';
import { getCompanyBranding, buildThemeFromBranding } from '@/hooks/useCompanyBranding';
import { usePreselectedSlot } from '@/hooks/usePreselectedSlot';
import { Lock } from 'lucide-react';
import { CompleteSignupModal } from '@/components/CompleteSignupModal';
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

type Step = 'services' | 'professional' | 'datetime' | 'client' | 'benefits' | 'confirm' | 'success';
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

// ─── Premium Theme Tokens (defaults, overridden dynamically below) ───
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
  // Promotion state
  const [promoData, setPromoData] = useState<PromotionInfo | null>(null);
  const isPromoMode = !!promoData;

  const [step, setStep] = useState<Step>('services');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState<BookingErrorInfo | null>(null);
  const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
  const [clientForm, setClientForm] = useState({ full_name: '', email: '', whatsapp: '', birth_date: '' });
  const [clientPassword, setClientPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const skipTimeResetRef = useRef(false);
  const [optInWhatsapp, setOptInWhatsapp] = useState(false);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [clientDataWasAutoFilled, setClientDataWasAutoFilled] = useState(false);
  const [saveDataForNext, setSaveDataForNext] = useState(true);
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
  const [quickSlotSelected, setQuickSlotSelected] = useState(false);
  const [cashbackCredits, setCashbackCredits] = useState<{ id: string; amount: number; expires_at: string }[]>([]);
  const [useCashback, setUseCashback] = useState(false);
  const cashbackTotal = cashbackCredits.reduce((s, c) => s + Number(c.amount), 0);
  const [autoCashbackPromos, setAutoCashbackPromos] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(0);
  const slotRequestRef = useRef(0);
  const [isClientLoggedIn, setIsClientLoggedIn] = useState(false);
  const [hasValidClient, setHasValidClient] = useState(false);
  const [showCompleteSignup, setShowCompleteSignup] = useState(false);
  
  const [hasBenefitsActive, setHasBenefitsActive] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    serviceIds: string[]; serviceNames: string[]; serviceDurations: number[];
    professionalId: string; professionalName: string; professionalAvatar: string | null;
    totalPrice: number; totalDuration: number; bookedAt: string;
  } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);
  const [bookingResult, setBookingResult] = useState<{
    appointmentId: string;
    professionalName: string;
    professionalAvatar: string | null;
    serviceNames: string[];
    date: Date;
    time: string;
    totalPrice: number;
    totalDuration: number;
    companyName: string;
    companyPhone: string | null;
    companyAddress: string | null;
    companyCity: string | null;
    companyState: string | null;
    companyPostalCode: string | null;
  } | null>(null);

  const isDark = businessType === 'barbershop';
  const bookingTimezone = companySettings?.timezone || DEFAULT_BOOKING_TIMEZONE;

  // Dynamic theme based on company branding
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

  // Load saved client from localStorage
  useEffect(() => {
    const loadSavedClient = () => {
      if (!company) return;
      const storedClientId = localStorage.getItem(`client_id_${company.id}`);
      const storedClientData = localStorage.getItem(`client_data_${company.id}`);
      // Also check global client data as fallback
      const globalClientData = localStorage.getItem('meagendae_client_data');
      const dataSource = storedClientData || globalClientData;
      if (storedClientId) {
        setSavedClientId(storedClientId);
      }
      if (dataSource) {
        try {
          const c = JSON.parse(dataSource);
          setClientForm({
            full_name: c.full_name || '',
            email: c.email || '',
            whatsapp: c.whatsapp || '',
            birth_date: '',
          });
          setOptInWhatsapp(c.opt_in_whatsapp || false);
          setClientDataWasAutoFilled(true);
        } catch (e) {
          console.warn('[Booking] Failed to parse stored client data');
        }
      }
      setClientLoaded(true);
    };
    loadSavedClient();
  }, [company]);

  // Check for cashback credits when client is identified
  useEffect(() => {
    if (!savedClientId || !company?.id) return;
    const checkCashback = async () => {
      const { data } = await supabase
        .from('client_cashback')
        .select('id, amount, expires_at')
        .eq('client_id', savedClientId)
        .eq('company_id', company.id)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString());
      setCashbackCredits(data || []);
    };
    checkCashback();
    // Check loyalty points
    const checkLoyalty = async () => {
      const { data: txs } = await supabase
        .from('loyalty_points_transactions' as any)
        .select('balance_after')
        .eq('client_id', savedClientId)
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLoyaltyPoints((txs as any)?.balance_after || 0);
      // Fetch point value from config
      const { data: lc } = await supabase
        .from('loyalty_config' as any)
        .select('point_value, enabled')
        .eq('company_id', company.id)
        .maybeSingle();
      if (lc && (lc as any).enabled) {
        setLoyaltyPointValue(Number((lc as any).point_value) || 0);
      }
    };
    checkLoyalty();
  }, [savedClientId, company?.id]);

  // Check if client is logged in
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsClientLoggedIn(!!session?.user);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsClientLoggedIn(!!session?.user);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Check whether a valid `clients` record exists for this user in this company.
  // Used to decide whether to show "Ver meus agendamentos" vs "Concluir cadastro".
  useEffect(() => {
    const checkValidClient = async () => {
      if (!isClientLoggedIn || !company?.id) {
        setHasValidClient(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasValidClient(false);
        return;
      }
      const { data, error } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .maybeSingle();
      if (error) {
        console.warn('[Booking] hasValidClient check error:', error);
      }
      setHasValidClient(!!data);
    };
    checkValidClient();
  }, [isClientLoggedIn, company?.id, bookingResult?.appointmentId, savedClientId]);

  // Check if company has cashback or loyalty active
  // Load last booking for smart rebooking
  useEffect(() => {
    if (!company?.id || isPromoMode) return;
    try {
      const stored = localStorage.getItem(`last_booking_${company.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Validate services still exist
        const allServicesExist = parsed.serviceIds.every((sid: string) => services.find((s: any) => s.id === sid));
        // Validate professional still exists (if professionals loaded)
        const profExists = !professionalSlug || professionals.some((p: any) => p.id === parsed.professionalId);
        if (allServicesExist && profExists) {
          setLastBooking(parsed);
        }
      }
    } catch { /* ignore */ }
  }, [company?.id, services, professionals, isPromoMode]);

  // Auto-rebook when ?rebook=1 is present in URL (triggered from BarbershopLanding)
  const rebookTriggered = useRef(false);
  useEffect(() => {
    if (rebookTriggered.current) return;
    if (searchParams.get('rebook') !== '1') return;
    if (!lastBooking || !company?.id || services.length === 0) return;
    rebookTriggered.current = true;
    (async () => {
      setSelectedServices(lastBooking.serviceIds);
      if (!professionalSlug) {
        setSelectedProfessional(lastBooking.professionalId);
        const profs = await fetchProfessionals();
        const profStillExists = profs.some((p: any) => p.id === lastBooking.professionalId);
        if (!profStillExists) {
          toast.error('Esse profissional não está disponível no momento. Escolha outro.');
          setSelectedProfessional(null);
          setStep('professional');
          return;
        }
      }
      const { data: spLinks } = await supabase
        .from('service_professionals')
        .select('service_id')
        .eq('professional_id', lastBooking.professionalId)
        .in('service_id', lastBooking.serviceIds);
      if (!spLinks || spLinks.length !== lastBooking.serviceIds.length) {
        toast.error('Serviço não disponível com esse profissional. Escolha manualmente.');
        setStep('services');
        return;
      }
      setStep('datetime');
    })();
  }, [lastBooking, company?.id, services, searchParams, professionalSlug]);

  useEffect(() => {
    if (!company?.id) return;
    const checkBenefits = async () => {
      const [cashbackRes, loyaltyRes] = await Promise.all([
        supabase.from('promotions' as any).select('id').eq('company_id', company.id).eq('promotion_type', 'cashback').eq('active', true).limit(1),
        supabase.from('loyalty_config' as any).select('enabled').eq('company_id', company.id).eq('enabled', true).limit(1),
      ]);
      setHasBenefitsActive(!!((cashbackRes.data as any[])?.length || (loyaltyRes.data as any[])?.length));
    };
    checkBenefits();
  }, [company?.id]);

  useEffect(() => {
    if (slug) fetchCompany();
  }, [slug]);

  const fetchCompany = async () => {
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) return;
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

    // Fetch professional ratings
    const { data: ratingsData } = await supabase.rpc('get_professional_ratings' as any, { p_company_id: comp.id });
    if (ratingsData && Array.isArray(ratingsData)) {
      const ratingsMap: Record<string, { avg: number; count: number }> = {};
      for (const r of ratingsData as any[]) {
        ratingsMap[r.professional_id] = { avg: Number(r.avg_rating), count: Number(r.review_count) };
      }
      setProfessionalRatings(ratingsMap);
    }

    // Fetch company-level stats (reviews + completed appointments)
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

    // Fetch active cashback promotions for auto-detection
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
    } catch { /* ignore */ }

    // Check if company has any active professionals
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
      const { data: pubProfs, error: collabErr } = await supabase
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

        // Fetch recent bookings for social proof
        fetchRecentBookings(profileId);
      }
    }

    // Apply prefilled date/time from URL query params (e.g. from quick booking buttons)
    const prefillDate = preselected.getParsedDate();
    if (prefillDate) {
      setSelectedDate(prefillDate);
      const initVals = preselected.getInitialValues();
      if (initVals.time) {
        setSelectedTime(initVals.time);
      }
    }

    // Load promotion data if ?promo= param is present
    if (promoIdRef.current) {
      const { data: promos } = await supabase
        .from('public_promotions' as any)
        .select('*')
        .eq('id', promoIdRef.current)
        .limit(1);
      const pd = (promos as any)?.[0];
      if (pd && pd.company_id === comp.id) {
        setPromoData(pd as PromotionInfo);
        // Auto-select promo services
        const promoServiceIds = pd.service_ids || (pd.service_id ? [pd.service_id] : []);
        // If promo has only 1 service, auto-select it; otherwise let user choose
        if (promoServiceIds.length === 1) {
          setSelectedServices(promoServiceIds);
        }
        // Auto-select professional if only one
        if (pd.professional_ids?.length === 1) {
          const profId = pd.professional_ids[0];
          setSelectedProfessional(profId);
          const { data: profHoursData } = await supabase
            .from('professional_working_hours' as any)
            .select('*')
            .eq('professional_id', profId);
          if (profHoursData && (profHoursData as any[]).length > 0) {
            setProfessionalHours(profHoursData as unknown as BusinessHours[]);
          }
          // Fetch professional for display
          const { data: promoProfs } = await supabase
            .from('public_professionals' as any)
            .select('*')
            .eq('company_id', comp.id)
            .in('id', pd.professional_ids);
          if (promoProfs) {
            setProfessionals((promoProfs as any[]).map((p: any) => ({
              id: p.id, name: p.name, full_name: p.name, avatar_url: p.avatar_url, slug: p.slug,
            })));
          }
        } else if (pd.professional_ids?.length > 1) {
          // Fetch specific professionals for selection
          const { data: promoProfs } = await supabase
            .from('public_professionals' as any)
            .select('*')
            .eq('company_id', comp.id)
            .in('id', pd.professional_ids);
          if (promoProfs) {
            setProfessionals((promoProfs as any[]).map((p: any) => ({
              id: p.id, name: p.name, full_name: p.name, avatar_url: p.avatar_url, slug: p.slug,
            })));
          }
        }
        // Skip to appropriate step
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

  const fetchRecentBookings = async (profileId: string) => {
    const { data: recentCount } = await supabase.rpc('get_professional_recent_bookings' as any, { p_professional_id: profileId });
    if (typeof recentCount === 'number') setRecentBookings(recentCount);
  };

  const fetchProfessionals = async (): Promise<any[]> => {
    if (!company) return [];

    const { data: pubProfs } = await supabase
      .from('public_professionals' as any)
      .select('*')
      .eq('company_id', company.id)
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
            autoLinks.push({ service_id: svcId, professional_id: prof.id, company_id: company.id });
          }
        }
        if (autoLinks.length > 0) {
          await supabase.from('service_professionals').insert(autoLinks as any);
        }
      }
    } else {
      mappedProfs = allProfs;
    }

    setProfessionals(mappedProfs);

    if (mappedProfs.length === 1) {
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
    // Apply per-professional booking config
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
    // Cashback promos: client pays full price — no discount applied
    if (isCashbackPromo) {
      return services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0);
    }
    if (!isPromoMode || !promoData) {
      return services.filter((s) => selectedServices.includes(s.id)).reduce((sum, s) => sum + Number(s.price), 0);
    }
    const promoServiceIds = promoData.service_ids || (promoData.service_id ? [promoData.service_id] : []);
    // For single-service fixed_price promos, use promotion_price directly
    if (promoData.discount_type === 'fixed_price' && promoData.promotion_price != null && promoServiceIds.length <= 1) {
      return Number(promoData.promotion_price);
    }
    // For percentage/fixed_amount, calculate per service
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

  // Calculate cashback the client will EARN (not a discount)
  const cashbackEarnAmount = (() => {
    // From promo-mode cashback
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
    // Auto-detect from active cashback promotions
    if (!isPromoMode && autoCashbackPromos.length > 0 && selectedProfessional && selectedServices.length > 0) {
      let total = 0;
      for (const promo of autoCashbackPromos) {
        // Check professional eligibility
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

  const fetchBookingAppointments = async (date: Date, professionalId: string) => {
    if (!company) return [] as ExistingAppointment[];
    const dateStr = format(date, 'yyyy-MM-dd');
    const { data, error } = await (supabase as any).rpc('get_booking_appointments', {
      p_company_id: company.id,
      p_professional_id: professionalId,
      p_selected_date: dateStr,
      p_timezone: bookingTimezone,
    });
    if (error) throw error;
    return ((data as ExistingAppointment[] | null) || []).map((a) => ({
      start_time: a.start_time,
      end_time: a.end_time,
    }));
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

    const dateStr = format(date, 'yyyy-MM-dd');
    try {
      // Use the unified availability service so the public flow returns the
      // exact same slots as the internal manual booking flow.
      const result = await getAvailableSlots({
        source: 'public',
        companyId: company.id,
        professionalId: selectedProfessional,
        date,
        totalDuration,
        filterPastForToday: true,
      });

      if (requestId !== slotRequestRef.current) return;

      setAppointmentsForSelectedDate(result.existingAppointments);
      setAppointmentsLoaded(true);
      setGeneratedSlots(result.slots);

      // Safety net: re-filter against raw appointments using the booking timezone.
      // The engine already accounts for everything, so this should be a no-op
      // in practice but protects against any edge case.
      const filteredSlots = filterOverlappingSlots(
        result.slots,
        result.existingAppointments,
        totalDuration,
        result.bufferMinutes,
        bookingTimezone,
      );

      console.log('[UI BEFORE RENDER]', filteredSlots);

      if (requestId !== slotRequestRef.current) return;
      setAvailableSlots(filteredSlots);
    } catch (error) {
      console.error('[Booking] Failed to load appointments for slot calculation', error);
      setAppointmentsLoaded(true);
      setAppointmentsForSelectedDate([]);
      setAvailableSlots([]);
      setGeneratedSlots([]);
    } finally {
      if (requestId === slotRequestRef.current) setSlotsLoading(false);
    }
  };

  useEffect(() => {
    // Don't reset time if it's a locked preselected slot or quick slot
    if (preselected.isLockedTime(selectedTime)) {
      // Locked slot — preserve time
    } else if (skipTimeResetRef.current) {
      // Quick slot was used — don't reset time
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
  }, [selectedDate, selectedProfessional, selectedServices, professionalHours, businessHours, totalDuration, company]);

  useEffect(() => {
    if (professionals.length === 1 && selectedProfessional !== professionals[0].id) {
      setSelectedProfessional(professionals[0].id);
      fetchProfessionalHours(professionals[0].id);
      if (step === 'professional') setStep(preselected.isActive() && selectedDate && selectedTime ? 'client' : 'datetime');
    }
  }, [professionals, selectedProfessional, step]);

  const fetchNextAvailableSlots = async () => {
    if (!company || !selectedProfessional || businessHours.length === 0 || totalDuration <= 0) {
      setNextSlots([]);
      return;
    }
    setNextSlotsLoading(true);
    const results: { date: Date; slots: string[] }[] = [];
    let totalSlotsFound = 0;
    const MAX_SLOTS = 8;
    const MAX_DAYS = 7;
    const now = new Date();
    for (let i = 0; i < MAX_DAYS && totalSlotsFound < MAX_SLOTS; i++) {
      const day = addDays(startOfDay(new Date()), i);
      // Unified availability service — same code path as the manual booking flow.
      const result = await getAvailableSlots({
        source: 'public',
        companyId: company.id,
        professionalId: selectedProfessional,
        date: day,
        totalDuration,
        filterPastForToday: true,
      });
      // Safety net (no-op in normal cases — engine already handled buffer/conflicts)
      const slots = filterOverlappingSlots(
        result.slots,
        result.existingAppointments,
        totalDuration,
        result.bufferMinutes,
        bookingTimezone,
      );

      console.log('[UI BEFORE RENDER]', slots);
      if (slots.length > 0) {
        const remaining = MAX_SLOTS - totalSlotsFound;
        const daySlots = slots.slice(0, remaining);
        results.push({ date: day, slots: daySlots });
        totalSlotsFound += daySlots.length;
      }
    }
    setNextSlots(results);
    setNextSlotsLoading(false);
  };

  useEffect(() => {
    if (selectedProfessional && businessHours.length > 0 && totalDuration > 0 && step !== 'client' && step !== 'confirm') {
      fetchNextAvailableSlots();
    }
  }, [selectedProfessional, professionalHours, businessHours, totalDuration]);

  const handleQuickSlot = (date: Date, time: string) => {
    skipTimeResetRef.current = true;
    setSelectedDate(date);
    setSelectedTime(time);
    setQuickSlotSelected(true);
  };

  const handleJoinWaitlist = async () => {
    if (!company || !selectedDate) return;
    if (!waitlistForm.name.trim() || !waitlistForm.whatsapp.trim()) {
      toast.error('Preencha seu nome e WhatsApp');
      return;
    }
    if (!isValidWhatsApp(waitlistForm.whatsapp)) {
      toast.error('WhatsApp inválido');
      return;
    }
    setWaitlistLoading(true);
    try {
      const { error } = await supabase.rpc('join_public_waitlist', {
        p_company_id: company.id,
        p_client_name: waitlistForm.name.trim(),
        p_client_whatsapp: formatWhatsApp(waitlistForm.whatsapp),
        p_email: waitlistForm.email.trim() || null,
        p_service_ids: selectedServices,
        p_desired_date: format(selectedDate, 'yyyy-MM-dd'),
        p_professional_id: selectedProfessional || null,
      });
      if (error) throw error;
      setShowWaitlistForm(false);
      setWaitlistSuccess(true);
      setWaitlistForm({ name: '', whatsapp: '', email: '' });
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na lista de espera');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleBook = async () => {
    // Final validation before booking
    if (!company || !selectedDate || !selectedTime || !selectedProfessional) {
      console.error('[Booking] Missing required data:', { company: !!company, selectedDate, selectedTime, selectedProfessional });
      toast.error('Não foi possível concluir o agendamento. Por favor selecione um horário válido.');
      if (!selectedTime || !selectedDate) setStep('datetime');
      return;
    }
    if (selectedServices.length === 0) {
      toast.error('Selecione pelo menos um serviço.');
      setStep('services');
      return;
    }
    if (!clientForm.full_name.trim() || !clientForm.whatsapp || !isValidWhatsApp(clientForm.whatsapp)) {
      toast.error('Informe seu nome e número de WhatsApp para continuar.');
      setStep('client');
      return;
    }
    setLoading(true);
    try {
      const formattedWhatsapp = clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : null;
      console.log('[Booking] Creating client:', { name: clientForm.full_name, company_id: company.id });
      const { data: clientIdFromRpc, error: clientError } = await supabase.rpc('create_client', {
        p_name: clientForm.full_name, p_whatsapp: formattedWhatsapp || '',
        p_email: clientForm.email || '', p_company_id: company.id,
        p_birth_date: clientForm.birth_date || null,
      } as any);
      if (clientError) {
        console.error('[Booking] Client creation error:', clientError);
        throw clientError;
      }
      const clientId = clientIdFromRpc;
      console.log('[Booking] Client ID:', clientId);

      // Check if client is blocked
      if (clientId) {
        const { data: clientRecord } = await supabase
          .from('clients')
          .select('is_blocked')
          .eq('id', clientId)
          .single();
        if (clientRecord && (clientRecord as any).is_blocked) {
          toast.error('Este cliente está bloqueado para realizar agendamentos. Entre em contato com o estabelecimento.');
          setLoading(false);
          return;
        }
      }

      if (clientId) {
        const clientDataJson = JSON.stringify({
          full_name: clientForm.full_name, email: clientForm.email || '', whatsapp: clientForm.whatsapp || '',
          opt_in_whatsapp: optInWhatsapp,
        });
        // Always save client_id for this company (needed for rebooking logic)
        localStorage.setItem(`client_id_${company.id}`, clientId);
        // Data will be persisted/cleared on success screen based on user choice
        localStorage.setItem(`client_data_${company.id}`, clientDataJson);
        localStorage.setItem('meagendae_client_data', clientDataJson);
        setSavedClientId(clientId);
        // Track booking count
        const countKey = 'meagendae_booking_count';
        const currentCount = parseInt(localStorage.getItem(countKey) || '0', 10);
        localStorage.setItem(countKey, String(currentCount + 1));
      }

      const [h, m] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(h, m, 0, 0);
      const endTime = addMinutes(startTime, totalDuration);
      if (!clientId) throw new Error('Cadastro do cliente falhou. Tente novamente.');

      // Validate time slot is on the grid for fixed_grid mode
      if (bookingMode === 'fixed_grid') {
        const dayOfWeek = selectedDate.getDay();
        const activeHours = professionalHours.length > 0 ? professionalHours : businessHours;
        const dayHours = activeHours.find(bh => bh.day_of_week === dayOfWeek);
        if (dayHours) {
          const validation = validateTimeSlot(selectedTime, bookingMode, fixedSlotInterval, dayHours.open_time);
          if (!validation.valid) {
            console.error('[Booking] Invalid time slot:', validation.error);
            toast.error('Horário inválido. Por favor, selecione um horário da grade disponível.');
            setStep('datetime');
            setLoading(false);
            return;
          }
        }
      }

      const appointmentPayload = {
        p_professional_id: selectedProfessional, p_client_id: clientId,
        p_start_time: startTime.toISOString(), p_end_time: endTime.toISOString(), p_total_price: finalPrice,
        p_client_name: clientForm.full_name ?? null,
        p_client_whatsapp: formattedWhatsapp ?? null,
        p_notes: null as string | null,
        p_promotion_id: promoData?.id ?? null,
      };

      // Final availability check to prevent double booking (overlap range check)
      const { data: conflictingAppts } = await supabase
        .from('appointments')
        .select('id')
        .eq('professional_id', selectedProfessional)
        .lt('start_time', endTime.toISOString())
        .gt('end_time', startTime.toISOString())
        .not('status', 'in', '("cancelled","no_show")')
        .limit(1);

      if (conflictingAppts && conflictingAppts.length > 0) {
        toast.error('Esse horário acabou de ser reservado ou não comporta a duração do serviço selecionado. Por favor escolha outro horário disponível.');
        setStep('datetime');
        if (selectedDate) calculateSlots(selectedDate);
        setLoading(false);
        return;
      }

      // Check for event slot conflicts
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const timeStr = selectedTime;
      const { data: eventSlotConflicts } = await (supabase as any)
        .from('event_slots')
        .select('id')
        .eq('professional_id', selectedProfessional)
        .eq('slot_date', dateStr)
        .lte('start_time', timeStr)
        .gt('end_time', timeStr)
        .limit(1);

      if (eventSlotConflicts && eventSlotConflicts.length > 0) {
        toast.error('Este horário está reservado para uma Agenda Aberta.');
        setStep('datetime');
        setLoading(false);
        return;
      }

      console.log('[Booking] Creating appointment:', appointmentPayload);
      const { data: appointmentId, error: aptError } = await supabase
        .rpc('create_appointment' as any, appointmentPayload as any);
      if (aptError) {
        console.error('[Booking] Appointment creation error:', aptError);
        throw aptError;
      }
      console.log('[Booking] Appointment created:', appointmentId);
      if (!appointmentId) throw new Error('Falha ao criar agendamento');

      const aptServicesPayload = selectedServices.map((sid) => {
        const svc = services.find((s) => s.id === sid)!;
        return { service_id: sid, price: Number(svc.price), duration_minutes: svc.duration_minutes };
      });
      await supabase.rpc('create_appointment_services', { p_appointment_id: appointmentId, p_services: aptServicesPayload });

      // Mark used cashback credits
      if (useCashback && cashbackCredits.length > 0 && cashbackDiscount > 0) {
        let remaining = cashbackDiscount;
        for (const credit of cashbackCredits) {
          if (remaining <= 0) break;
          remaining -= Number(credit.amount);
          await supabase
            .from('client_cashback')
            .update({
              status: 'used',
              used_at: new Date().toISOString(),
              used_appointment_id: appointmentId as string,
            })
            .eq('id', credit.id);
        }
      }


      try {
        const { data: webhookConfigs } = await supabase
          .from('webhook_configs').select('url')
          .eq('company_id', company.id).eq('event_type', 'appointment_created').eq('active', true);
        const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
        const serviceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean);
        const createdPayload = {
          event: 'appointment_created', appointment_id: appointmentId, company_id: company.id,
          client_name: clientForm.full_name, client_whatsapp: formatWhatsApp(clientForm.whatsapp),
          client_email: clientForm.email, professional_name: professionalProfile?.full_name || '',
          service_name: serviceNames.join(', '), services: serviceNames,
          appointment_date: format(startTime, 'yyyy-MM-dd'), appointment_time: format(startTime, 'HH:mm'),
          start_time: startTime.toISOString(), end_time: endTime.toISOString(), total_price: totalPrice,
        };
        await supabase.from('webhook_events').insert({
          company_id: company.id, event_type: 'appointment_created' as any,
          payload: createdPayload, status: webhookConfigs && webhookConfigs.length > 0 ? 'sent' : 'no_config',
        });
        for (const config of webhookConfigs || []) {
          fetch(config.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(createdPayload) }).catch(() => {});
        }
      } catch (webhookErr) { /* non-critical */ }

      // Send push notification to professional
      try {
        const { data: profProfile } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('id', selectedProfessional)
          .single();
        if (profProfile?.user_id) {
          supabase.functions.invoke('send-push', {
            body: {
              user_id: profProfile.user_id,
              title: 'Novo agendamento',
              body: `${clientForm.full_name} marcou horário às ${selectedTime}`,
              url: '/dashboard',
            },
          }).catch(() => {});
        }
      } catch { /* non-critical */ }

      const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
      const bookedServiceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean) as string[];
      setBookingResult({
        appointmentId: appointmentId as string,
        professionalName: professionalProfile?.full_name || 'Profissional',
        professionalAvatar: professionalProfile?.avatar_url || null,
        serviceNames: bookedServiceNames, date: selectedDate, time: selectedTime,
        totalPrice: finalPrice, totalDuration, companyName: company.name,
        companyPhone: (company as any).whatsapp || company.phone || companySettings?.whatsapp_number || null,
        companyAddress: [(company as any).address, (company as any).address_number ? `${(company as any).address_number}` : null].filter(Boolean).join(', ') + ((company as any).district ? ` - ${(company as any).district}` : '') || null,
        companyCity: (company as any).city || null,
        companyState: (company as any).state || null,
        companyPostalCode: (company as any).postal_code || null,
      });

      // Save last booking for smart rebooking
      try {
        const lastBooking = {
          serviceIds: selectedServices,
          serviceNames: bookedServiceNames,
          serviceDurations: selectedServices.map(sid => services.find(s => s.id === sid)?.duration_minutes || 0),
          professionalId: selectedProfessional,
          professionalName: professionalProfile?.full_name || '',
          professionalAvatar: professionalProfile?.avatar_url || null,
          totalPrice: finalPrice,
          totalDuration,
          bookedAt: new Date().toISOString(),
        };
        localStorage.setItem(`last_booking_${company.id}`, JSON.stringify(lastBooking));
      } catch { /* non-critical */ }

      setStep('success');
    } catch (err: any) {
      const info = translateBookingError(err);
      setBookingError(info);
      // Conflict → user is on a stale slot list; refresh availability for the day
      if (info.kind === 'conflict' || info.kind === 'invalid_slot') {
        setStep('datetime');
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Loading State ───
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

  // ─── No Professionals State ───
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
    ? ['services', 'datetime', 'client', 'confirm']
    : ['services', 'professional', 'datetime', 'client', 'confirm'];
  const stepLabels: Record<string, string> = {
    services: 'Serviços', professional: 'Profissional', datetime: 'Horário', client: 'Dados', confirm: 'Confirmar',
  };
  const currentStepIdx = stepList.indexOf(step);

  console.log('[FINAL SLOTS UI]', availableSlots.map((slot) => formatSlotTime(slot)));

  const companySlugPath = company.business_type === 'esthetic' ? 'estetica' : 'barbearia';
  const companyPageUrl = `/${companySlugPath}/${company.slug}`;
  const displayCoverUrl = company.cover_url;
  const companyWhatsapp = company.phone || companySettings?.whatsapp_number;

  // ─── Render ───
  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.text }}>
      {/* Banner */}
      {displayCoverUrl && (
        <div className="w-full h-36 sm:h-48 overflow-hidden">
          <img src={displayCoverUrl} alt={company.name} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Header */}
      <header style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <a href={companyPageUrl} className="shrink-0">
            {displayLogoUrl ? (
              <img src={displayLogoUrl} alt={company.name} className="max-h-11 max-w-[120px] object-contain" />
            ) : (
              <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: T.accent }}>
                <Icon className="h-5 w-5 text-black" />
              </div>
            )}
          </a>
          <div className="min-w-0 flex-1">
            <h1 className="font-bold text-lg tracking-tight">{company.name}</h1>
            {companyStats && companyStats.reviewCount > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                <StarRating rating={companyStats.avgRating} size={14} />
                <span className="text-xs font-semibold" style={{ color: '#FDBA2D' }}>{companyStats.avgRating.toFixed(1)}</span>
                <span className="text-xs" style={{ color: T.textSec }}>({companyStats.reviewCount} avaliações)</span>
              </div>
            ) : (
              <p className="text-xs" style={{ color: T.textSec }}>
                {businessType === 'barbershop' ? 'Barbearia' : 'Estética'} • Agendamento online
              </p>
            )}
          </div>
          <button
            onClick={() => setShowReviewModal(true)}
            className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
            style={{ background: `${T.accent}20`, color: '#FDBA2D' }}
          >
            Avaliar
          </button>
        </div>
      </header>

      {/* Persistent Professional Card (visible after professional is selected) */}
      {selectedProfessional && professionals.length > 0 && step !== 'success' && step !== 'professional' && (() => {
        const prof = professionals.find(p => p.id === selectedProfessional);
        if (!prof) return null;
        const rating = professionalRatings[prof.id];
        return (
          <div className="max-w-2xl mx-auto px-4 pt-6">
            <div className="flex items-center gap-4 p-4 rounded-2xl" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              {prof.avatar_url ? (
                <img src={prof.avatar_url} alt={prof.full_name} className="w-16 h-16 rounded-full object-cover shrink-0" style={{ border: `2.5px solid ${T.accent}` }} />
              ) : (
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold shrink-0" style={{ background: `${T.accent}20`, color: T.accent, border: `2.5px solid ${T.accent}` }}>
                  {prof.full_name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="font-bold text-lg leading-tight truncate">{prof.full_name}</p>
                {rating && (
                  <p className="flex items-center gap-1 text-sm mt-0.5" style={{ color: T.accent }}>
                    <Star className="h-3.5 w-3.5 fill-current" /> {rating.avg.toFixed(1)}
                    <span className="font-normal" style={{ color: T.textSec }}>({rating.count} avaliações)</span>
                  </p>
                )}
                <p className="text-xs mt-0.5 truncate" style={{ color: T.textSec }}>{company.name}</p>
                {recentBookings !== null && recentBookings >= 1 && (
                  <p className="text-xs mt-1 font-medium" style={{ color: T.greenText }}>
                    {recentBookings >= 5
                      ? '🔥 Muito procurado esta semana'
                      : recentBookings >= 2
                        ? `👥 ${recentBookings} pessoas agendaram recentemente`
                        : '👤 1 pessoa agendou recentemente'}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress */}
        {step !== 'success' && (
          <div className="flex items-center gap-1">
            {stepList.map((s, i) => (
              <div key={s} className="flex-1 flex flex-col items-center gap-1">
                <div className="h-1.5 w-full rounded-full transition-all duration-500" style={{ background: i <= currentStepIdx ? T.accent : T.border }} />
                <span className="text-[10px] font-medium tracking-wide uppercase" style={{ color: i <= currentStepIdx ? T.accent : T.textSec }}>
                  {stepLabels[s]}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Promotion Banner */}
        {isPromoMode && promoData && step !== 'success' && (
          <div className="rounded-2xl p-4 space-y-2" style={{ background: `${T.accent}15`, border: `1px solid ${T.accent}40` }}>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={{ color: T.accent }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>
                {isCashbackPromo ? 'Promoção Cashback' : 'Promoção'}
              </span>
            </div>
            <p className="font-bold text-base">{promoData.title}</p>
            {isCashbackPromo ? (
              <div className="space-y-1">
                <p className="text-sm" style={{ color: T.accent }}>
                  💰 Ganhe {promoData.discount_type === 'percentage' ? `${promoData.discount_value}%` : `R$ ${Number(promoData.discount_value || 0).toFixed(2)}`} de cashback após concluir o serviço!
                </p>
                {promoData.cashback_validity_days && (
                  <p className="text-xs" style={{ color: T.textSec }}>
                    Válido por {promoData.cashback_validity_days} dias para uso no próximo agendamento
                  </p>
                )}
              </div>
            ) : (
              promoData.service_name && (
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: T.textSec }}>{promoData.service_name}</span>
                  {promoData.original_price != null && promoData.promotion_price != null && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm line-through" style={{ color: T.textSec }}>R$ {Number(promoData.original_price).toFixed(2)}</span>
                      <span className="text-sm font-bold" style={{ color: T.accent }}>R$ {Number(promoData.promotion_price).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}

        {/* ═══ SERVICES ═══ */}
        {step === 'services' && (
          <div className="space-y-5 animate-fade-in">

            <div>
              <h2 className="text-2xl font-bold tracking-tight">{isPromoMode ? 'Escolha um serviço da promoção' : 'Escolha os serviços'}</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>{isCashbackPromo ? 'Selecione o serviço e ganhe cashback após concluir' : isPromoMode ? 'Selecione o serviço que deseja agendar com desconto' : 'Selecione um ou mais serviços desejados'}</p>
            </div>
            {/* Cashback balance indicator */}
            {cashbackCredits.length > 0 && cashbackTotal > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: '#10b98115', border: '1px solid #10b98130' }}>
                <span className="text-lg">💳</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: '#10b981' }}>
                    Cashback disponível: R$ {cashbackTotal.toFixed(2)}
                  </p>
                  <p className="text-xs" style={{ color: T.textSec }}>Você pode usar este crédito na confirmação do agendamento</p>
                </div>
              </div>
            )}
            {/* Loyalty points indicator */}
            {loyaltyPoints > 0 && (
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: `${T.accent}10`, border: `1px solid ${T.accent}25` }}>
                <span className="text-lg">⭐</span>
                <div>
                  <p className="font-semibold text-sm" style={{ color: T.accent }}>
                    Você possui {loyaltyPoints} pontos no programa de fidelidade
                    {loyaltyPointValue > 0 && (
                      <span className="font-normal text-xs ml-1" style={{ color: T.textSec }}>
                        (equivalente a R$ {(loyaltyPoints * loyaltyPointValue).toFixed(2).replace('.', ',')})
                      </span>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: T.textSec }}>Acumule pontos e troque por recompensas</p>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {(() => {
                const promoServiceIds = promoData?.service_ids || (promoData?.service_id ? [promoData.service_id] : []);
                const filteredSvcs = isPromoMode && promoServiceIds.length > 0
                  ? services.filter(s => promoServiceIds.includes(s.id))
                  : services;
                return filteredSvcs;
              })().map((svc) => {
                const sel = selectedServices.includes(svc.id);
                const promoServiceIds = promoData?.service_ids || (promoData?.service_id ? [promoData.service_id] : []);
                const isPromoService = isPromoMode && promoServiceIds.includes(svc.id);
                return (
                  <div
                    key={svc.id}
                    onClick={() => {
                      if (isPromoMode && isPromoService) {
                        // In promo mode: single-select among promo services
                        setSelectedServices(sel ? [] : [svc.id]);
                      } else {
                        toggleService(svc.id);
                      }
                    }}
                    className="p-4 rounded-2xl transition-all duration-200 cursor-pointer hover:scale-[1.01]"
                    style={{
                      background: sel ? `${T.accent}10` : T.card,
                      border: `1.5px solid ${sel ? T.accent : T.border}`,
                      boxShadow: sel ? `0 0 20px ${T.accent}15` : '0 2px 8px rgba(0,0,0,0.2)',
                    }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: sel ? T.accent : `${T.accent}20` }}>
                        <Scissors className="h-5 w-5" style={{ color: sel ? '#000' : T.accent }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-[15px]">{svc.name}</p>
                        <span className="flex items-center gap-1 text-sm" style={{ color: T.textSec }}>
                          <Clock className="h-3.5 w-3.5" /> {svc.duration_minutes} min
                        </span>
                      </div>
                      {isPromoMode && promoData && !isCashbackPromo && promoServiceIds.includes(svc.id) ? (() => {
                        const orig = Number(svc.price);
                        let promo = orig;
                        if (promoData.discount_type === 'percentage' && promoData.discount_value) {
                          promo = orig * (1 - Number(promoData.discount_value) / 100);
                        } else if (promoData.discount_type === 'fixed_amount' && promoData.discount_value) {
                          promo = Math.max(0, orig - Number(promoData.discount_value));
                        } else if (promoData.promotion_price != null) {
                          promo = Number(promoData.promotion_price);
                        }
                        return (
                          <div className="text-right shrink-0">
                            <p className="text-sm line-through" style={{ color: T.textSec }}>R$ {orig.toFixed(2)}</p>
                            <p className="font-bold text-lg" style={{ color: T.accent }}>R$ {promo.toFixed(2)}</p>
                          </div>
                        );
                      })() : isCashbackPromo && promoServiceIds.includes(svc.id) ? (
                        <div className="text-right shrink-0">
                          <p className="font-bold text-lg" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                          <p className="text-xs" style={{ color: '#10b981' }}>💰 cashback</p>
                        </div>
                      ) : (
                        <p className="font-bold text-lg shrink-0" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedServices.length > 0 && (
              <div className="flex items-center justify-between p-4 rounded-2xl animate-fade-in" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="text-sm" style={{ color: T.textSec }}>
                  <span className="font-medium" style={{ color: T.text }}>{selectedServices.length}</span> serviço(s)
                  <span className="mx-2 opacity-30">•</span>{totalDuration} min
                  <span className="mx-2 opacity-30">•</span>
                  <span className="font-bold text-base" style={{ color: T.accent }}>R$ {totalPrice.toFixed(2)}</span>
                </div>
                <Button
                  onClick={async () => {
                    if (skipProfessionalStep) {
                      if (preselected.isActive() && selectedDate && selectedTime) {
                        setStep('client');
                      } else {
                        setStep('datetime');
                      }
                    } else {
                      const profs = await fetchProfessionals();
                      if (profs.length === 1) {
                        if (preselected.isActive() && selectedDate && selectedTime) {
                          setStep('client');
                        } else {
                          setStep('datetime');
                        }
                      } else {
                        setStep('professional');
                      }
                    }
                  }}
                  className="rounded-xl px-6 font-semibold shadow-lg transition-all hover:scale-105"
                  style={{ background: T.accent, color: '#000' }}
                >
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* ═══ PROFESSIONAL ═══ */}
        {step === 'professional' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setStep('services')} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Escolha o profissional</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Selecione quem irá atendê-lo</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {professionals.map((p) => {
                const sel = selectedProfessional === p.id;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setSelectedProfessional(p.id); fetchProfessionalHours(p.id); fetchRecentBookings(p.id); setStep(preselected.isActive() && selectedDate && selectedTime ? 'client' : 'datetime'); }}
                    className="p-5 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.02] text-center"
                    style={{
                      background: sel ? `${T.accent}10` : T.card,
                      border: `1.5px solid ${sel ? T.accent : T.border}`,
                      boxShadow: sel ? `0 0 24px ${T.accent}20` : '0 2px 12px rgba(0,0,0,0.25)',
                    }}
                  >
                    <div className="flex flex-col items-center gap-3">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={p.full_name} className="w-20 h-20 rounded-full object-cover" style={{ border: `3px solid ${sel ? T.accent : T.border}` }} />
                      ) : (
                        <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                          {p.full_name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-base">{p.full_name}</p>
                        {professionalRatings[p.id] ? (
                          <p className="text-xs mt-0.5 flex items-center justify-center gap-1" style={{ color: T.accent }}>
                            <Star className="h-3.5 w-3.5 fill-current" /> {professionalRatings[p.id].avg.toFixed(1)}
                            <span style={{ color: T.textSec }}>({professionalRatings[p.id].count} avaliações)</span>
                          </p>
                        ) : (
                          <p className="text-xs mt-0.5" style={{ color: T.textSec }}>Profissional</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ DATE/TIME ═══ */}
        {step === 'datetime' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setStep(skipProfessionalStep ? 'services' : 'professional')} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Escolha data e horário</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Selecione o melhor momento para você</p>
            </div>

            {/* Quick slot confirmation block */}
            {quickSlotSelected && selectedDate && selectedTime ? (
              <div className="space-y-4">
                <div className="rounded-2xl p-6 space-y-4" style={{ background: T.card, border: `1.5px solid ${T.accent}`, boxShadow: `0 0 24px ${T.accent}15` }}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${T.accent}20` }}>
                      <Zap className="h-4.5 w-4.5" style={{ color: T.accent }} />
                    </div>
                    <p className="font-bold text-base" style={{ color: T.accent }}>Horário selecionado</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: `${T.accent}15` }}>
                      <CalendarPlus className="h-6 w-6" style={{ color: T.accent }} />
                    </div>
                    <div>
                      <p className="font-semibold text-lg capitalize">
                        {isToday(selectedDate) ? 'Hoje' : isTomorrow(selectedDate) ? 'Amanhã' : format(selectedDate, "EEEE", { locale: ptBR })}
                        {' • '}
                        {format(selectedDate, "dd/MM", { locale: ptBR })}
                      </p>
                      <p className="text-2xl font-bold" style={{ color: T.accent }}>{selectedTime}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setQuickSlotSelected(false);
                      setSelectedTime(null);
                      setSelectedDate(undefined);
                    }}
                    className="w-full py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ border: `1px solid ${T.border}`, color: T.textSec }}
                  >
                    <RotateCcw className="h-3.5 w-3.5 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                    Alterar horário
                  </button>
                </div>
                <Button
                  onClick={() => setStep('client')}
                  className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]"
                  style={{ background: T.accent, color: '#000' }}
                >
                  Continuar <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            ) : (
              <>
                {/* Quick slots */}
                {nextSlots.length > 0 && (
                  <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `${T.accent}20` }}>
                        <Zap className="h-4 w-4" style={{ color: T.accent }} />
                      </div>
                      <p className="font-semibold text-sm">Próximos horários disponíveis</p>
                    </div>
                    {nextSlots.map(({ date, slots }) => {
                      const dayLabel = isToday(date) ? 'Hoje' : isTomorrow(date) ? 'Amanhã' : format(date, "EEEE, dd/MM", { locale: ptBR });
                      return (
                        <div key={date.toISOString()}>
                          <p className="text-xs font-medium mb-2 capitalize" style={{ color: T.textSec }}>{dayLabel}</p>
                          <div className="flex flex-wrap gap-2">
                            {slots.map((slot) => (
                              <button
                                key={`${date.toISOString()}-${slot}`}
                                onClick={() => handleQuickSlot(date, slot)}
                                className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                                style={{ background: T.cardHover, border: `1px solid ${T.border}`, color: T.text }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = T.accent; e.currentTarget.style.color = '#000'; e.currentTarget.style.borderColor = T.accent; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = T.cardHover; e.currentTarget.style.color = T.text; e.currentTarget.style.borderColor = T.border; }}
                              >
                                {formatSlotTime(slot)}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {nextSlotsLoading && <p className="text-sm" style={{ color: T.textSec }}>Buscando próximos horários...</p>}

                <p className="text-xs text-center" style={{ color: T.textSec }}>ou escolha uma data no calendário</p>

                <div className="booking-dark-calendar rounded-2xl p-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                  <CalendarPicker
                    mode="single" selected={selectedDate}
                    onSelect={(date) => { setSelectedDate(date); setSelectedTime(null); }}
                    locale={ptBR}
                    disabled={(date) => {
                      const today = new Date(new Date().setHours(0, 0, 0, 0));
                      if (date < today) return true;
                      if (isPromoMode && promoData) {
                        const startDate = new Date(promoData.start_date + 'T00:00:00');
                        const endDate = new Date(promoData.end_date + 'T23:59:59');
                        return date < startDate || date > endDate;
                      }
                      return false;
                    }}
                    className="mx-auto"
                  />
                </div>

                {selectedDate && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold">
                      Horários disponíveis
                      {totalDuration > 0 && <span className="font-normal ml-2" style={{ color: T.textSec }}>(bloco de {totalDuration} min)</span>}
                    </p>
                    {slotsLoading || !appointmentsLoaded ? (
                      <div className="flex items-center gap-2 py-4" style={{ color: T.textSec }}>
                        <div className="w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: `${T.accent} transparent transparent transparent` }} />
                        <span className="text-sm">{slotsLoading ? 'Calculando disponibilidade...' : 'Carregando agendamentos...'}</span>
                      </div>
                    ) : availableSlots.length === 0 ? (
                      <div className="space-y-3">
                        <p className="text-sm" style={{ color: T.textSec }}>
                          {businessHours.length === 0 ? 'Horários de funcionamento não configurados' : 'Nenhum horário disponível neste dia'}
                        </p>
                        <div className="p-4 rounded-2xl" style={{ background: `${T.accent}08`, border: `1px dashed ${T.accent}40` }}>
                          <div className="flex items-start gap-3">
                            <Bell className="h-5 w-5 mt-0.5 shrink-0" style={{ color: T.accent }} />
                            <div className="flex-1">
                              <p className="font-semibold text-sm">Quer ser avisado se surgir vaga?</p>
                              <p className="text-xs mt-1" style={{ color: T.textSec }}>
                                Entre na lista de espera e avisaremos quando um horário ficar disponível para {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}.
                              </p>
                              <button
                                className="mt-3 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1.5 transition-all hover:scale-105"
                                style={{ border: `1px solid ${T.accent}`, color: T.accent }}
                                onClick={() => setShowWaitlistForm(true)}
                              >
                                <Bell className="h-3.5 w-3.5" />
                                Avisar se surgir vaga
                              </button>
                            </div>
                          </div>
                        </div>

                        {waitlistSuccess && (
                          <div className="mt-4 p-6 rounded-2xl border text-center space-y-2" style={{ borderColor: '#10B98140', background: '#10B98110' }}>
                            <div className="text-3xl">✅</div>
                            <p className="font-semibold text-sm" style={{ color: '#10B981' }}>Você entrou na lista de espera!</p>
                            <p className="text-xs" style={{ color: T.textSec }}>Avisaremos no WhatsApp se surgir uma vaga.</p>
                            <button
                              className="mt-3 px-4 py-2 rounded-xl text-sm font-medium"
                              style={{ color: T.accent, border: `1px solid ${T.accent}` }}
                              onClick={() => {
                                setWaitlistSuccess(false);
                                setStep('services');
                                setSelectedServices([]);
                                setSelectedProfessional(null);
                                setSelectedDate(undefined);
                                setSelectedTime(null);
                              }}
                            >
                              Voltar ao início
                            </button>
                          </div>
                        )}

                        {showWaitlistForm && !waitlistSuccess && (
                          <div className="mt-4 p-4 rounded-2xl border space-y-3" style={{ borderColor: `${T.accent}40`, background: `${T.accent}05` }}>
                            <p className="font-semibold text-sm">Dados para lista de espera</p>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs font-medium block mb-1">Nome *</label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                  style={{ background: '#FFFFFF', color: '#111827' }}
                                  placeholder="Seu nome"
                                  value={waitlistForm.name}
                                  onChange={(e) => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium block mb-1">WhatsApp *</label>
                                <input
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                  style={{ background: '#FFFFFF', color: '#111827' }}
                                  placeholder="(31) 99999-9999"
                                  value={waitlistForm.whatsapp}
                                  onChange={(e) => {
                                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                                    let masked = digits;
                                    if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                                    else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                                    setWaitlistForm(f => ({ ...f, whatsapp: masked }));
                                  }}
                                  maxLength={15}
                                />
                              </div>
                              <div>
                                <label className="text-xs font-medium block mb-1">Email (opcional)</label>
                                <input
                                  type="email"
                                  className="w-full px-3 py-2 rounded-lg border text-sm"
                                  style={{ background: '#FFFFFF', color: '#111827' }}
                                  placeholder="seu@email.com"
                                  value={waitlistForm.email}
                                  onChange={(e) => setWaitlistForm(f => ({ ...f, email: e.target.value }))}
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                className="px-4 py-2 rounded-xl text-sm font-medium"
                                style={{ color: T.textSec }}
                                onClick={() => setShowWaitlistForm(false)}
                              >
                                Cancelar
                              </button>
                              <button
                                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                                style={{ background: T.accent }}
                                onClick={handleJoinWaitlist}
                                disabled={waitlistLoading}
                              >
                                {waitlistLoading ? 'Entrando...' : 'Entrar na lista'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {availableSlots.map((slot) => {
                          const isSel = selectedTime === slot;
                          return (
                            <button
                              key={slot}
                              onClick={() => setSelectedTime(slot)}
                              className="py-2.5 rounded-xl text-sm font-medium transition-all duration-200 hover:scale-105"
                              style={{
                                background: isSel ? T.accent : T.cardHover,
                                color: isSel ? '#000' : T.text,
                                border: `1px solid ${isSel ? T.accent : T.border}`,
                                boxShadow: isSel ? `0 0 16px ${T.accent}30` : 'none',
                              }}
                            >
                              {formatSlotTime(slot)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {selectedTime && (
                  <Button
                    onClick={() => setStep('client')}
                    className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]"
                    style={{ background: T.accent, color: '#000' }}
                  >
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                )}

                {/* Custom Request Button */}
                {allowCustomRequests && !isPromoMode && (
                  <button
                    onClick={() => setShowCustomRequestForm(true)}
                    className="w-full text-center py-3 rounded-xl text-sm font-medium transition-all hover:opacity-80"
                    style={{ color: T.accent, border: `1px dashed ${T.accent}40` }}
                  >
                    <Clock className="h-4 w-4 inline mr-1.5" style={{ verticalAlign: '-2px' }} />
                    Solicitar horário personalizado
                  </button>
                )}

                {/* Custom Request Form */}
                {company && (
                  <CustomRequestForm
                    open={showCustomRequestForm}
                    onOpenChange={setShowCustomRequestForm}
                    companyId={company.id}
                    services={services.map(s => ({ id: s.id, name: s.name }))}
                    professionals={professionals.map(p => ({ id: p.id, full_name: p.full_name }))}
                    themeColors={T}
                  />
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ CLIENT INFO ═══ */}
        {step === 'client' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => {
              if (preselected.isActive()) {
                setStep('services');
              } else {
                setStep('datetime');
              }
            }} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{savedClientId ? 'Confirme seus dados' : 'Seus dados'}</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>
                {savedClientId ? 'Dados carregados automaticamente' : 'Preencha para finalizar o agendamento'}
              </p>
            </div>
            {clientDataWasAutoFilled && (
              <div className="rounded-xl px-4 py-3 flex items-center justify-between" style={{ background: `${T.accent}10`, border: `1px solid ${T.accent}30` }}>
                <span className="text-sm" style={{ color: T.accent }}>✅ Seus dados foram preenchidos automaticamente</span>
                <button
                  onClick={() => {
                    setClientForm({ full_name: '', email: '', whatsapp: '', birth_date: '' });
                    setOptInWhatsapp(false);
                    setSavedClientId(null);
                    setClientDataWasAutoFilled(false);
                    if (company) {
                      localStorage.removeItem(`client_id_${company.id}`);
                      localStorage.removeItem(`client_data_${company.id}`);
                    }
                    localStorage.removeItem('meagendae_client_data');
                    toast.success('Dados limpos com sucesso');
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all hover:opacity-80"
                  style={{ background: T.card, border: `1px solid ${T.border}`, color: T.textSec }}
                >
                  🗑 Limpar
                </button>
              </div>
            )}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><User className="h-3.5 w-3.5" /> Nome completo *</Label>
                <Input value={clientForm.full_name} onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })} placeholder="Seu nome" className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><Phone className="h-3.5 w-3.5" /> WhatsApp *</Label>
                <Input
                  value={clientForm.whatsapp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let masked = digits;
                    if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                    else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                    setClientForm({ ...clientForm, whatsapp: masked });
                  }}
                  placeholder="(11) 99999-9999" maxLength={15}
                  className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
                />
                {clientForm.whatsapp && clientForm.whatsapp.replace(/\D/g, '').length > 0 && !isValidWhatsApp(clientForm.whatsapp) && (
                  <p className="text-sm text-red-400 mt-1">Número inválido. Use DDD + número.</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><Mail className="h-3.5 w-3.5" /> Email *</Label>
                <Input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="seuemail@exemplo.com" className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
              {!isClientLoggedIn && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}>🔒 Senha *</Label>
                  <Input type="password" value={clientPassword} onChange={(e) => setClientPassword(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
                  <p className="text-xs" style={{ color: T.textSec }}>Use no mínimo 8 caracteres. Evite senhas comuns como 123456. Se já tem conta, use sua senha.</p>
                </div>
              )}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><Cake className="h-3.5 w-3.5" /> Data de nascimento</Label>
                <Input type="date" value={clientForm.birth_date} onChange={(e) => setClientForm({ ...clientForm, birth_date: e.target.value })} className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
            </div>
            <div className="flex items-start gap-3 pt-1">
              <Checkbox id="opt-in-whatsapp" checked={optInWhatsapp} onCheckedChange={(v) => setOptInWhatsapp(v === true)} />
              <label htmlFor="opt-in-whatsapp" className="text-sm leading-snug cursor-pointer" style={{ color: T.textSec }}>
                Aceito receber lembretes e comunicações via WhatsApp. Posso cancelar a qualquer momento.
              </label>
            </div>
            {!clientForm.whatsapp && (
              <p className="text-sm mt-1" style={{ color: '#F87171' }}>Informe seu número de WhatsApp para continuar.</p>
            )}
            <Button
              onClick={async () => {
                if (!clientForm.whatsapp || !isValidWhatsApp(clientForm.whatsapp)) {
                  toast.error('Informe seu número de WhatsApp para continuar.');
                  return;
                }
                if (!clientForm.full_name.trim()) {
                  toast.error('Informe seu nome para continuar.');
                  return;
                }
                if (!clientForm.email?.trim()) {
                  toast.error('Informe seu email para continuar.');
                  return;
                }

                // ── Inline auth: sign in or sign up silently ──
                if (!isClientLoggedIn) {
                  if (!clientPassword || clientPassword.length < 8) {
                    toast.error('A senha deve ter no mínimo 8 caracteres.');
                    return;
                  }
                  setAuthLoading(true);
                  try {
                    const emailTrimmed = clientForm.email.trim().toLowerCase();
                    // Try sign in first
                    const { error: signInError } = await supabase.auth.signInWithPassword({
                      email: emailTrimmed,
                      password: clientPassword,
                    });
                    if (!signInError) {
                      toast.success('Login realizado!');
                      // link_client_to_user will be called when session is set
                      const formattedPhone = clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : '';
                      const { data: { user } } = await supabase.auth.getUser();
                      if (user) {
                        await supabase.rpc('link_client_to_user', {
                          p_user_id: user.id,
                          p_phone: formattedPhone || null,
                          p_email: emailTrimmed,
                        } as any);
                      }
                    } else {
                      // If invalid credentials, try sign up
                      const isInvalidCreds = /invalid login|invalid credentials/i.test(signInError.message);
                      if (!isInvalidCreds) {
                        toast.error(signInError.message);
                        setAuthLoading(false);
                        return;
                      }
                      const formattedPhone = clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : '';
                      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
                        email: emailTrimmed,
                        password: clientPassword,
                        options: {
                          emailRedirectTo: `${window.location.origin}/`,
                          data: {
                            full_name: clientForm.full_name.trim(),
                            whatsapp: formattedPhone,
                            role: 'client',
                          },
                        },
                      });
                      if (signUpError) {
                        const { diagnoseAuthError } = await import('@/lib/auth-errors');
                        toast.error(diagnoseAuthError(signUpError));
                        setAuthLoading(false);
                        return;
                      }
                      if (signUpData.user) {
                        toast.success('Conta criada com sucesso! 🎉 Agora você pode acompanhar seus agendamentos, cashback e pontos.');
                        await supabase.rpc('link_client_to_user', {
                          p_user_id: signUpData.user.id,
                          p_phone: formattedPhone || null,
                          p_email: emailTrimmed,
                        } as any);
                        // Welcome email — fire-and-forget
                        try {
                          const { sendWelcomeClientEmail } = await import('@/lib/email');
                          void sendWelcomeClientEmail({ email: emailTrimmed, name: clientForm.full_name.trim() });
                        } catch (e) { console.warn('[email] welcome client failed', e); }
                      }
                      toast.success('Conta criada!');
                    }
                  } catch (err: any) {
                    toast.error(err?.message || 'Erro ao autenticar');
                    setAuthLoading(false);
                    return;
                  }
                  setAuthLoading(false);
                }

                // Check if company has cashback or loyalty active — show benefits step
                const hasBenefits = (loyaltyPointValue > 0) || (isPromoMode && promoData?.promotion_type === 'cashback');
                if (hasBenefits && !savedClientId) {
                  setStep('benefits');
                } else {
                  setStep('confirm');
                }
              }}
              className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]"
              style={{ background: T.accent, color: '#000' }}
              disabled={authLoading || !clientForm.full_name.trim() || !clientForm.whatsapp || !isValidWhatsApp(clientForm.whatsapp) || !clientForm.email?.trim() || (!isClientLoggedIn && clientPassword.length < 8)}
            >
              {authLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#000 transparent transparent transparent' }} /> Estamos preparando sua conta...
                </div>
              ) : (
                <>Revisar Agendamento <ChevronRight className="h-4 w-4 ml-1" /></>
              )}
            </Button>
          </div>
        )}

        {/* ═══ BENEFITS CHOICE ═══ */}
        {step === 'benefits' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setStep('client')} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Ganhe benefícios!</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>
                Crie uma conta e acumule recompensas a cada serviço
              </p>
            </div>

            {/* Continue to confirm */}
            <Button
              onClick={() => setStep('confirm')}
              className="w-full rounded-xl py-6 font-semibold text-base shadow-lg"
              style={{ background: T.accent, color: '#000' }}
            >
              Continuar <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* ═══ CONFIRM ═══ */}
        {step === 'confirm' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setStep('client')} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Confirmar Agendamento</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Revise os detalhes antes de confirmar</p>
            </div>
            <div className="rounded-2xl p-5 space-y-5" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              {/* Promotion details */}
              {isPromoMode && promoData && (
                <>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: T.accent }} />
                    <span className="text-xs font-bold uppercase tracking-wider" style={{ color: T.accent }}>Promoção: {promoData.title}</span>
                  </div>
                  <div style={{ borderTop: `1px solid ${T.border}` }} />
                </>
              )}
              {/* Services */}
              <div>
                <p className="text-xs mb-2" style={{ color: T.textSec }}>Serviços</p>
                <div className="space-y-2">
                  {services.filter((s) => selectedServices.includes(s.id)).map((s) => (
                    <div key={s.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: T.accent }} />
                        <span className="text-sm font-medium">{s.name}</span>
                        <span className="text-xs" style={{ color: T.textSec }}>{s.duration_minutes} min</span>
                      </div>
                      {isPromoMode && promoData?.original_price != null && promoData?.promotion_price != null ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm line-through" style={{ color: T.textSec }}>R$ {Number(promoData.original_price).toFixed(2)}</span>
                          <span className="text-sm font-semibold" style={{ color: T.accent }}>R$ {Number(promoData.promotion_price).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="text-sm font-semibold" style={{ color: T.accent }}>R$ {Number(s.price).toFixed(2)}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}` }} />
              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs mb-1" style={{ color: T.textSec }}>Data</p>
                  <p className="font-semibold text-sm">{selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                </div>
                <div>
                  <p className="text-xs mb-1" style={{ color: T.textSec }}>Horário</p>
                  <p className="font-semibold text-sm">{selectedTime} • {totalDuration} min</p>
                </div>
              </div>
              <div style={{ borderTop: `1px solid ${T.border}` }} />
              {/* Cashback earn info — auto-detected or promo-based */}
              {cashbackEarnAmount > 0 && (
                <div className="rounded-xl p-3" style={{ background: '#10b98115', border: '1px solid #10b98130' }}>
                  <p className="font-semibold text-sm" style={{ color: '#10b981' }}>
                    💰 Você ganhará R$ {cashbackEarnAmount.toFixed(2)} de cashback
                  </p>
                  <p className="text-xs" style={{ color: T.textSec }}>
                    Crédito disponível após conclusão do serviço para usar no próximo agendamento
                  </p>
                </div>
              )}
              {/* Cashback credit (use existing credits) */}
              {cashbackCredits.length > 0 && (
                <div className="rounded-xl p-3" style={{ background: `${T.accent}15`, border: `1px solid ${T.accent}30` }}>
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <p className="font-semibold text-sm">💰 Cashback disponível: R$ {cashbackTotal.toFixed(2)}</p>
                      <p className="text-xs" style={{ color: T.textSec }}>Usar crédito neste agendamento</p>
                    </div>
                    <input type="checkbox" checked={useCashback} onChange={e => setUseCashback(e.target.checked)} className="w-5 h-5 rounded" />
                  </label>
                </div>
              )}
              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <div className="text-right">
                  {cashbackDiscount > 0 && (
                    <p className="text-xs line-through" style={{ color: T.textSec }}>R$ {totalPrice.toFixed(2)}</p>
                  )}
                  <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {finalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={() => {
                handleBook();
              }}
              className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]"
              style={{ background: T.accent, color: '#000' }}
              disabled={loading} size="lg"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: '#000 transparent transparent transparent' }} /> Agendando...
                </div>
              ) : (
                <><CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar Agendamento</>
              )}
            </Button>
          </div>
        )}

        {/* ═══ SUCCESS ═══ */}
        {step === 'success' && bookingResult && (() => {
          const st = new Date(bookingResult.date);
          const [h, m] = bookingResult.time.split(':').map(Number);
          st.setHours(h, m, 0, 0);
          const et = addMinutes(st, bookingResult.totalDuration);
          const savings = isPromoMode && promoData?.original_price != null && promoData?.promotion_price != null
            ? Number(promoData.original_price) - Number(promoData.promotion_price)
            : 0;

          const calUrl = () => {
            const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${bookingResult.serviceNames.join(', ')} - ${bookingResult.companyName}`)}&dates=${fmt(st)}/${fmt(et)}&details=${encodeURIComponent(`Profissional: ${bookingResult.professionalName}\nValor: R$ ${bookingResult.totalPrice.toFixed(2)}`)}`;
          };

          const waUrl = () => {
            const phone = bookingResult.companyPhone?.replace(/\D/g, '') || '';
            const baseUrl = window.location.origin;
            const addressLines: string[] = [];
            if (bookingResult.companyAddress) addressLines.push(bookingResult.companyAddress);
            if (bookingResult.companyCity || bookingResult.companyState) {
              addressLines.push([bookingResult.companyCity, bookingResult.companyState].filter(Boolean).join(' - '));
            }
            if (bookingResult.companyPostalCode) addressLines.push(`CEP: ${bookingResult.companyPostalCode}`);
            const promoLines = isPromoMode && promoData ? [
              `🎉 Promoção: *${promoData.title}*`,
              '',
              `✂️ Serviço: ${bookingResult.serviceNames.join(', ')}`,
              '',
              promoData.original_price != null ? `Preço normal: R$ ${Number(promoData.original_price).toFixed(2)}` : '',
              promoData.promotion_price != null ? `Preço promocional: R$ ${Number(promoData.promotion_price).toFixed(2)}` : '',
              savings > 0 ? `\n🔥 Você economizou R$ ${savings.toFixed(2)}` : '',
              '',
              '⚠ Promoção válida apenas para este horário.',
              '',
            ].filter(Boolean) : [];
            const msg = [
              'Olá! 👋',
              '',
              `Seu agendamento foi confirmado na *${bookingResult.companyName}* 💈`,
              '',
              ...promoLines,
              `📅 Data: ${format(bookingResult.date, "dd 'de' MMMM, yyyy", { locale: ptBR })}`,
              `⏰ Horário: ${bookingResult.time}`,
              ...(isPromoMode ? [] : [`✂️ Serviço: ${bookingResult.serviceNames.join(', ')}`]),
              `👤 Profissional: ${bookingResult.professionalName}`,
              ...(isPromoMode ? [] : [`💰 Valor: R$ ${bookingResult.totalPrice.toFixed(2)}`]),
              '',
              `📍 Local: *${bookingResult.companyName}*`,
              ...addressLines,
              '',
              ...(isPromoMode ? [
                'Caso precise cancelar:',
                '',
                `❌ Cancelar:`,
                `${baseUrl}/cancel/${bookingResult.appointmentId}`,
              ] : [
                'Se precisar alterar:',
                '',
                `🔁 Reagendar:`,
                `${baseUrl}/reschedule/${bookingResult.appointmentId}`,
                '',
                `❌ Cancelar:`,
                `${baseUrl}/cancel/${bookingResult.appointmentId}`,
              ]),
              '',
              '📱 Acompanhe seus horários, cashback e pontos:',
              `${baseUrl}/minha-conta`,
              '',
              'Se ainda não tiver cadastro completo, finalize para liberar seus benefícios! 🎁',
              '',
              'Obrigado! 🙏',
            ].join('\n');
            return buildWhatsAppUrl(phone.startsWith('55') ? phone : '55' + phone, msg);
          };

          const resetBooking = () => {
            setBookingResult(null); setStep('services'); setSelectedServices([]);
            setSelectedProfessional(null); setSelectedDate(undefined); setSelectedTime(null);
          };

          return (
            <div className="space-y-6 text-center animate-fade-in">
              <div className="flex justify-center pt-6">
                <div className="w-24 h-24 rounded-full flex items-center justify-center animate-scale-in" style={{ background: T.green }}>
                  <CheckCircle2 className="h-12 w-12" style={{ color: T.greenText }} />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Agendamento Confirmado!</h2>
                <p className="text-sm mt-2" style={{ color: T.textSec }}>Seu horário foi reservado com sucesso</p>
              </div>

              <div className="rounded-2xl p-5 space-y-5 text-left" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <div className="flex items-center gap-4">
                  {bookingResult.professionalAvatar ? (
                    <img src={bookingResult.professionalAvatar} alt={bookingResult.professionalName} className="w-14 h-14 rounded-full object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                      {bookingResult.professionalName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-xs" style={{ color: T.textSec }}>Profissional</p>
                    <p className="font-semibold text-base">{bookingResult.professionalName}</p>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${T.border}` }} />
                <div>
                  <p className="text-xs mb-2" style={{ color: T.textSec }}>Serviços</p>
                  <div className="flex flex-wrap gap-2">
                    {bookingResult.serviceNames.map((name) => (
                      <span key={name} className="px-3 py-1 rounded-lg text-xs font-medium" style={{ background: `${T.accent}15`, color: T.accent }}>{name}</span>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: T.textSec }}>📅 Data</p>
                    <p className="font-semibold text-sm">{format(bookingResult.date, "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: T.textSec }}>🕐 Horário</p>
                    <p className="font-semibold text-sm">{bookingResult.time}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: T.textSec }}>⏱️ Duração</p>
                    <p className="font-semibold text-sm">{bookingResult.totalDuration} min</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 shrink-0" style={{ color: T.textSec }} />
                  <div>
                    <p className="text-xs" style={{ color: T.textSec }}>Local</p>
                    <p className="font-semibold text-sm">{bookingResult.companyName}</p>
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${T.border}` }} />
                {isPromoMode && promoData ? (
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs mb-1" style={{ color: T.textSec }}>🎉 Promoção</p>
                      <p className="font-semibold text-sm">{promoData.title}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {promoData.original_price != null && (
                        <span className="text-sm line-through" style={{ color: T.textSec }}>R$ {Number(promoData.original_price).toFixed(2)}</span>
                      )}
                      <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {bookingResult.totalPrice.toFixed(2)}</span>
                    </div>
                    {savings > 0 && (
                      <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(34,197,94,0.15)' }}>
                        <span className="text-sm font-semibold" style={{ color: '#4ADE80' }}>🔥 Você economizou R$ {savings.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)' }}>
                      <span className="text-xs" style={{ color: T.accent }}>⚠ Promoção válida apenas para este horário.</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold">Total</span>
                    <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {bookingResult.totalPrice.toFixed(2)}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => window.open(calUrl(), '_blank')} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                  <CalendarPlus className="h-4 w-4" style={{ color: T.accent }} /> 📅 Salvar no Google Agenda
                </button>
                {bookingResult.companyPhone && (
                  <button onClick={() => window.open(waUrl(), '_blank')} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: '#25D366', color: '#fff' }}>
                    <MessageCircle className="h-4 w-4" /> 📲 Enviar confirmação no WhatsApp
                  </button>
                )}
                {bookingResult.companyAddress && (
                  <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(bookingResult.companyAddress!)}`, '_blank')} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105 col-span-2" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                    <MapPin className="h-4 w-4" style={{ color: T.accent }} /> 📍 Abrir localização
                  </button>
                )}
              </div>

              <div className={`grid ${isPromoMode ? 'grid-cols-1' : 'grid-cols-2'} gap-3`}>
                {!isPromoMode && (
                  <button onClick={() => window.location.href = `/reschedule/${bookingResult.appointmentId}`} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                    🔄 Reagendar
                  </button>
                )}
                <button onClick={() => window.location.href = `/cancel/${bookingResult.appointmentId}`} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: T.card, border: `1px solid ${T.border}`, color: '#F87171' }}>
                  ❌ Cancelar
                </button>
              </div>

              {/* ── Account Block (always logged in) ── */}
              <div className="rounded-2xl p-5 space-y-3" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-base font-semibold flex items-center gap-2">👤 Sua conta</p>
                <p className="text-sm" style={{ color: T.textSec }}>Acompanhe seus agendamentos, cashback e pontos de fidelidade.</p>
                {(cashbackTotal > 0 || loyaltyPoints > 0) && (
                  <div className="flex gap-3 text-sm font-medium">
                    {cashbackTotal > 0 && <span style={{ color: T.accent }}>💰 R${cashbackTotal.toFixed(2)}</span>}
                    {loyaltyPoints > 0 && <span style={{ color: T.accent }}>⭐ {loyaltyPoints} pts{loyaltyPointValue > 0 ? ` (R$${(loyaltyPoints * loyaltyPointValue).toFixed(2)})` : ''}</span>}
                  </div>
                )}
                {hasValidClient ? (
                  <Button onClick={() => window.location.href = '/minha-conta'} className="w-full rounded-xl py-5 font-semibold text-base" style={{ background: T.accent, color: '#000' }}>
                    <Calendar className="h-4 w-4 mr-2" /> Ver meus agendamentos
                  </Button>
                ) : (
                  <Button onClick={() => setShowCompleteSignup(true)} className="w-full rounded-xl py-5 font-semibold text-base" style={{ background: T.accent, color: '#000' }}>
                    <User className="h-4 w-4 mr-2" /> Concluir cadastro
                  </Button>
                )}
              </div>

              <div className="space-y-3 pt-2">
                <Button onClick={resetBooking} className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]" style={{ background: T.accent, color: '#000' }}>
                  <RotateCcw className="h-4 w-4 mr-2" /> Agendar outro serviço
                </Button>
                <button onClick={() => window.location.href = '/'} className="w-full py-3 rounded-xl text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
                  <Home className="h-4 w-4 mr-1 inline" /> Voltar ao início
                </button>
              </div>
            </div>
          );
        })()}
      </div>
      <div className="text-center py-4">
        <PlatformBranding isDark={isDark} hide={isWhitelabel} />
      </div>

      {/* Floating Meus Agendamentos Button */}
      {step !== 'success' && isClientLoggedIn && hasValidClient && (
        <button
          onClick={() => window.location.href = '/minha-conta'}
          className="fixed bottom-6 left-6 z-50 flex items-center gap-2 px-4 py-3 rounded-full shadow-xl transition-transform hover:scale-105 text-sm font-semibold"
          style={{ background: T.accent, color: '#000' }}
          title="Meus agendamentos"
        >
          <Calendar className="h-4 w-4" />
          <span className="hidden sm:inline">Meus agendamentos</span>
          <span className="sm:hidden">Agendamentos</span>
          {(cashbackTotal > 0 || loyaltyPoints > 0) && (
            <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: 'rgba(0,0,0,0.2)' }}>
              {cashbackTotal > 0 ? `R$${cashbackTotal.toFixed(0)}` : `${loyaltyPoints} pts`}
            </span>
          )}
        </button>
      )}

      {/* Complete signup modal: opens from "Concluir cadastro" button on success screen */}
      {company?.id && (
        <CompleteSignupModal
          open={showCompleteSignup}
          onOpenChange={setShowCompleteSignup}
          defaultName={clientForm.full_name}
          defaultEmail={clientForm.email}
          defaultWhatsapp={clientForm.whatsapp}
          defaultBirthDate={clientForm.birth_date}
          companyId={company.id}
          onSuccess={() => {
            setHasValidClient(true);
            window.location.href = '/minha-conta';
          }}
        />
      )}

      {/* Centralized booking error dialog with smart suggestions */}
      <BookingErrorDialog
        open={!!bookingError}
        onOpenChange={(o) => { if (!o) setBookingError(null); }}
        error={bookingError}
        suggestions={availableSlots}
        onPickSuggestion={(slot) => {
          setSelectedTime(slot);
          setBookingError(null);
          setStep('datetime');
        }}
        onRetry={() => setBookingError(null)}
        onSeeAvailable={() => {
          setBookingError(null);
          setStep('datetime');
        }}
      />

      {/* Floating WhatsApp Button */}
      {companyWhatsapp && step !== 'success' && (
        <a
          href={buildWhatsAppUrl(companyWhatsapp.replace(/\D/g, ''))}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-transform hover:scale-110"
          style={{ background: '#25D366' }}
          title="WhatsApp"
        >
          <MessageCircle className="h-6 w-6 text-white" />
        </a>
      )}

      {/* Review Modal */}
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
              <p className="text-xs text-right" style={{ color: T.textSec }}>{reviewComment.length}/500</p>
            </div>
            <Button
              disabled={submittingReview || reviewRating < 1}
              onClick={async () => {
                if (!company || reviewRating < 1) return;
                setSubmittingReview(true);
                try {
                  const { error } = await supabase.from('reviews').insert({
                    company_id: company.id,
                    professional_id: company.owner_id || selectedProfessional || professionals[0]?.id,
                    appointment_id: null as any,
                    rating: reviewRating,
                    comment: reviewComment.trim() || null,
                  } as any);
                  if (error) throw error;
                  toast.success('Avaliação enviada com sucesso!');
                  setShowReviewModal(false);
                  setReviewRating(0);
                  setReviewComment('');
                  // Refresh stats
                  const { data: newReviews } = await supabase.from('reviews').select('rating').eq('company_id', company.id);
                  if (newReviews && newReviews.length > 0) {
                    const avg = newReviews.reduce((s: number, r: any) => s + Number(r.rating), 0) / newReviews.length;
                    setCompanyStats(prev => ({ avgRating: avg, reviewCount: newReviews.length, completedCount: prev?.completedCount || 0 }));
                  }
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
