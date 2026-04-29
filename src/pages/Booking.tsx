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

// TZ-aware Hoje/Amanhã helpers — compare dates in America/Sao_Paulo, not the
// browser's local zone. Without this, a user in another timezone (or whose
// device clock is shifted near midnight) sees "Amanhã" for what is actually
// "Hoje" in São Paulo (and vice-versa).
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
import { CompleteSignupModal } from '@/components/CompleteSignupModal';
import { ExistingAccountModal } from '@/components/ExistingAccountModal';
import { IdentityModal } from '@/components/booking/IdentityModal';

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

type Step = 'identifying' | 'services' | 'professional' | 'datetime' | 'benefits' | 'confirm' | 'success';
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
  // Using the shared singleton supabase instance from @/integrations/supabase/client
  // to ensure state consistency across the entire application.
  // const supabase = bookingSupabase; // Removed local instance creation

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

  const [step, setStep] = useState<Step>('identifying');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
  const [bookingError, setBookingError] = useState<BookingErrorInfo | null>(null);
  const [clientForm, setClientForm] = useState({ full_name: '', email: '', whatsapp: '', birth_date: '' });
  const [clientPassword, setClientPassword] = useState('');
  const [isAuthLoading, setAuthLoading] = useState(false);
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
  const [smartSuggestion, setSmartSuggestion] = useState<{ date: Date; slot: string; reason: 'tight-fit' | 'first-available' } | null>(null);
  const [quickSlotSelected, setQuickSlotSelected] = useState(false);
  const [cashbackCredits, setCashbackCredits] = useState<{ id: string; amount: number; expires_at: string }[]>([]);
  const [useCashback, setUseCashback] = useState(false);
  const cashbackTotal = cashbackCredits.reduce((s, c) => s + Number(c.amount), 0);
  const [autoCashbackPromos, setAutoCashbackPromos] = useState<any[]>([]);
  const [loyaltyPoints, setLoyaltyPoints] = useState(0);
  const [loyaltyPointValue, setLoyaltyPointValue] = useState(0);
  const slotRequestRef = useRef(0);
  const { isAuthenticated: isAuthAuthenticated, user, profile, loading: authLoading, isAdmin } = useAuth();
  
  // Rule: Admin/Professional users are NEVER treated as clients on the public booking page.
  // They must identify themselves via WhatsApp just like a visitor.
  const isAuthenticated = isAuthAuthenticated && !isAdmin;
  
  const [hasValidClient, setHasValidClient] = useState(false);
  const [showCompleteSignup, setShowCompleteSignup] = useState(false);
  const [showExistingAccountModal, setShowExistingAccountModal] = useState(false);
  const [existingAccountMode, setExistingAccountMode] = useState<'email_exists' | 'whatsapp_exists' | 'both_exists'>('email_exists');
  const [showIdentityModal, setShowIdentityModal] = useState(false);
  
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(startOfWeek(new Date(), { locale: ptBR }));

  // Refined Premium Flow States
  const [showOneClickCard, setShowOneClickCard] = useState(false);
  const [isChangingData, setIsChangingData] = useState(false);
  const [lastProfessionalName, setLastProfessionalName] = useState<string | null>(null);
  const [lastServicePerformed, setLastServicePerformed] = useState<string | null>(null);
  const [abandonmentId, setAbandonmentId] = useState<string | null>(null);
  const sessionId = useMemo(() => {
    let id = localStorage.getItem('booking_session_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('booking_session_id', id);
    }
    return id;
  }, []);

  const [hasBenefitsActive, setHasBenefitsActive] = useState(false);
  const [lastBooking, setLastBooking] = useState<{
    serviceIds: string[]; serviceNames: string[]; serviceDurations: number[];
    professionalId: string; professionalName: string; professionalAvatar: string | null;
    totalPrice: number; totalDuration: number; bookedAt: string;
  } | null>(null);
  const [rebookDismissed, setRebookDismissed] = useState(false);
  const selectedSlotIsAvailable = selectedTime ? generatedSlots.includes(selectedTime) : false;
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

  // Fetch last professional and decide on one-click flow
  useEffect(() => {
    const fetchLastProfessional = async () => {
      if (!company?.id) return;
      const targetClientId = savedClientId;
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      if (!targetClientId && !currentUserId) return;

      const query = supabase
        .from('appointments')
        .select(`
          professional:profiles!appointments_professional_id_fkey(full_name),
          appointment_services(service:services(name))
        `)
        .eq('company_id', company.id)
        .eq('status', 'completed')
        .order('start_time', { ascending: false })
        .limit(1);

      if (currentUserId) {
        query.eq('user_id', currentUserId);
      } else {
        query.eq('client_id', targetClientId);
      }

      const { data } = await query.maybeSingle();
      if (data) {
        setLastProfessionalName((data.professional as any)?.full_name || null);
        const servicesList = (data.appointment_services as any[])?.map(s => s.service?.name).filter(Boolean);
        if (servicesList?.length > 0) {
          setLastServicePerformed(servicesList.join(', '));
        }
      }
    };

    fetchLastProfessional();
  }, [savedClientId, company?.id, isAuthenticated]);

  useEffect(() => {
    // Show one-click card if data exists AND we're not explicitly changing data,
    // OR if the client is logged in.
    if (clientLoaded && (clientDataWasAutoFilled || isAuthenticated) && !isChangingData) {
      setShowOneClickCard(true);
    } else {
      setShowOneClickCard(false);
    }
  }, [clientLoaded, clientDataWasAutoFilled, isChangingData, isAuthenticated]);

  // Check for cashback credits when client is identified
  useEffect(() => {
    const checkBenefits = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;
      
      // Determine if the current session is an admin/pro session that should be ignored for booking
      let ignoreSession = false;
      if (currentUserId) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('user_id', currentUserId)
          .single();
        
        if (profile && ['admin', 'professional', 'company', 'super_admin'].includes(profile.role)) {
          console.log('[BOOKING_SESSION_SOURCE] admin_session_ignored:', profile.role);
          ignoreSession = true;
        }
      }

      const effectiveUserId = ignoreSession ? null : currentUserId;
      
      if (!effectiveUserId && !savedClientId) {
        setCashbackCredits([]);
        setLoyaltyPoints(0);
        return;
      }

      if (company?.id) {
        console.log('[BOOKING_SESSION_SOURCE] client_session_loaded:', effectiveUserId ? 'auth_session' : 'local_storage');
        // Query cashback using direct user_id for isolation if logged in, or fallback to savedClientId
        const cashbackQuery = supabase
          .from('client_cashback')
          .select('id, amount, expires_at')
          .eq('company_id', company.id)
          .eq('status', 'active')
          .gt('expires_at', new Date().toISOString());

        if (effectiveUserId) {
          cashbackQuery.eq('user_id', effectiveUserId);
        } else {
          cashbackQuery.eq('client_id', savedClientId);
        }

        const { data: cbData } = await cashbackQuery;
        setCashbackCredits(cbData || []);

        // Query loyalty points
        const loyaltyQuery = supabase
          .from('loyalty_points_transactions' as any)
          .select('balance_after')
          .eq('company_id', company.id)
          .order('created_at', { ascending: false })
          .limit(1);

        if (effectiveUserId) {
          loyaltyQuery.eq('user_id', effectiveUserId);
        } else {
          loyaltyQuery.eq('client_id', savedClientId);
        }

        const { data: txs } = await loyaltyQuery.maybeSingle();
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
      }
    };
    
    checkBenefits();
  }, [savedClientId, company?.id, isAuthenticated]);

  // Check if client is logged in - Refined to ignore admin sessions
  // Identification Gatekeeper - require a valid client identity before booking.
  useEffect(() => {
    if (step === 'identifying' && company && !authLoading) {
      const localIdentityStr = localStorage.getItem(`whatsapp_session_${company.id}`);
      if (localIdentityStr) {
        try {
          const identity = JSON.parse(localIdentityStr);
          if (new Date(identity.expiresAt) > new Date()) {
            console.log('[BOOKING_FLOW] Valid WhatsApp identity found. Unlocking booking.');
            setClientForm({
              full_name: identity.fullName || identity.full_name || '',
              email: identity.email || '',
              whatsapp: displayWhatsApp(identity.whatsapp || ''),
              birth_date: identity.birth_date || '',
            });
            setHasValidClient(true);
            setClientDataWasAutoFilled(true);
            setShowIdentityModal(false);
            setStep(professionalSlug ? 'services' : 'professional');
            return;
          }
          localStorage.removeItem(`whatsapp_session_${company.id}`);
        } catch (e) {
          localStorage.removeItem(`whatsapp_session_${company.id}`);
        }
      }

      const isAdmin = profile && ['admin', 'professional', 'company', 'super_admin'].includes(profile.role);
      if (isAuthenticated && !isAdmin) {
        console.log('[BOOKING_FLOW] Authenticated client session found. Unlocking booking.');
        setStep(professionalSlug ? 'services' : 'professional');
        return;
      }

      console.log('[BOOKING_FLOW] Client identity required. Opening WhatsApp login.');
      setShowIdentityModal(true);
    }
  }, [company, step, professionalSlug, authLoading, isAuthenticated, profile]);


  // Check whether a valid `clients` record exists for this user in this company.
  // Used to decide whether to show "Ver meus agendamentos" vs "Concluir cadastro".
  useEffect(() => {
    const checkValidClient = async () => {
      if (!isAuthenticated || !company?.id) {
        setHasValidClient(false);
        return;
      }
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setHasValidClient(false);
        return;
      }

      // Check role again to be absolutely sure
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('user_id', user.id)
        .single();
      
      const isAdmin = profile && ['admin', 'professional', 'company', 'super_admin'].includes(profile.role);
      
      if (isAdmin) {
        setHasValidClient(false);
        return;
      }

      let { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('user_id', user.id)
        .eq('company_id', company.id)
        .maybeSingle();
      
      // 1. Verificar se existe uma sessão de identidade local (WhatsApp Session) válida
      const localIdentityStr = localStorage.getItem(`whatsapp_session_${company.id}`);
      if (localIdentityStr) {
        try {
          const identity = JSON.parse(localIdentityStr);
          const expiresAt = new Date(identity.expiresAt);
          
          if (expiresAt > new Date()) {
            console.log('[Booking] Valid local identity found:', identity.whatsapp);
            
            // Se já temos a identidade no formulário e no estado, não precisamos fazer nada
            // Mas vamos garantir que o hasValidClient esteja true
            setHasValidClient(true);
            
            // Preencher formulário se estiver vazio
            if (!clientForm.full_name || clientDataWasAutoFilled) {
              setClientForm({
                full_name: identity.fullName || '',
                email: identity.email || '',
                whatsapp: displayWhatsApp(identity.whatsapp || ''),
                birth_date: identity.birth_date || '',
              });
              setClientDataWasAutoFilled(true);
            }
            
            // Se já tem identidade válida via WhatsApp Session, não precisamos checar Supabase Auth
            // a menos que queiramos vincular. Mas o pedido é NÃO misturar.
            // No entanto, para o agendamento real, precisamos do isAuthenticated do useAuth.
            // Para agendamentos recorrentes com a mesma identidade, permitimos prosseguir.
            return;
          } else {
            console.log('[Booking] Local identity expired');
            localStorage.removeItem(`whatsapp_session_${company.id}`);
          }
        } catch (e) {
          console.error('[Booking] Error parsing local identity:', e);
        }
      }

      // 2. Se não houver identidade local válida, verificar Supabase Auth (Admin/Cliente Logado)
      
      // AUTO-CREATE local client if authenticated but no client record exists for this company
      // SEPARAÇÃO: Não criamos automaticamente se o usuário for ADMIN
      if (!data && !error && user && !isAdmin) {
        console.log('[Booking] Authenticated client has no record for this company. Creating automatically...');
        const normalizedPhone = normalizePhone(user.user_metadata?.whatsapp || user.phone || '');
        const clientName = user.user_metadata?.full_name || user.user_metadata?.name || 'Cliente';
        
        // 1. Ensure Global Client
        const { data: globalClient } = await (supabase
          .from('clients_global' as any)
          .upsert({
            user_id: user.id,
            whatsapp: normalizedPhone || null,
            name: clientName,
            email: user.email,
          }, { onConflict: 'whatsapp' })
          .select()
          .single() as any);

        // 2. Create Local Client
        const { data: newClient, error: createError } = await (supabase
          .from('clients' as any)
          .upsert({
            company_id: company.id,
            user_id: user.id,
            global_client_id: globalClient?.id,
            name: clientName,
            whatsapp: normalizedPhone || null,
            email: user.email,
          }, { onConflict: 'company_id, user_id' })
          .select()
          .single() as any);

        if (createError) {
          console.error('[Booking] Failed to auto-create client:', createError);
        } else {
          data = newClient;
        }
      }

      if (data) {
        setHasValidClient(true);
        // Automatic recognition: Pre-fill form if not already filled or if it was just auto-filled
        if (!clientForm.full_name || clientDataWasAutoFilled) {
          setClientForm({
            full_name: data.name || '',
            email: data.email || '',
            whatsapp: displayWhatsApp(data.whatsapp || ''),
            birth_date: data.birth_date || '',
          });
          setOptInWhatsapp(data.opt_in_whatsapp || false);
          setSavedClientId(data.id);
          setClientDataWasAutoFilled(true);
        }
      } else {
        setHasValidClient(false);
      }
    };
    checkValidClient();
  }, [isAuthenticated, company?.id, bookingResult?.appointmentId]);

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
    if (slug) {
      fetchCompany();
    }
  }, [slug]);

  useEffect(() => {
    if (company?.id && !professionalSlug && !promoIdRef.current) {
      fetchProfessionals(company.id);
    }
  }, [selectedServices, company?.id, professionalSlug]);

  const fetchCompany = async () => {
    const { data: compArr } = await supabase.rpc('get_company_by_slug', { _slug: slug! });
    const comp = compArr?.[0];
    if (!comp) return null;
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
      if (pd && pd.company_id === comp.id && isPromoActive(pd)) {
        setPromoData(pd as PromotionInfo);
        
        // Auto-select promo services (aggressive)
        const promoServiceIds = pd.service_ids || (pd.service_id ? [pd.service_id] : []);
        if (promoServiceIds.length > 0) {
          setSelectedServices(promoServiceIds);
        }

        // Auto-select promo date if set
        if (pd.start_date) {
          const pDate = parseISO(pd.start_date);
          if (pDate >= startOfDay(new Date())) {
            setSelectedDate(pDate);
          }
        }

        // Auto-select professional if only one or first from promo
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
          } catch (e) {
            console.warn('[Booking] Error auto-linking services to professionals:', e);
          }
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

      // Filter slots based on promotion time window if applicable
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
      console.error('[Booking] Failed to load appointments for slot calculation', error);
      setAppointmentsLoaded(true);
      setAvailableSlots([]);
      setGeneratedSlots([]);
    } finally {
      if (requestId === slotRequestRef.current) setSlotsLoading(false);
    }
  };

  useEffect(() => {
    if (preselected.isLockedTime(selectedTime)) {
      // Locked slot — preserve time
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
    let timeout: ReturnType<typeof setTimeout>;
    if (slotsLoading) {
      timeout = setTimeout(() => {
        setSlotsLoading(false);
        if (!appointmentsLoaded) {
          console.warn('[Booking] Slot calculation timeout');
          setAppointmentsLoaded(true);
        }
      }, 10000); // 10s security timeout
    }
    return () => clearTimeout(timeout);
  }, [slotsLoading, appointmentsLoaded]);

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
    const MAX_DAYS = 7;
    
    // Fetch slots for the current visible week
    const days = eachDayOfInterval({
      start: currentWeekStart,
      end: addDays(currentWeekStart, 6)
    });
    
    // Also ensure selectedDate is included if it's outside the current week
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

      // Bug 2 Fix: Intelligent Suggestion prioritization
      if (selectedDate) {
        const res = dayResults.find(r => isSameDay(r.date, selectedDate));
        const slot = res ? getFirstSlot(res) : null;
        if (slot) {
          suggestion = { date: selectedDate, slot, reason: 'first-available' };
        }
      } else {
        // Fallback for first entry
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
      console.error('[Booking] Failed to fetch next available slots', error);
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
        p_client_whatsapp: normalizePhone(waitlistForm.whatsapp),
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
    // Autenticação desativada por solicitação. 
    // O agendamento agora é livre apenas com Nome e WhatsApp.
    
    // Validar apenas se os dados básicos estão no form antes de prosseguir
    if (!clientForm.full_name || !clientForm.whatsapp) {
      toast.error('Por favor, informe seu nome e WhatsApp para concluir.');
      return;
    }


    setLoading(true);
    try {
      let { data: { user } } = await supabase.auth.getUser();
      
      // Se não houver usuário autenticado no Supabase, mas houver sessão de identidade local válida,
      // podemos prosseguir usando a identidade local. 
      // Nota: Algumas operações podem falhar se exigirem auth.uid() no banco.
      // O sistema deve ser capaz de lidar com "Anonymous Guest" se a política permitir.
      
      const localIdentityStr = localStorage.getItem(`whatsapp_session_${company.id}`);
      let localIdentity: any = null;
      if (localIdentityStr) {
        try {
          const parsed = JSON.parse(localIdentityStr);
          if (new Date(parsed.expiresAt) > new Date()) {
            localIdentity = parsed;
          }
        } catch (e) { /* ignore */ }
      }

      // OBRIGATÓRIO: Verificar se o usuário é admin
      // OBRIGATÓRIO: Verificar se o usuário é admin
      const userRole = profile?.role || 'client';
      const isAdmin = ['admin', 'professional', 'company', 'super_admin'].includes(userRole);

      const normalizedPhone = clientForm.whatsapp ? normalizePhone(clientForm.whatsapp) : (localIdentity?.whatsapp || '');
      const clientName = clientForm.full_name || localIdentity?.fullName || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Cliente';
      const clientEmail = clientForm.email || localIdentity?.email || user?.email || null;

      console.log('[BOOKING_FLOW] Starting book process:', { 
        normalizedPhone, 
        isAdmin, 
        authUserId: user?.id 
      });

      // Simplificado: Não fazemos mais o upsert no frontend. 
      // O RPC create_appointment_v2 agora cuida disso internamente se p_client_id for null.
      const clientId = null; // Deixamos o banco resolver via nome/whatsapp
      const formattedWhatsapp = clientForm.whatsapp ? normalizePhone(clientForm.whatsapp) : null;

      if (!selectedSlotIsAvailable) {
        setBookingError({
          kind: 'invalid_slot',
          title: 'Este horário não está mais disponível',
          description: 'A agenda foi atualizada e o horário selecionado saiu da lista válida.',
          hint: 'Escolha um dos horários disponíveis abaixo.',
          suggestions: generatedSlots,
        });
        setStep('datetime');
        setLoading(false);
        return;
      }


      const freshAvailability = await getAvailableSlots({
        source: 'public',
        companyId: company.id,
        professionalId: selectedProfessional,
        date: selectedDate,
        totalDuration,
        filterPastForToday: true,
      });

      setAppointmentsForSelectedDate(freshAvailability.existingAppointments);
      setAppointmentsLoaded(true);
      setAvailableSlots(freshAvailability.slots);
      setGeneratedSlots(freshAvailability.slots);

      console.log('[SELECTED_SLOT]', selectedTime);
      console.log('[BOOKINGS_USED]', freshAvailability.existingAppointments);
      console.log('[REAL_SLOTS]', freshAvailability.slots);

      if (!freshAvailability.slots.includes(selectedTime)) {
        setBookingError({
          kind: 'conflict',
          title: 'Este horário não está mais disponível',
          description: 'Atualizamos a agenda com os horários realmente livres para você escolher novamente.',
          hint: 'Selecione um dos horários atualizados abaixo.',
          suggestions: freshAvailability.slots,
        });
        setStep('datetime');
        setLoading(false);
        return;
      }

      const { start: startTime, end: endTime } = buildBookingUtcRange(
        selectedDate,
        selectedTime,
        totalDuration,
        bookingTimezone,
      );
      // clientId is null intentionally, RPC will handle creation

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
        setBookingError({
          kind: 'conflict',
          title: 'Este horário acabou de ser ocupado',
          description: 'Outra reserva entrou antes da confirmação.',
          hint: 'Escolha um dos horários reais atualizados abaixo.',
          suggestions: freshAvailability.slots,
        });
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
        p_client_id: clientId,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_total_price: finalPrice,
        p_client_name: clientForm.full_name ?? null,
        p_client_whatsapp: formattedWhatsapp ?? null,
        p_notes: null as string | null,
        p_promotion_id: promoData?.id ?? null,
        p_services: aptServicesPayload,
        p_cashback_ids: useCashback && cashbackCredits.length > 0 ? cashbackCredits.map(c => c.id) : [],
        p_user_id: user?.id ?? null
      };

      console.log('[BOOKING_INSERT_ATTEMPT]', { 
        professionalId: selectedProfessional,
        clientId,
        time: selectedTime,
        payload: appointmentPayloadV2 
      });

      const { data: appointmentId, error: aptError } = await supabase
        .rpc('create_appointment_v2' as any, appointmentPayloadV2 as any);

      console.log('[BOOKING_INSERT_RESULT]', { appointmentId, error: aptError });

      if (aptError) {
        console.error('[BOOKING_COMPLETE_ERROR]', JSON.stringify(aptError, null, 2));
        throw aptError;
      }
      
      if (!appointmentId) {
        console.error('[BOOKING_ERROR] No appointment ID returned from RPC');
        throw new Error('Falha ao processar agendamento. O servidor não retornou um ID.');
      }
      
      console.log('[BOOKING_SUCCESS] Transaction confirmed:', appointmentId);


      try {
        const { data: webhookConfigs } = await supabase
          .from('webhook_configs').select('url')
          .eq('company_id', company.id).eq('event_type', 'appointment_created').eq('active', true);
        const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
        const serviceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean);
        const createdPayload = {
          event: 'appointment_created', appointment_id: appointmentId, company_id: company.id,
          client_name: clientForm.full_name, client_whatsapp: normalizePhone(clientForm.whatsapp),
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

      // Fire Make automation webhook (public flow) — non-blocking
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
      } catch { /* silent */ }

      // Notificação push agora é disparada automaticamente pelo backend via trigger
      console.log('Push notification scheduled via backend');

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
      console.error('[BOOKING_FATAL_ERROR]', err);
      
      // Detailed error log for Supabase
      if (err.code || err.message) {
        console.error('[BOOKING_ERROR_DETAILS]', {
          code: err.code,
          message: err.message,
          hint: err.hint,
          details: err.details
        });
      }

      const info = translateBookingError(err);
      if ((info.kind === 'conflict' || info.kind === 'invalid_slot') && company && selectedDate && selectedProfessional) {
        const freshAvailability = await getAvailableSlots({
          source: 'public',
          companyId: company.id,
          professionalId: selectedProfessional,
          date: selectedDate,
          totalDuration,
          filterPastForToday: true,
        });

        setAppointmentsForSelectedDate(freshAvailability.existingAppointments);
        setAppointmentsLoaded(true);
        setAvailableSlots(freshAvailability.slots);
        setGeneratedSlots(freshAvailability.slots);
        setBookingError({ ...info, suggestions: freshAvailability.slots });
        setStep('datetime');
      } else {
        setBookingError(info);
      }
      
      // Prevent success message if it failed
      setBookingResult({ appointmentId: '', success: false });
      toast.error(err.message || 'Ocorreu um erro ao processar seu agendamento.');
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
    ? ['services', 'datetime', 'confirm']
    : ['services', 'professional', 'datetime', 'confirm'];
  const stepLabels: Record<string, string> = {
    services: 'Serviços', professional: 'Profissional', datetime: 'Horário', confirm: 'Confirmar',
  };
  const currentStepIdx = stepList.indexOf(step);

  console.log('[UI RECEIVED]', availableSlots);

  const companySlugPath = company.business_type === 'esthetic' ? 'estetica' : 'barbearia';
  const companyPageUrl = `/${companySlugPath}/${company.slug}`;
  const displayCoverUrl = company.cover_url;
  const companyWhatsapp = company.phone || companySettings?.whatsapp_number;

  // ─── Render ───
  return (
    <div className={cn("min-h-screen font-sans tracking-tight", (selectedServices.length > 0 && step === 'services') ? "pb-32" : "pb-20 sm:pb-0")} style={{ background: T.bg, color: T.text }}>
      {/* DEBUG BANNER REMOVIDO */}

      {/* Premium Header Fixo */}
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
        
        {/* Mobile Progress Bar */}
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

      {/* Persistent Professional Card */}
      {selectedProfessional && professionals.length > 0 && step !== 'success' && step !== 'professional' && (() => {
        const prof = professionals.find(p => p.id === selectedProfessional);
        if (!prof) return null;
        return (
          <div className="max-w-2xl mx-auto px-4 pt-8">
            <div 
              className="flex items-center gap-5 p-5 rounded-[2.5rem] animate-in fade-in slide-in-from-top-6 duration-700 relative overflow-hidden group" 
              style={{ 
                background: `linear-gradient(135deg, ${T.card}, ${T.bg})`, 
                border: `2px solid ${T.accent}`, 
                boxShadow: `0 20px 40px -12px ${T.accent}40` 
              }}
            >
              <div className="absolute top-0 right-0 p-12 blur-3xl rounded-full -mr-10 -mt-10 opacity-10 pointer-events-none" style={{ background: T.accent }} />
              
              <div className="relative shrink-0">
                {prof.avatar_url ? (
                  <img src={prof.avatar_url} alt={prof.full_name} className="w-16 h-16 rounded-[1.5rem] object-cover shadow-2xl transition-transform group-hover:scale-105" style={{ border: `2px solid ${T.accent}` }} />
                ) : (
                  <div className="w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-2xl font-black shadow-2xl" style={{ background: `${T.accent}15`, color: T.accent, border: `2px solid ${T.accent}` }}>
                    {prof.full_name?.charAt(0)?.toUpperCase()}
                  </div>
                )}
                <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 border-2 rounded-full flex items-center justify-center shadow-xl" style={{ borderColor: T.card }}>
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-black text-lg tracking-tight truncate uppercase" style={{ color: T.accent }}>{prof.full_name}</p>
                  <Badge className="bg-amber-500 text-black border-none text-[8px] font-black h-4 py-0 px-2 rounded-full uppercase">Pro</Badge>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-white/10 uppercase tracking-[0.1em] backdrop-blur-sm" style={{ color: T.textSec }}>
                    {recentBookings && recentBookings > 0 ? `🔥 ${recentBookings} agendados hoje` : '⭐ Especialista'}
                  </span>
                </div>
              </div>
              <button 
                onClick={() => setStep('professional')}
                className="p-4 rounded-2xl bg-white/5 hover:bg-amber-500/20 transition-all border border-white/10 active:scale-90 shadow-lg group-hover:rotate-12"
                style={{ color: T.accent }}
              >
                <RotateCcw className="h-5 w-5" />
              </button>
            </div>
          </div>
        );
      })()}


      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Promotion Banner */}
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
              {isCashbackPromo ? (
                <div className="space-y-2">
                  <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#10b981' }}>
                    <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
                    Ganhe {promoData.discount_type === 'percentage' ? `${promoData.discount_value}%` : `R$ ${Number(promoData.discount_value || 0).toFixed(2)}`} de volta
                  </p>
                  <p className="text-xs opacity-70 leading-relaxed" style={{ color: T.textSec }}>
                    O valor será creditado em sua conta MeAgendae após a conclusão do serviço para usar quando quiser.
                  </p>
                </div>
              ) : (
                promoData.service_name && (
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold opacity-60">De</span>
                      <span className="text-sm line-through opacity-50">R$ {Number(promoData.original_price).toFixed(2)}</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[10px] uppercase font-bold" style={{ color: T.accent }}>Por</span>
                      <span className="text-xl font-black" style={{ color: T.accent }}>R$ {Number(promoData.promotion_price).toFixed(2)}</span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        {/* ═══ IDENTIFYING / GATE ═══ */}
        {step === 'identifying' && (
          <div className="flex flex-col items-center justify-center py-20 animate-pulse">
            <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin mb-4" />
            <p className="text-sm font-black uppercase tracking-widest opacity-60">Identificando seu acesso...</p>
          </div>
        )}

        {/* ═══ SERVICES ═══ */}
        {step === 'services' && (
          <div className="space-y-5 animate-fade-in">

            <button 
              onClick={() => setStep("professional")} 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity mb-4" 
              style={{ color: T.textSec }}
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: T.text }}>
                {clientForm.full_name ? `${clientForm.full_name.split(' ')[0]}, o que faremos hoje?` : (isPromoMode ? 'Sua Oferta Premium' : 'Escolha seus Serviços')}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]" style={{ color: T.textSec }}>
                  {isCashbackPromo ? 'Ganhe cashback instantâneo' : 'Tratamentos exclusivos para você'}
                </p>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            </div>

            {/* Loyalty & Cashback Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {cashbackCredits.length > 0 && cashbackTotal > 0 && (
                <div className="rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-left duration-500" style={{ background: 'linear-gradient(135deg, #10b98110, #10b98120)', border: '1px solid #10b98130' }}>
                  <div className="w-10 h-10 rounded-full bg-[#10b98120] flex items-center justify-center shrink-0">
                    <span className="text-lg">💰</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-60" style={{ color: '#10b981' }}>Saldo disponível</p>
                    <p className="font-black text-lg" style={{ color: '#10b981' }}>R$ {cashbackTotal.toFixed(2)}</p>
                  </div>
                </div>
              )}
              {loyaltyPoints > 0 && (
                <div className="rounded-2xl p-4 flex items-center gap-3 animate-in slide-in-from-right duration-500" style={{ background: `linear-gradient(135deg, ${T.accent}10, ${T.accent}20)`, border: `1px solid ${T.accent}30` }}>
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                    <span className="text-lg">⭐</span>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold opacity-60" style={{ color: T.accent }}>Pontos Fidelidade</p>
                    <p className="font-black text-lg" style={{ color: T.accent }}>{loyaltyPoints} pts</p>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4">
              {(() => {
                const promoServiceIds = promoData?.service_ids || (promoData?.service_id ? [promoData.service_id] : []);
                const filteredSvcs = isPromoMode && promoServiceIds.length > 0
                  ? services.filter(s => promoServiceIds.includes(s.id))
                  : services;
                return filteredSvcs;
              })().map((svc, idx) => {
                const sel = selectedServices.includes(svc.id);
                const promoServiceIds = promoData?.service_ids || (promoData?.service_id ? [promoData.service_id] : []);
                const isPromoService = isPromoMode && promoServiceIds.includes(svc.id);
                return (
                  <div
                    key={svc.id}
                    onClick={() => {
                      if (isPromoMode && isPromoService) {
                        setSelectedServices(sel ? [] : [svc.id]);
                      } else {
                        toggleService(svc.id);
                      }
                    }}
                    className="p-5 rounded-[2.5rem] transition-all duration-300 cursor-pointer relative overflow-hidden group hover:scale-[1.02] active:scale-[0.98]"
                    style={{
                      background: sel ? `linear-gradient(135deg, ${T.accent}20, ${T.card})` : T.card,
                      border: `2px solid ${sel ? T.accent : T.border}`,
                      boxShadow: sel ? `0 20px 40px -20px ${T.accent}40` : '0 4px 12px rgba(0,0,0,0.1)',
                      animationDelay: `${idx * 100}ms`
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
                          <span className="w-1 h-1 rounded-full bg-white/20" />
                          <span className="text-xs font-bold uppercase tracking-wider">Acabamento Premium</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
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
                            <div className="flex flex-col items-end">
                              <p className="text-xs line-through opacity-40 font-bold">R$ {orig.toFixed(2)}</p>
                              <p className="font-black text-xl" style={{ color: T.accent }}>R$ {promo.toFixed(2)}</p>
                            </div>
                          );
                        })() : isCashbackPromo && promoServiceIds.includes(svc.id) ? (
                          <div className="flex flex-col items-end">
                            <p className="font-black text-xl" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                            <Badge className="bg-green-500/20 text-green-500 border-none text-[8px] h-3 px-1 font-black">CASHBACK</Badge>
                          </div>
                        ) : (
                          <p className="font-black text-xl" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bottom Bar Otimizada Mobile */}
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
                      <span className="text-xs font-bold opacity-60">/ {totalDuration}m</span>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      if (!selectedProfessional && !skipProfessionalStep) {
                        setStep('professional');
                      } else {
                        setStep('datetime');
                      }
                    }}
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

        {/* ═══ PROFESSIONAL ═══ */}
        {step === 'professional' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button 
              onClick={() => setStep('services')} 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" 
              style={{ color: T.textSec }}
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none" style={{ color: T.text }}>
                {clientForm.full_name ? `${clientForm.full_name.split(' ')[0]}, qual seu Expert?` : 'Escolha seu Expert'}
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]" style={{ color: T.textSec }}>Especialistas prontos para te atender</p>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            </div>
            {/* Debug removido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {professionals.map((p, idx) => {
                const sel = selectedProfessional === p.id;
                const rating = professionalRatings[p.id];
                return (
                  <div
                    key={p.id}
                    onClick={() => { 
                      setSelectedProfessional(p.id); 
                      fetchProfessionalHours(p.id); 
                      fetchRecentBookings(p.id); 
                      setStep(selectedServices.length > 0 ? 'datetime' : 'services'); 
                    }}
                    className="p-6 rounded-[2.5rem] cursor-pointer transition-all duration-300 relative group overflow-hidden"
                    style={{
                      background: sel ? `linear-gradient(135deg, ${T.accent}20, ${T.card})` : T.card,
                      border: `2px solid ${sel ? T.accent : T.border}`,
                      boxShadow: sel ? `0 20px 40px -20px ${T.accent}40` : '0 4px 12px rgba(0,0,0,0.1)',
                      animationDelay: `${idx * 100}ms`
                    }}
                  >
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative">
                        {p.avatar_url ? (
                          <img src={p.avatar_url} alt={p.full_name} className="w-24 h-24 rounded-3xl object-cover transition-transform group-hover:scale-105" style={{ border: `3px solid ${sel ? T.accent : T.border}` }} />
                        ) : (
                          <div className="w-24 h-24 rounded-3xl flex items-center justify-center text-3xl font-black" style={{ background: `${T.accent}15`, color: T.accent, border: `3px solid ${sel ? T.accent : T.border}` }}>
                            {p.full_name?.charAt(0)?.toUpperCase()}
                          </div>
                        )}
                        {sel && (
                          <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-green-500 flex items-center justify-center shadow-lg border-4" style={{ borderColor: T.card }}>
                            <CheckCircle2 className="h-4 w-4 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="text-center">
                        <p className="font-black text-lg leading-tight group-hover:text-amber-500 transition-colors">{p.full_name}</p>
                        <div className="flex flex-col items-center gap-1 mt-2">
                          {rating ? (
                            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5">
                              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                              <span className="text-xs font-black">{rating.avg.toFixed(1)}</span>
                              <span className="text-[10px] font-bold opacity-40">({rating.count})</span>
                            </div>
                          ) : (
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Profissional Especialista</span>
                          )}
                          <Button 
                            className="mt-4 rounded-full px-6 py-2 h-auto text-[10px] font-black uppercase tracking-widest border-none transition-all group-hover:px-8"
                            style={{ background: sel ? T.accent : `${T.accent}15`, color: sel ? '#000' : T.accent }}
                          >
                            Selecionar
                          </Button>
                        </div>
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
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button 
              onClick={() => setStep('services')} 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" 
              style={{ color: T.textSec }}
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter flex items-center gap-3 leading-none">
                {clientForm.full_name ? `${clientForm.full_name.split(' ')[0]}, seu momento?` : 'Escolha seu Horário'}
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]" />
              </h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]" style={{ color: T.textSec }}>Selecione o melhor encaixe na agenda</p>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            </div>

            {/* Quick slot confirmation block */}
            {quickSlotSelected && selectedDate && selectedTime ? (
              <div className="space-y-4 animate-in zoom-in duration-300">
                <div 
                  className="rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden" 
                  style={{ background: `linear-gradient(135deg, ${T.card}, ${T.bg})`, border: `2px solid ${T.accent}`, boxShadow: `0 24px 48px -12px ${T.accent}30` }}
                >
                  <div className="absolute top-0 right-0 p-12 blur-3xl rounded-full -mr-10 -mt-10 opacity-20" style={{ background: T.accent }} />
                  <div className="relative z-10 flex flex-col items-center text-center space-y-4">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl" style={{ background: `linear-gradient(135deg, ${T.accent}, #F4C752)` }}>
                      <Clock className="h-8 w-8 text-black" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em]" style={{ color: T.accent }}>Horário Selecionado</p>
                      <p className="text-4xl font-black mt-2">{selectedTime}</p>
                      <p className="text-sm font-bold opacity-60 mt-1 capitalize">
                        {isTodayTz(selectedDate) ? 'Hoje' : isTomorrowTz(selectedDate) ? 'Amanhã' : format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setQuickSlotSelected(false);
                        setSelectedTime(null);
                        setSelectedDate(undefined);
                      }}
                      className="text-xs font-black uppercase tracking-widest py-2 px-4 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                      style={{ color: T.textSec }}
                    >
                      <RotateCcw className="h-3 w-3 inline mr-2" />
                      Alterar Horário
                    </button>
                  </div>
                </div>
                <Button
                  onClick={() => setStep('confirm')}
                  className="w-full rounded-full py-8 font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
                  style={{ background: `linear-gradient(135deg, ${T.accent}, #F4C752)`, color: '#000' }}
                >
                  Confirmar e Continuar
                  <ChevronRight className="h-6 w-6 ml-2 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Smart suggestion (best gap fit) */}
                {nextSlotsLoading ? (
                  <div className="space-y-4 rounded-[2rem] p-6" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: `${T.accent} transparent transparent transparent` }} />
                      <span className="text-xs font-black uppercase tracking-widest opacity-60">Buscando melhores encaixes...</span>
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.05)' }} />
                      ))}
                    </div>
                  </div>
                ) : smartSuggestion && (
                  <div
                    className="rounded-[2.5rem] p-6 space-y-4 animate-in zoom-in duration-500 relative overflow-hidden group cursor-pointer"
                    onClick={() => handleQuickSlot(smartSuggestion.date, smartSuggestion.slot)}
                    style={{
                      background: `linear-gradient(135deg, ${T.accent}25, ${T.card})`,
                      border: `2px solid ${T.accent}50`,
                      boxShadow: `0 20px 40px -20px ${T.accent}40`,
                    }}
                  >
                    <div className="absolute top-0 right-0 p-4">
                      <Badge className="bg-amber-500 text-black font-black text-[9px] tracking-tighter border-none">RECOMENDADO</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-110 transition-transform" style={{ background: `linear-gradient(135deg, ${T.accent}, #F4C752)` }}>
                        <Zap className="h-7 w-7 text-black" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Sugestão Ideal</p>
                        <p className="text-2xl font-black">{formatSlotTime(smartSuggestion.slot)}</p>
                        <p className="text-xs font-bold opacity-60 capitalize">
                          {isTodayTz(smartSuggestion.date) ? 'Hoje' : isTomorrowTz(smartSuggestion.date) ? 'Amanhã' : format(smartSuggestion.date, "EEEE, dd/MM", { locale: ptBR })}
                        </p>
                      </div>
                      <ChevronRight className="h-6 w-6 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                    </div>
                  </div>
                )}

                {/* Calendário Premium Horizontal */}
                <div className="space-y-4">
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" style={{ color: T.accent }} />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Escolha o dia</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            const today = startOfDay(new Date());
                            setSelectedDate(today);
                            setCurrentWeekStart(startOfWeek(today, { locale: ptBR }));
                          }}
                          className="h-8 px-3 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-white/5"
                          style={{ color: T.accent }}
                        >
                          Hoje
                        </Button>
                        <Select 
                          value={format(currentWeekStart, 'yyyy-MM')} 
                          onValueChange={(val) => {
                            const [year, month] = val.split('-').map(Number);
                            const newDate = setMonth(new Date(year, month - 1, 1), month - 1);
                            setCurrentWeekStart(startOfWeek(newDate, { locale: ptBR }));
                          }}
                        >
                          <SelectTrigger className="h-8 bg-transparent border-none text-[10px] font-black uppercase tracking-widest focus:ring-0 w-auto gap-1">
                            <SelectValue placeholder="Mês" />
                          </SelectTrigger>
                          <SelectContent className="bg-zinc-900 border-zinc-800">
                            {eachMonthOfInterval({
                              start: startOfMonth(new Date()),
                              end: endOfMonth(addDays(new Date(), 365))
                            }).map((month) => (
                              <SelectItem 
                                key={month.toISOString()} 
                                value={format(month, 'yyyy-MM')}
                                className="text-white focus:bg-white/10"
                              >
                                {format(month, 'MMMM yyyy', { locale: ptBR })}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex items-center justify-between bg-white/5 p-2 rounded-[2rem] border border-white/5">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const prev = subWeeks(currentWeekStart, 1);
                          if (prev >= startOfWeek(new Date(), { locale: ptBR })) {
                            setCurrentWeekStart(prev);
                          }
                        }}
                        disabled={subWeeks(currentWeekStart, 1) < startOfWeek(new Date(), { locale: ptBR })}
                        className="rounded-full hover:bg-white/5 disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-around">
                          {eachDayOfInterval({
                            start: currentWeekStart,
                            end: addDays(currentWeekStart, 6)
                          }).map((date) => {
                            const isPast = date < startOfDay(new Date());
                            const isSel = selectedDate && isSameDay(date, selectedDate);
                            const isTod = isToday(date);
                            const dayName = format(date, "EEE", { locale: ptBR });
                            const dayNum = format(date, "dd");
                            
                            return (
                              <button
                                key={date.toISOString()}
                                onClick={() => { 
                                  if (isPast) return;
                                  setSelectedDate(date); 
                                  setSelectedTime(null); 
                                }}
                                disabled={isPast}
                                className={cn(
                                  "flex flex-col items-center p-2 rounded-2xl min-w-[45px] transition-all relative group",
                                  isPast && "opacity-20 cursor-not-allowed"
                                )}
                                style={{
                                  background: isSel ? T.accent : 'transparent',
                                  color: isSel ? '#000' : (isTod ? T.accent : T.text),
                                }}
                              >
                                {isTod && !isSel && (
                                  <span className="absolute -top-1 text-[8px] font-black uppercase tracking-tighter" style={{ color: T.accent }}>Hoje</span>
                                )}
                                <span className={cn(
                                  "text-[9px] font-black uppercase opacity-60",
                                  isSel && "opacity-100"
                                )}>
                                  {dayName}
                                </span>
                                <span className="text-sm font-black mt-0.5">{dayNum}</span>
                                {isSel && (
                                  <div className="absolute -bottom-1 w-1 h-1 rounded-full bg-black" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}
                        className="rounded-full hover:bg-white/5"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Time Selection Grid */}
                {selectedDate && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" style={{ color: T.accent }} />
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">
                        Horários para {format(selectedDate, "dd/MM")}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {(nextSlots.find(d => isSameDay(d.date, selectedDate))?.slots || []).map((slot) => {
                        const isSel = selectedTime === slot;
                        return (
                          <button
                            key={slot}
                            onClick={() => { 
                              setSelectedTime(slot); 
                              setStep('confirm');
                            }}
                            className="py-5 rounded-3xl text-sm font-black transition-all duration-300 border-2"
                            style={{ 
                              background: isSel ? T.accent : T.card, 
                              borderColor: isSel ? T.accent : T.border,
                              color: isSel ? '#000' : T.text,
                              boxShadow: isSel ? `0 10px 20px -5px ${T.accent}40` : 'none'
                            }}
                          >
                            {formatSlotTime(slot)}
                          </button>
                        );
                      })}
                    </div>
                    
                    {allowCustomRequests && !isPromoMode && (
                      <button
                        onClick={() => setShowCustomRequestForm(true)}
                        className="w-full mt-6 py-5 rounded-[2rem] text-[10px] font-black uppercase tracking-widest transition-all hover:bg-white/5 border-2 group"
                        style={{ color: T.accent, border: `2px dashed ${T.accent}40` }}
                      >
                        <MessageCircle className="h-5 w-5 inline mr-2 group-hover:rotate-12 transition-transform" />
                        Solicitar horário personalizado
                      </button>
                    )}
                  </div>
                )}

                {/* Waitlist (if no slots for selected date) */}
                {selectedDate && !slotsLoading && !nextSlotsLoading && (nextSlots.find(d => isSameDay(d.date, selectedDate))?.slots?.length === 0) && (
                  <div className="p-8 rounded-[2.5rem] text-center space-y-4" style={{ background: `${T.accent}05`, border: `2px dashed ${T.accent}30` }}>
                    <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto">
                      <Bell className="h-8 w-8 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black tracking-tight">Sem horários disponíveis neste dia</h3>
                      <p className="text-sm opacity-60 mt-1">Gostaria de ser avisado caso surja uma vaga para este dia?</p>
                    </div>
                    <Button
                      onClick={() => setShowWaitlistForm(true)}
                      className="rounded-full px-8 py-6 font-black uppercase text-xs tracking-widest"
                      style={{ background: T.accent, color: '#000' }}
                    >
                      Entrar na Lista de Espera
                    </Button>
                  </div>
                )}

                {/* Custom Request Form Component */}
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
              </div>
            )}
          </div>
        )}

        {/* CLIENT INFO REMOVED - NOW USES IDENTITY MODAL */}


        {/* ═══ BENEFITS CHOICE ═══ */}
        {step === 'benefits' && (
          <div className="space-y-8 animate-in slide-in-from-right duration-500">
            <button onClick={() => setStep('datetime')} className="flex items-center gap-1 text-xs font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="text-center space-y-4">
              <div className="w-24 h-24 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto shadow-2xl shadow-amber-500/20">
                <Sparkles className="h-12 w-12 text-amber-500" />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black tracking-tight">Ganhe Recompensas!</h2>
                <p className="text-sm opacity-70 max-w-xs mx-auto" style={{ color: T.textSec }}>
                  Como cliente especial, você acumula benefícios reais a cada visita.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="p-6 rounded-[2rem] bg-white/5 border-2 border-dashed border-white/10 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xl">💰</span>
                </div>
                <div>
                  <p className="font-black text-base">Cashback Instantâneo</p>
                  <p className="text-xs opacity-60 mt-1">Receba parte do valor pago de volta para usar no seu próximo agendamento.</p>
                </div>
              </div>
              <div className="p-6 rounded-[2rem] bg-white/5 border-2 border-dashed border-white/10 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0">
                  <span className="text-xl">⭐</span>
                </div>
                <div>
                  <p className="font-black text-base">Clube de Fidelidade</p>
                  <p className="text-xs opacity-60 mt-1">Acumule pontos e troque por serviços gratuitos ou descontos exclusivos.</p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep('confirm')}
              className="w-full rounded-full py-8 font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
              style={{ background: `linear-gradient(135deg, ${T.accent}, #F4C752)`, color: '#000' }}
            >
              Quero meus benefícios
              <ChevronRight className="h-6 w-6 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        )}

        {/* ═══ CONFIRM ═══ */}
        {step === 'confirm' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-500">
            <button 
              onClick={() => setStep('datetime')} 
              className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity" 
              style={{ color: T.textSec }}
            >
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div className="space-y-2">
              <h2 className="text-4xl font-black tracking-tighter leading-none">{clientForm.full_name ? clientForm.full_name.split(' ')[0] : 'Cliente'}, revise seu Ticket Premium 👇</h2>
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.2em]" style={{ color: T.textSec }}>Confirme os detalhes da sua reserva</p>
                <div className="h-px flex-1 bg-white/5" />
              </div>
            </div>
            
            <div 
              className="rounded-[2.5rem] p-6 space-y-6 relative overflow-hidden" 
              style={{ background: T.card, border: `2px solid ${T.border}`, boxShadow: '0 20px 40px -20px rgba(0,0,0,0.4)' }}
            >
              <div className="absolute top-0 right-0 p-8 blur-3xl rounded-full -mr-10 -mt-10 opacity-10 pointer-events-none" style={{ background: T.accent }} />
              
              {/* Summary Header */}
              <div className="flex items-center gap-4">
                {selectedProfessional && professionals.find(p => p.id === selectedProfessional)?.avatar_url ? (
                  <img 
                    src={professionals.find(p => p.id === selectedProfessional)?.avatar_url} 
                    className="w-16 h-16 rounded-2xl object-cover" 
                    alt="Professional" 
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
                    <User className="h-8 w-8 opacity-20" />
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Profissional Especialista</p>
                  <p className="font-black text-lg">{professionals.find(p => p.id === selectedProfessional)?.full_name || 'Expert'}</p>
                </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Seus Dados (Sempre visível para fluxo direto) */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Seus Dados</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold opacity-40 ml-2">Nome Completo</Label>
                    <Input 
                      value={clientForm.full_name}
                      onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                      placeholder="Seu nome"
                      className="rounded-2xl h-12 bg-white/5 border-white/10 text-white font-bold"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold opacity-40 ml-2">WhatsApp</Label>
                    <Input 
                      value={clientForm.whatsapp}
                      onChange={(e) => setClientForm({ ...clientForm, whatsapp: displayWhatsApp(e.target.value) })}
                      placeholder="(00) 00000-0000"
                      className="rounded-2xl h-12 bg-white/5 border-white/10 text-white font-bold"
                    />
                  </div>
                </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Services List */}
              <div className="space-y-4">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Serviços Selecionados</p>
                <div className="space-y-3">
                  {services.filter((s) => selectedServices.includes(s.id)).map((s) => (
                    <div key={s.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-amber-500/10 transition-colors">
                          <Scissors className="h-4 w-4 opacity-40 group-hover:text-amber-500 group-hover:opacity-100 transition-all" />
                        </div>
                        <div>
                          <p className="text-sm font-black">{s.name}</p>
                          <p className="text-[10px] font-bold opacity-40 uppercase tracking-tighter">{s.duration_minutes} min • Tratamento VIP</p>
                        </div>
                      </div>
                      <p className="text-sm font-black" style={{ color: T.accent }}>R$ {Number(s.price).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px w-full bg-white/5" />

              {/* Appointment Details */}
              <div className="grid grid-cols-2 gap-6">
                <div className="p-4 rounded-3xl bg-white/5 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Data do Serviço</p>
                  <p className="font-black text-sm capitalize">{selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</p>
                </div>
                <div className="p-4 rounded-3xl bg-white/5 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Horário & Duração</p>
                  <p className="font-black text-sm">{selectedTime} <span className="opacity-40 font-bold ml-1">• {totalDuration}m</span></p>
                </div>
              </div>

              {/* Benefits Info */}
              {(cashbackEarnAmount > 0 || useCashback) && (
                <div className="space-y-3">
                  {cashbackEarnAmount > 0 && (
                    <div className="rounded-2xl p-4 flex items-center gap-3 animate-in zoom-in duration-500" style={{ background: 'linear-gradient(135deg, #10b98110, #10b98120)', border: '1px solid #10b98130' }}>
                      <div className="w-8 h-8 rounded-full bg-[#10b98120] flex items-center justify-center shrink-0">
                        <span className="text-sm">🎁</span>
                      </div>
                      <p className="text-xs font-bold" style={{ color: '#10b981' }}>
                        Você ganhará <span className="text-sm font-black">R$ {(Number(cashbackEarnAmount) || 0).toFixed(2)}</span> de cashback
                      </p>
                    </div>
                  )}
                  {cashbackCredits.length > 0 && (
                    <div 
                      className="rounded-2xl p-4 flex items-center justify-between gap-3 cursor-pointer select-none border-2 transition-all" 
                      onClick={() => setUseCashback(!useCashback)}
                      style={{ 
                        background: useCashback ? `${T.accent}15` : 'rgba(255,255,255,0.02)', 
                        borderColor: useCashback ? T.accent : 'transparent'
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center">
                          <span className="text-sm">💰</span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Usar Créditos</p>
                          <p className="text-sm font-black">Saldo: R$ {(Number(cashbackTotal) || 0).toFixed(2)}</p>
                        </div>
                      </div>
                      <Checkbox checked={useCashback} onCheckedChange={(v) => setUseCashback(v === true)} className="rounded-full w-6 h-6" />
                    </div>
                  )}
                </div>
              )}

              {/* Final Price */}
              <div className="pt-4 flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-60">Total a Pagar no Local</p>
                  {cashbackDiscount > 0 && (
                    <p className="text-xs line-through opacity-40 font-bold">R$ {(Number(totalPrice) || 0).toFixed(2)}</p>
                  )}
                </div>
                <p className="text-4xl font-black tracking-tighter" style={{ color: T.accent }}>R$ {(Number(finalPrice) || 0).toFixed(2)}</p>
              </div>
            </div>

            <Button
              onClick={() => handleBook()}
              className="w-full rounded-full py-8 font-black text-lg shadow-2xl transition-all hover:scale-[1.02] active:scale-[0.98] group"
              style={{ background: `linear-gradient(135deg, #10B981, #34D399)`, color: '#000' }}
              disabled={loading}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-4 rounded-full animate-spin" style={{ borderColor: '#000 transparent transparent transparent' }} />
                  Confirmando seu Horário...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-6 w-6" />
                  Finalizar Agendamento
                </div>
              )}
            </Button>
            
            <p className="text-[10px] text-center font-bold opacity-40 uppercase tracking-widest">Pague diretamente no estabelecimento</p>
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
            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${bookingResult.serviceNames.join(', ')} - ${bookingResult.companyName}`)}&dates=${fmt(st)}/${fmt(et)}&details=${encodeURIComponent(`Profissional: ${bookingResult.professionalName}\nValor: R$ ${(Number(bookingResult.totalPrice) || 0).toFixed(2)}`)}`;
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
              promoData.original_price != null ? `Preço normal: R$ ${(Number(promoData.original_price) || 0).toFixed(2)}` : '',
              promoData.promotion_price != null ? `Preço promocional: R$ ${(Number(promoData.promotion_price) || 0).toFixed(2)}` : '',
              savings > 0 ? `\n🔥 Você economizou R$ ${(Number(savings) || 0).toFixed(2)}` : '',
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
              ...(isPromoMode ? [] : [`💰 Valor: R$ ${(Number(bookingResult.totalPrice) || 0).toFixed(2)}`]),
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
            trackWhatsAppClick('booking-success');
            return buildWhatsAppUrl(phone.startsWith('55') ? phone : '55' + phone, msg);
          };

          const resetBooking = () => {
            setBookingResult(null); setStep('services'); setSelectedServices([]);
            setSelectedProfessional(null); setSelectedDate(undefined); setSelectedTime(null);
          };

          return (
            <div className="space-y-8 animate-in zoom-in-95 duration-700">
              <div className="flex flex-col items-center gap-6 pt-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-green-500 blur-2xl opacity-20 animate-pulse rounded-full" />
                  <div className="w-24 h-24 rounded-full flex items-center justify-center animate-bounce bg-green-500/10 border-4 border-green-500/20 relative z-10 shadow-2xl">
                    <CheckCircle2 className="h-12 w-12 text-green-500" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-5xl font-black tracking-tighter leading-none italic uppercase">Ticket Confirmado!</h2>
                  <p className="text-xl font-black tracking-tight mt-2" style={{ color: T.accent }}>{clientForm.full_name.split(' ')[0]}, seu momento está reservado. 🎉</p>
                  <div className="flex justify-center mt-2">
                    <p className="text-[10px] font-black opacity-60 uppercase tracking-[0.4em] border-y border-white/10 py-1" style={{ color: T.textSec }}>Acesse com exclusividade</p>
                  </div>
                </div>
              </div>

              <div 
                className="rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden text-left" 
                style={{ background: T.card, border: `2px solid ${T.border}`, boxShadow: '0 32px 64px -16px rgba(0,0,0,0.5)' }}
              >
                <div className="absolute top-0 right-0 p-12 blur-3xl rounded-full -mr-10 -mt-10 opacity-10 pointer-events-none" style={{ background: T.accent }} />
                
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center shrink-0">
                    <CalendarPlus className="h-8 w-8" style={{ color: T.accent }} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Data e Hora do Agendamento</p>
                    <p className="text-xl font-black capitalize">{format(bookingResult.date, "dd 'de' MMMM", { locale: ptBR })}</p>
                    <p className="text-2xl font-black" style={{ color: T.accent }}>às {bookingResult.time}</p>
                  </div>
                </div>

                <div className="h-px w-full bg-white/5" />

                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <User className="h-5 w-5 opacity-40" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Profissional Responsável</p>
                      <p className="font-black text-base">{bookingResult.professionalName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center">
                      <Scissors className="h-5 w-5 opacity-40" />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bookingResult.serviceNames.map((name) => (
                        <span key={name} className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/5" style={{ color: T.accent }}>{name}</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Button
                  onClick={() => window.open(calUrl(), '_blank')}
                  className="rounded-full py-8 font-black uppercase text-xs tracking-widest bg-white/5 hover:bg-white/10 transition-all border-none"
                  style={{ color: T.text }}
                >
                  <Calendar className="h-5 w-5 mr-3 opacity-60" />
                  Salvar no Google Agenda
                </Button>
                <Button
                  onClick={() => window.open(waUrl(), '_blank')}
                  className="rounded-full py-8 font-black uppercase text-xs tracking-widest bg-green-500/10 hover:bg-green-500/20 transition-all border-none"
                  style={{ color: '#10B981' }}
                >
                  <MessageCircle className="h-5 w-5 mr-3" />
                  Enviar no WhatsApp
                </Button>
              </div>

              <div className="pt-6 flex flex-col items-center gap-4">
                <button 
                  onClick={resetBooking}
                  className="text-xs font-black uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                >
                  Fazer novo agendamento
                </button>
                <div className="h-px w-12 bg-white/10" />
                <a 
                  href="/minha-conta" 
                  className="text-sm font-black"
                  style={{ color: T.accent }}
                >
                  Acompanhar meus horários
                </a>
              </div>
            </div>
          );
        })()}
      </div>
      <div className="text-center py-4">
        <PlatformBranding isDark={isDark} hide={isWhitelabel} />
      </div>

      {/* Floating Meus Agendamentos Button */}
      {step !== 'success' && isAuthenticated && hasValidClient && (
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

      {/* Complete signup modal */}
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

      {/* Centralized booking error dialog */}
      <BookingErrorDialog
        open={!!bookingError}
        onOpenChange={(o) => { if (!o) setBookingError(null); }}
        error={bookingError}
        suggestions={bookingError?.suggestions ?? availableSlots}
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
          onClick={() => trackWhatsAppClick('public-booking')}
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
              <p className="text-sm" style={{ color: T.textSec }}>Como foi sua experiênca?</p>
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

      {company?.id && (
        <IdentityModal
          isOpen={showIdentityModal}
          onClose={() => setShowIdentityModal(false)}
          companyId={company.id}
          onLoginSuccess={async (clientData) => {
            console.log('[LOGIN_SUCCESS] IdentityModal success callback triggered', clientData);

            setHasValidClient(true);
            setClientDataWasAutoFilled(true);
            setShowIdentityModal(false);
            setShowOneClickCard(true);
            setIsChangingData(false);

            const incomingName = clientData?.fullName || clientData?.full_name || '';
            const incomingWhatsapp = clientData?.whatsapp || '';
            const incomingEmail = clientData?.email || '';

            if (clientData) {
              setClientForm({
                full_name: incomingName,
                whatsapp: displayWhatsApp(incomingWhatsapp),
                email: incomingEmail,
                birth_date: clientData.birth_date || '',
              });
            }

            const { data: { user } } = await supabase.auth.getUser();
            const userRole = profile?.role || 'client';
            const isAdmin = ['admin', 'professional', 'company', 'super_admin'].includes(userRole);

            if (user || incomingWhatsapp) {
              const targetPhone = normalizePhone(incomingWhatsapp || user?.user_metadata?.whatsapp || user?.phone || '');
              const targetName = incomingName || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Cliente';
              const targetEmail = incomingEmail || user?.email || null;

              let query = supabase
                .from('clients')
                .select('*')
                .eq('company_id', company.id);

              if (!isAdmin && user) {
                query = query.eq('user_id', user.id);
              } else if (targetPhone) {
                query = query.eq('whatsapp', targetPhone);
              }

              let { data: client } = await query.maybeSingle();

              if (!client && targetPhone) {
                const globalClientPayload: any = {
                  whatsapp: targetPhone,
                  name: targetName,
                  email: targetEmail,
                };
                if (!isAdmin && user) globalClientPayload.user_id = user.id;

                const { data: globalClient } = await (supabase
                  .from('clients_global' as any)
                  .upsert(globalClientPayload, { onConflict: 'whatsapp' })
                  .select()
                  .single() as any);

                const localClientPayload: any = {
                  company_id: company.id,
                  global_client_id: globalClient?.id,
                  name: targetName,
                  whatsapp: targetPhone,
                  email: targetEmail,
                };
                if (!isAdmin && user) localClientPayload.user_id = user.id;

                const { data: newClient } = await (supabase
                  .from('clients' as any)
                  .upsert(localClientPayload, {
                    onConflict: !isAdmin && user ? 'company_id, user_id' : 'company_id, whatsapp',
                  })
                  .select()
                  .single() as any);

                client = newClient;
              }

              if (client) {
                setSavedClientId(client.id);
                setClientForm({
                  full_name: client.name || targetName,
                  whatsapp: displayWhatsApp(client.whatsapp || targetPhone),
                  email: client.email || targetEmail || '',
                  birth_date: client.birth_date || '',
                });
                setHasValidClient(true);
                setClientDataWasAutoFilled(true);
                console.log('[BOOKING_UNLOCKED] Client record ready');
              }
            }

            setStep(professionalSlug ? 'services' : 'professional');
          }}
        />
      )}

    </div>
  );
};

export default BookingPage;
