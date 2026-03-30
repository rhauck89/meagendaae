import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Scissors, Sparkles, Clock, DollarSign, ChevronRight, ChevronLeft, CheckCircle2, Bell, Zap, CalendarPlus, MessageCircle, RotateCcw, Home, User, Phone, Mail, CreditCard, Cake, MapPin, Star } from 'lucide-react';
import { format, addMinutes, addDays, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp, displayWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type ExistingAppointment, type BlockedTime } from '@/lib/availability-engine';

type Step = 'services' | 'professional' | 'datetime' | 'client' | 'confirm' | 'success';
type BusinessType = 'barbershop' | 'esthetic';

interface BookingPageProps {
  routeBusinessType?: BusinessType;
}

const DEFAULT_BOOKING_TIMEZONE = 'America/Sao_Paulo';

const timeStringToMinutes = (value: string) => {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
};

const getAppointmentMinutesInTimezone = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(value));

  const hours = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
  const minutes = Number(parts.find((part) => part.type === 'minute')?.value ?? '0');
  return hours * 60 + minutes;
};

const filterOverlappingSlots = (
  slots: string[],
  appointments: ExistingAppointment[],
  serviceDuration: number,
  bufferMinutes: number,
  timezone: string,
) => {
  return slots.filter((slot) => {
    const slotStart = timeStringToMinutes(slot);
    const slotEnd = slotStart + serviceDuration;

    return !appointments.some((appointment) => {
      const appointmentStart = getAppointmentMinutesInTimezone(appointment.start_time, timezone);
      const appointmentEndWithBuffer = getAppointmentMinutesInTimezone(appointment.end_time, timezone) + bufferMinutes;

      return appointmentStart < slotEnd && appointmentEndWithBuffer > slotStart;
    });
  });
};

// ─── Premium Theme Tokens ───
const T = {
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

const BookingPage = ({ routeBusinessType }: BookingPageProps) => {
  const { slug, professionalSlug } = useParams<{ slug: string; professionalSlug?: string }>();
  const [company, setCompany] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [exceptions, setExceptions] = useState<BusinessException[]>([]);
  const [businessType, setBusinessType] = useState<BusinessType>('barbershop');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [professionalHours, setProfessionalHours] = useState<BusinessHours[]>([]);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [professionalRatings, setProfessionalRatings] = useState<Record<string, { avg: number; count: number }>>({});

  const [step, setStep] = useState<Step>('services');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
  const [clientForm, setClientForm] = useState({ full_name: '', email: '', whatsapp: '', cpf: '', birth_date: '' });
  const [optInWhatsapp, setOptInWhatsapp] = useState(false);
  const [savedClientId, setSavedClientId] = useState<string | null>(null);
  const [clientLoaded, setClientLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [appointmentsLoaded, setAppointmentsLoaded] = useState(false);
  const [appointmentsForSelectedDate, setAppointmentsForSelectedDate] = useState<ExistingAppointment[]>([]);
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [showWaitlistForm, setShowWaitlistForm] = useState(false);
  const [waitlistForm, setWaitlistForm] = useState({ name: '', whatsapp: '', email: '' });
  const [nextSlots, setNextSlots] = useState<{ date: Date; slots: string[] }[]>([]);
  const [nextSlotsLoading, setNextSlotsLoading] = useState(false);
  const slotRequestRef = useRef(0);
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
  } | null>(null);

  const isDark = businessType === 'barbershop';
  const bookingTimezone = companySettings?.timezone || DEFAULT_BOOKING_TIMEZONE;

  // Load saved client from localStorage
  useEffect(() => {
    const loadSavedClient = () => {
      if (!company) return;
      const storedClientId = localStorage.getItem(`client_id_${company.id}`);
      const storedClientData = localStorage.getItem(`client_data_${company.id}`);
      if (storedClientId) {
        setSavedClientId(storedClientId);
        if (storedClientData) {
          try {
            const c = JSON.parse(storedClientData);
            setClientForm({
              full_name: c.full_name || '',
              email: c.email || '',
              whatsapp: c.whatsapp || '',
              cpf: c.cpf || '',
              birth_date: '',
            });
            setOptInWhatsapp(c.opt_in_whatsapp || false);
          } catch (e) {
            console.warn('[Booking] Failed to parse stored client data');
          }
        }
      }
      setClientLoaded(true);
    };
    loadSavedClient();
  }, [company]);

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

    const [servicesRes, hoursRes, exceptionsRes, companyRes, settingsRes] = await Promise.all([
      supabase.from('public_services' as any).select('*').eq('company_id', comp.id).order('name'),
      supabase.from('business_hours').select('*').eq('company_id', comp.id),
      supabase.from('business_exceptions').select('*').eq('company_id', comp.id),
      supabase.from('companies').select('buffer_minutes').eq('id', comp.id).single(),
      supabase.from('company_settings' as any).select('*').eq('company_id', comp.id).single(),
    ]);

    if (servicesRes.data) setServices(servicesRes.data);
    if (hoursRes.data) setBusinessHours(hoursRes.data as BusinessHours[]);
    if (exceptionsRes.data) setExceptions(exceptionsRes.data as BusinessException[]);
    if (companyRes.data) setBufferMinutes((companyRes.data as any).buffer_minutes || 0);
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

    if (professionalSlug) {
      console.log('[Booking] Resolving professional by slug', { companyId: comp.id, professionalSlug });
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
      }
    }
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
    const { data } = await supabase
      .from('professional_working_hours' as any)
      .select('*')
      .eq('professional_id', profileId);
    if (data && (data as any[]).length > 0) {
      setProfessionalHours(data as unknown as BusinessHours[]);
    } else {
      setProfessionalHours([]);
    }
  };

  const totalDuration = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + (Number(s.duration_minutes) || 0), 0);

  const totalPrice = services
    .filter((s) => selectedServices.includes(s.id))
    .reduce((sum, s) => sum + Number(s.price), 0);

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
      const existingAppointments = await fetchBookingAppointments(date, selectedProfessional);
      const { data: blockedTimesData } = await supabase
        .from('blocked_times' as any)
        .select('block_date, start_time, end_time')
        .eq('company_id', company.id)
        .eq('professional_id', selectedProfessional)
        .eq('block_date', dateStr);

      if (requestId !== slotRequestRef.current) return;

      setAppointmentsForSelectedDate(existingAppointments);
      setAppointmentsLoaded(true);

      const engineSlots = calculateAvailableSlots({
        date,
        totalDuration,
        businessHours,
        exceptions,
        existingAppointments,
        slotInterval: 15,
        bufferMinutes,
        professionalHours: professionalHours.length > 0 ? professionalHours : undefined,
        blockedTimes: ((blockedTimesData || []) as unknown as BlockedTime[]),
        professionalId: selectedProfessional,
      });

      if (requestId !== slotRequestRef.current) return;
      setGeneratedSlots(engineSlots);

      let filteredSlots = filterOverlappingSlots(engineSlots, existingAppointments, totalDuration, bufferMinutes, bookingTimezone);

      if (isToday(date)) {
        const currentTime = format(new Date(), 'HH:mm');
        filteredSlots = filteredSlots.filter(s => s > currentTime);
      }

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
    setSelectedTime(null);
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
      if (step === 'professional') setStep('datetime');
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
      const dateStr = format(day, 'yyyy-MM-dd');
      const existingAppointments = await fetchBookingAppointments(day, selectedProfessional);
      const { data: blockedData } = await supabase
        .from('blocked_times' as any)
        .select('block_date, start_time, end_time')
        .eq('company_id', company.id)
        .eq('professional_id', selectedProfessional)
        .eq('block_date', dateStr);
      let slots = calculateAvailableSlots({
        date: day, totalDuration, businessHours, exceptions, existingAppointments,
        slotInterval: 15, bufferMinutes,
        professionalHours: professionalHours.length > 0 ? professionalHours : undefined,
        blockedTimes: ((blockedData || []) as unknown as BlockedTime[]),
        professionalId: selectedProfessional,
      });
      slots = filterOverlappingSlots(slots, existingAppointments, totalDuration, bufferMinutes, bookingTimezone);
      if (isToday(day)) {
        const currentTime = format(now, 'HH:mm');
        slots = slots.filter(s => s > currentTime);
      }
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
    setSelectedDate(date);
    setSelectedTime(time);
    setStep('client');
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
      toast.success('Você foi adicionado à lista de espera!');
      setShowWaitlistForm(false);
      setWaitlistForm({ name: '', whatsapp: '', email: '' });
      setStep('services');
      setSelectedServices([]);
      setSelectedProfessional(null);
      setSelectedDate(undefined);
      setSelectedTime(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na lista de espera');
    } finally {
      setWaitlistLoading(false);
    }
  };

  const handleBook = async () => {
    if (!company || !selectedDate || !selectedTime || !selectedProfessional) return;
    setLoading(true);
    try {
      const formattedWhatsapp = clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : null;
      const { data: clientIdFromRpc, error: clientError } = await supabase.rpc('create_client', {
        p_name: clientForm.full_name, p_cpf: clientForm.cpf || '', p_whatsapp: formattedWhatsapp || '',
        p_email: clientForm.email || '', p_company_id: company.id,
      });
      if (clientError) throw clientError;
      const clientId = clientIdFromRpc;
      if (clientId) {
        localStorage.setItem(`client_id_${company.id}`, clientId);
        localStorage.setItem(`client_data_${company.id}`, JSON.stringify({
          full_name: clientForm.full_name, email: clientForm.email || '', whatsapp: clientForm.whatsapp || '',
          cpf: clientForm.cpf || '', opt_in_whatsapp: optInWhatsapp,
        }));
        setSavedClientId(clientId);
      }

      const [h, m] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(h, m, 0, 0);
      const endTime = addMinutes(startTime, totalDuration);
      if (!clientId) throw new Error('Cadastro do cliente falhou. Tente novamente.');

      const appointmentPayload = {
        p_professional_id: selectedProfessional, p_client_id: clientId,
        p_start_time: startTime, p_end_time: endTime, p_total_price: totalPrice,
        p_client_name: clientForm.full_name ?? null,
        p_client_whatsapp: formattedWhatsapp ?? null,
        p_notes: null as string | null,
      };

      const { data: appointmentId, error: aptError } = await supabase
        .rpc('create_appointment' as any, appointmentPayload as any);
      if (aptError) throw aptError;
      if (!appointmentId) throw new Error('Falha ao criar agendamento');

      const aptServicesPayload = selectedServices.map((sid) => {
        const svc = services.find((s) => s.id === sid)!;
        return { service_id: sid, price: Number(svc.price), duration_minutes: svc.duration_minutes };
      });
      await supabase.rpc('create_appointment_services', { p_appointment_id: appointmentId, p_services: aptServicesPayload });

      // Fire webhooks
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

      const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
      const bookedServiceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean) as string[];
      setBookingResult({
        appointmentId: appointmentId as string,
        professionalName: professionalProfile?.full_name || 'Profissional',
        professionalAvatar: professionalProfile?.avatar_url || null,
        serviceNames: bookedServiceNames, date: selectedDate, time: selectedTime,
        totalPrice, totalDuration, companyName: company.name,
        companyPhone: company.phone || companySettings?.whatsapp_number || null,
        companyAddress: (company as any).address || null,
      });
      setStep('success');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar');
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

  // ─── Render ───
  return (
    <div className="min-h-screen" style={{ background: T.bg, color: T.text }}>
      {/* Header */}
      <header style={{ background: T.card, borderBottom: `1px solid ${T.border}` }}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {displayLogoUrl ? (
            <img src={displayLogoUrl} alt={company.name} className="w-11 h-11 rounded-2xl object-cover shadow-lg" />
          ) : (
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center shadow-lg" style={{ background: T.accent }}>
              <Icon className="h-5 w-5 text-black" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg tracking-tight">{company.name}</h1>
            <p className="text-xs" style={{ color: T.textSec }}>
              {businessType === 'barbershop' ? 'Barbearia' : 'Estética'} • Agendamento online
            </p>
          </div>
        </div>
      </header>

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

        {/* ═══ SERVICES ═══ */}
        {step === 'services' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Escolha os serviços</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Selecione um ou mais serviços desejados</p>
            </div>
            <div className="space-y-3">
              {services.map((svc) => {
                const sel = selectedServices.includes(svc.id);
                return (
                  <div
                    key={svc.id}
                    onClick={() => toggleService(svc.id)}
                    className="p-4 rounded-2xl cursor-pointer transition-all duration-200 hover:scale-[1.01]"
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
                      <p className="font-bold text-lg shrink-0" style={{ color: T.accent }}>R$ {Number(svc.price).toFixed(2)}</p>
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
                    if (skipProfessionalStep) { setStep('datetime'); }
                    else { const profs = await fetchProfessionals(); setStep(profs.length === 1 ? 'datetime' : 'professional'); }
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
                    onClick={() => { setSelectedProfessional(p.id); fetchProfessionalHours(p.id); setStep('datetime'); }}
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
                            {slot}
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
              <Calendar
                mode="single" selected={selectedDate}
                onSelect={(date) => { setSelectedDate(date); setSelectedTime(null); }}
                locale={ptBR}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
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

                    {showWaitlistForm && (
                      <div className="mt-4 p-4 rounded-2xl border space-y-3" style={{ borderColor: `${T.accent}40`, background: `${T.accent}05` }}>
                        <p className="font-semibold text-sm">Dados para lista de espera</p>
                        <div className="space-y-2">
                          <div>
                            <label className="text-xs font-medium block mb-1">Nome *</label>
                            <input
                              className="w-full px-3 py-2 rounded-lg border text-sm"
                              placeholder="Seu nome"
                              value={waitlistForm.name}
                              onChange={(e) => setWaitlistForm(f => ({ ...f, name: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">WhatsApp *</label>
                            <input
                              className="w-full px-3 py-2 rounded-lg border text-sm"
                              placeholder="(31) 99999-9999"
                              value={waitlistForm.whatsapp}
                              onChange={(e) => setWaitlistForm(f => ({ ...f, whatsapp: e.target.value }))}
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium block mb-1">Email (opcional)</label>
                            <input
                              type="email"
                              className="w-full px-3 py-2 rounded-lg border text-sm"
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
                    )
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
                          {slot}
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
          </div>
        )}

        {/* ═══ CLIENT INFO ═══ */}
        {step === 'client' && (
          <div className="space-y-5 animate-fade-in">
            <button onClick={() => setStep('datetime')} className="flex items-center gap-1 text-sm font-medium hover:opacity-80" style={{ color: T.textSec }}>
              <ChevronLeft className="h-4 w-4" /> Voltar
            </button>
            <div>
              <h2 className="text-2xl font-bold tracking-tight">{savedClientId ? 'Confirme seus dados' : 'Seus dados'}</h2>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>
                {savedClientId ? 'Dados carregados automaticamente' : 'Preencha para finalizar o agendamento'}
              </p>
            </div>
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
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><CreditCard className="h-3.5 w-3.5" /> CPF</Label>
                <Input
                  value={clientForm.cpf}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let masked = digits;
                    if (digits.length > 9) masked = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6,9)}-${digits.slice(9)}`;
                    else if (digits.length > 6) masked = `${digits.slice(0,3)}.${digits.slice(3,6)}.${digits.slice(6)}`;
                    else if (digits.length > 3) masked = `${digits.slice(0,3)}.${digits.slice(3)}`;
                    setClientForm({ ...clientForm, cpf: masked });
                  }}
                  placeholder="000.000.000-00" maxLength={14}
                  className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium flex items-center gap-1.5" style={{ color: T.textSec }}><Mail className="h-3.5 w-3.5" /> Email (opcional)</Label>
                <Input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="seuemail@exemplo.com" className="rounded-xl h-12 text-base" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }} />
              </div>
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
            <Button
              onClick={() => setStep('confirm')}
              className="w-full rounded-xl py-6 font-semibold text-base shadow-lg transition-all hover:scale-[1.01]"
              style={{ background: T.accent, color: '#000' }}
              disabled={!clientForm.full_name || !clientForm.whatsapp || !isValidWhatsApp(clientForm.whatsapp)}
            >
              Revisar Agendamento <ChevronRight className="h-4 w-4 ml-1" />
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
              {/* Professional */}
              {(() => {
                const prof = professionals.find((p) => p.id === selectedProfessional);
                return (
                  <div className="flex items-center gap-4">
                    {prof?.avatar_url ? (
                      <img src={prof.avatar_url} alt={prof.full_name} className="w-14 h-14 rounded-full object-cover" style={{ border: `3px solid ${T.accent}` }} />
                    ) : (
                      <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold" style={{ background: `${T.accent}20`, color: T.accent }}>
                        {prof?.full_name?.charAt(0)?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-xs" style={{ color: T.textSec }}>Profissional</p>
                      <p className="font-semibold text-base">{prof?.full_name}</p>
                    </div>
                  </div>
                );
              })()}
              <div style={{ borderTop: `1px solid ${T.border}` }} />
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
                      <span className="text-sm font-semibold" style={{ color: T.accent }}>R$ {Number(s.price).toFixed(2)}</span>
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
              {/* Total */}
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total</span>
                <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {totalPrice.toFixed(2)}</span>
              </div>
            </div>
            <Button
              onClick={handleBook}
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

          const calUrl = () => {
            const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
            return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(`${bookingResult.serviceNames.join(', ')} - ${bookingResult.companyName}`)}&dates=${fmt(st)}/${fmt(et)}&details=${encodeURIComponent(`Profissional: ${bookingResult.professionalName}\nValor: R$ ${bookingResult.totalPrice.toFixed(2)}`)}`;
          };

          const waUrl = () => {
            const phone = bookingResult.companyPhone?.replace(/\D/g, '') || '';
            const baseUrl = window.location.origin;
            const msg = `Olá! 👋\n\nConfirmando meu agendamento na ${bookingResult.companyName}:\n\n📅 Data: ${format(bookingResult.date, "dd/MM/yyyy")}\n⏰ Horário: ${bookingResult.time}\n✂️ Serviço: ${bookingResult.serviceNames.join(', ')}\n💈 Profissional: ${bookingResult.professionalName}\n💰 Valor: R$ ${bookingResult.totalPrice.toFixed(2)}\n\n📋 Gerenciar agendamento:\n🔄 Reagendar: ${baseUrl}/reschedule/${bookingResult.appointmentId}\n❌ Cancelar: ${baseUrl}/cancel/${bookingResult.appointmentId}\n\nObrigado!`;
            return `https://wa.me/${phone.startsWith('55') ? phone : '55' + phone}?text=${encodeURIComponent(msg)}`;
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs mb-1" style={{ color: T.textSec }}>📅 Data</p>
                    <p className="font-semibold text-sm">{format(bookingResult.date, "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-xs mb-1" style={{ color: T.textSec }}>🕐 Horário</p>
                    <p className="font-semibold text-sm">{bookingResult.time} - {format(et, 'HH:mm')}</p>
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
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold">Total</span>
                  <span className="text-2xl font-bold" style={{ color: T.accent }}>R$ {bookingResult.totalPrice.toFixed(2)}</span>
                </div>
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

              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => window.location.href = `/reschedule/${bookingResult.appointmentId}`} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: T.card, border: `1px solid ${T.border}`, color: T.text }}>
                  🔄 Reagendar
                </button>
                <button onClick={() => window.location.href = `/cancel/${bookingResult.appointmentId}`} className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105" style={{ background: T.card, border: `1px solid ${T.border}`, color: '#F87171' }}>
                  ❌ Cancelar
                </button>
              </div>

              {/* ── Rating info ── */}
              <div className="rounded-2xl p-4 text-center" style={{ background: T.card, border: `1px solid ${T.border}` }}>
                <p className="text-sm" style={{ color: T.textSec }}>
                  Após seu atendimento, você receberá um link para avaliar sua experiência ⭐
                </p>
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
    </div>
  );
};

export default BookingPage;
