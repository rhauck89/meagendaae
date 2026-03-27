import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from '@/components/ui/calendar';
import { Scissors, Sparkles, Clock, DollarSign, ChevronRight, ChevronLeft, CheckCircle2, Bell, Zap } from 'lucide-react';
import { format, addMinutes, addDays, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp, displayWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type ExistingAppointment, type BlockedTime } from '@/lib/availability-engine';

type Step = 'services' | 'professional' | 'datetime' | 'client' | 'confirm';
type BusinessType = 'barbershop' | 'esthetic';

interface BookingPageProps {
  routeBusinessType?: BusinessType;
}

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
  const [waitlistLoading, setWaitlistLoading] = useState(false);
  const [nextSlots, setNextSlots] = useState<{ date: Date; slots: string[] }[]>([]);
  const [nextSlotsLoading, setNextSlotsLoading] = useState(false);

  const isDark = businessType === 'barbershop';

  // Load saved client from localStorage
  useEffect(() => {
    const loadSavedClient = async () => {
      if (!company) return;
      const storedClientId = localStorage.getItem(`client_id_${company.id}`);
      if (storedClientId) {
        const { data: client } = await supabase
          .from('clients' as any)
          .select('*')
          .eq('id', storedClientId)
          .single();
        if (client) {
          const c = client as any;
          setSavedClientId(c.id);
          setClientForm({
            full_name: c.name || '',
            email: c.email || '',
            whatsapp: c.whatsapp ? displayWhatsApp(c.whatsapp) : '',
            cpf: c.cpf || '',
            birth_date: '',
          });
          setOptInWhatsapp(c.opt_in_whatsapp || false);
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
      // Use settings buffer if available
      if ((settingsRes.data as any).booking_buffer_minutes > 0) {
        setBufferMinutes((settingsRes.data as any).booking_buffer_minutes);
      }
    }

    // If professional slug provided, auto-select professional
    if (professionalSlug) {
      console.log('[Booking] Resolving professional by slug', { companyId: comp.id, professionalSlug });

      // Use public_professionals view (no PII exposed)
      const { data: pubProfs, error: collabErr } = await supabase
        .from('public_professionals' as any)
        .select('*')
        .eq('company_id', comp.id)
        .eq('slug', professionalSlug);

      console.log('[Booking] Professional slug resolution', {
        slug: professionalSlug,
        found: pubProfs?.length ?? 0,
        error: collabErr?.message,
        results: pubProfs?.map((p: any) => ({ id: p.id, slug: p.slug, name: p.name })),
      });

      if (pubProfs && (pubProfs as any[]).length > 0) {
        const prof = (pubProfs as any[])[0];
        const profileId = prof.id as string;
        setSelectedProfessional(profileId);

        // Fetch professional-specific services
        const { data: profServices } = await supabase
          .from('service_professionals')
          .select('service_id, price_override')
          .eq('professional_id', profileId);

        console.log('[Booking] Professional services', {
          professional: prof.name,
          servicesLinked: profServices?.length ?? 0,
          serviceIds: profServices?.map((ps: any) => ps.service_id),
        });

        if (profServices && profServices.length > 0) {
          const profServiceIds = profServices.map((ps: any) => ps.service_id);
          const filteredServices = (servicesRes.data || []).filter((s: any) => profServiceIds.includes(s.id));
          const withOverrides = filteredServices.map((s: any) => {
            const override = profServices.find((ps: any) => ps.service_id === s.id);
            return override?.price_override != null ? { ...s, price: override.price_override } : s;
          });
          setServices(withOverrides);
        }
        // If no service_professionals links, keep all company services (already set above)

        // Fetch professional hours
        const { data: profHours } = await supabase
          .from('professional_working_hours' as any)
          .select('*')
          .eq('professional_id', profileId);
        if (profHours && (profHours as any[]).length > 0) {
          setProfessionalHours(profHours as unknown as BusinessHours[]);
        }

        setProfessionals([{ id: prof.id, full_name: prof.name, avatar_url: prof.avatar_url }]);
      } else {
        console.warn('[Booking] Professional slug not found, showing all professionals');
      }
    }
  };

  const fetchProfessionals = async () => {
    if (!company) return;
    console.log('[Booking] fetchProfessionals called', { company_id: company.id, selectedServices });

    // Use public_professionals view (no PII exposed)
    const { data: pubProfs, error: collabError } = await supabase
      .from('public_professionals' as any)
      .select('*')
      .eq('company_id', company.id)
      .eq('active', true);

    const collabs = pubProfs as any[] | null;

    console.log('[Booking] public_professionals query result', {
      found: collabs?.length ?? 0,
      error: collabError?.message,
      professionals: collabs?.map((p: any) => ({
        id: p.id,
        slug: p.slug,
        name: p.name,
        company_id: p.company_id,
      })),
    });

    if (!collabs || collabs.length === 0) {
      console.warn('[Booking] No active professionals found for company', company.id);
      setProfessionals([]);
      return;
    }

    // Filter professionals who are linked to at least one selected service
    if (selectedServices.length > 0) {
      const { data: spLinks } = await supabase
        .from('service_professionals')
        .select('professional_id, service_id')
        .eq('company_id', company.id)
        .in('service_id', selectedServices);

      console.log('[Booking] service_professionals lookup', {
        selectedServices,
        spLinksFound: spLinks?.length ?? 0,
        spLinks: spLinks?.map((sp: any) => ({ prof: sp.professional_id, svc: sp.service_id })),
      });

      if (spLinks && spLinks.length > 0) {
        const linkedProfIds = new Set(spLinks.map((sp: any) => sp.professional_id));
        const filtered = collabs.filter((p: any) => linkedProfIds.has(p.id));
        if (filtered.length > 0) {
          setProfessionals(filtered.map((p: any) => ({ id: p.id, full_name: p.name, avatar_url: p.avatar_url })));
          console.log('[Booking] Professionals filtered by service linkage', { total: collabs.length, filtered: filtered.length });
          return;
        }
      }

      // Fallback: no service_professionals rows — auto-link all services to all professionals
      console.warn('[Booking] No service_professionals found, auto-linking all services to all professionals');
      const autoLinks: any[] = [];
      for (const prof of collabs) {
        for (const svcId of selectedServices) {
          autoLinks.push({
            service_id: svcId,
            professional_id: prof.id,
            company_id: company.id,
          });
        }
      }
      if (autoLinks.length > 0) {
        await supabase.from('service_professionals').insert(autoLinks as any);
      }
    }

    // Fallback: show all active professionals
    setProfessionals(collabs.map((p: any) => ({ id: p.id, full_name: p.name, avatar_url: p.avatar_url })));
    console.log('[Booking] Showing all active professionals', { count: collabs.length });
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

  const calculateSlots = async (date: Date) => {
    if (!company || !selectedProfessional) return;

    // Data-ready guard: ensure we have business hours loaded
    if (businessHours.length === 0) {
      console.warn('[Booking] calculateSlots skipped: businessHours not loaded yet');
      return;
    }

    // Data-ready guard: ensure totalDuration is valid
    if (totalDuration <= 0) {
      console.warn('[Booking] calculateSlots skipped: totalDuration is 0', {
        selectedServices,
        loadedServiceIds: services.map(s => s.id),
        matchedServices: services.filter(s => selectedServices.includes(s.id)).map(s => ({ id: s.id, name: s.name, duration: s.duration_minutes })),
      });
      setAvailableSlots([]);
      setSlotsLoading(false);
      return;
    }

    setSlotsLoading(true);

    const dateStr = format(date, 'yyyy-MM-dd');

    const [existingApptsRes, blockedTimesRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('start_time, end_time')
        .eq('company_id', company.id)
        .eq('professional_id', selectedProfessional)
        .neq('status', 'cancelled')
        .gte('start_time', `${dateStr}T00:00:00`)
        .lte('start_time', `${dateStr}T23:59:59`),
      supabase
        .from('blocked_times' as any)
        .select('block_date, start_time, end_time')
        .eq('company_id', company.id)
        .eq('professional_id', selectedProfessional)
        .eq('block_date', dateStr),
    ]);

    console.log('[Booking] calculateSlots input', {
      date: dateStr,
      professional: selectedProfessional,
      totalDuration,
      selectedServices,
      businessHoursCount: businessHours.length,
      professionalHoursCount: professionalHours.length,
      businessHoursDays: businessHours.map(h => ({ day: h.day_of_week, open: h.open_time, close: h.close_time, closed: h.is_closed })),
      professionalHoursDays: professionalHours.map(h => ({ day: h.day_of_week, open: h.open_time, close: h.close_time, closed: h.is_closed })),
      existingAppts: existingApptsRes.data?.length ?? 0,
      blockedTimes: blockedTimesRes.data?.length ?? 0,
      bufferMinutes,
    });

    const engineSlots = calculateAvailableSlots({
      date,
      totalDuration,
      businessHours,
      exceptions,
      existingAppointments: (existingApptsRes.data || []) as ExistingAppointment[],
      slotInterval: 15,
      bufferMinutes,
      professionalHours: professionalHours.length > 0 ? professionalHours : undefined,
      blockedTimes: ((blockedTimesRes.data || []) as unknown as BlockedTime[]),
      professionalId: selectedProfessional,
    });

    console.log('Generated slots:', engineSlots);
    setGeneratedSlots(engineSlots);

    let filteredSlots = engineSlots;

    // Filter past times for today
    if (isToday(date)) {
      const currentTime = format(new Date(), 'HH:mm');
      const beforeFilter = filteredSlots.length;
      filteredSlots = filteredSlots.filter(s => s > currentTime);
      console.log('[Booking] Filtered past slots for today', { before: beforeFilter, after: filteredSlots.length, currentTime });
    }

    console.log('[Booking] calculateSlots result', { slotsFound: filteredSlots.length, firstSlots: filteredSlots.slice(0, 5) });
    setAvailableSlots(filteredSlots);
    setSlotsLoading(false);
  };

  useEffect(() => {
    if (selectedDate && selectedProfessional && company && businessHours.length > 0 && totalDuration > 0) {
      console.log('[Booking] Slot calculation useEffect triggered', {
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        selectedProfessional,
        selectedServices,
        businessHoursCount: businessHours.length,
        professionalHoursCount: professionalHours.length,
        totalDuration,
        availableSlotsCurrently: availableSlots.length,
      });
      calculateSlots(selectedDate);
    }
  }, [selectedDate, selectedProfessional, selectedServices, professionalHours, businessHours, totalDuration, company]);

  useEffect(() => {
    console.log('availableSlots state:', availableSlots);
  }, [availableSlots]);

  // Fetch next available slots across 7 days
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

      const [apptsRes, blockedRes] = await Promise.all([
        supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('company_id', company.id)
          .eq('professional_id', selectedProfessional)
          .neq('status', 'cancelled')
          .gte('start_time', `${dateStr}T00:00:00`)
          .lte('start_time', `${dateStr}T23:59:59`),
        supabase
          .from('blocked_times' as any)
          .select('block_date, start_time, end_time')
          .eq('company_id', company.id)
          .eq('professional_id', selectedProfessional)
          .eq('block_date', dateStr),
      ]);

      let slots = calculateAvailableSlots({
        date: day,
        totalDuration,
        businessHours,
        exceptions,
        existingAppointments: (apptsRes.data || []) as ExistingAppointment[],
        slotInterval: 15,
        bufferMinutes,
        professionalHours: professionalHours.length > 0 ? professionalHours : undefined,
        blockedTimes: ((blockedRes.data || []) as unknown as BlockedTime[]),
        professionalId: selectedProfessional,
      });

      // Filter past times for today
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

  // Trigger next-slots calculation when professional is selected and services are chosen
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
    if (!company || !selectedDate || !selectedProfessional) return;
    setWaitlistLoading(true);
    try {
      let userId: string;
      const { data: existingSession } = await supabase.auth.getSession();

      if (existingSession?.session?.user) {
        userId = existingSession.session.user.id;
      } else {
        if (!clientForm.email || !clientForm.full_name) {
          toast.error('Preencha seu nome e email primeiro');
          setStep('client');
          setWaitlistLoading(false);
          return;
        }
        const { data: authData, error } = await supabase.auth.signUp({
          email: clientForm.email,
          password: Math.random().toString(36).slice(-8) + 'A1!',
          options: { data: { full_name: clientForm.full_name } },
        });
        if (error) throw error;
        userId = authData.user!.id;

        await supabase.from('profiles').update({
          company_id: company.id,
          whatsapp: formatWhatsApp(clientForm.whatsapp),
          birth_date: clientForm.birth_date || null,
          opt_in_whatsapp: optInWhatsapp,
          opt_in_date: optInWhatsapp ? new Date().toISOString() : null,
        } as any).eq('user_id', userId);

        await supabase.from('user_roles').insert({
          user_id: userId,
          company_id: company.id,
          role: 'client' as const,
        });
      }

      const { data: profile } = await supabase.from('profiles').select('id').eq('user_id', userId).single();
      if (!profile) throw new Error('Profile not found');

      await supabase.from('waiting_list').insert({
        company_id: company.id,
        client_id: profile.id,
        service_ids: selectedServices,
        professional_id: selectedProfessional,
        desired_date: format(selectedDate, 'yyyy-MM-dd'),
      });

      toast.success('Você foi adicionado à lista de espera!');
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
      // Upsert client in clients table
      let clientId = savedClientId;
      
      if (!clientId) {
        // Check if client already exists by CPF or WhatsApp
        const formattedWhatsapp = clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : null;
        
        if (clientForm.cpf) {
          const { data: existingByCpf } = await supabase
            .from('clients' as any)
            .select('id')
            .eq('company_id', company.id)
            .eq('cpf', clientForm.cpf)
            .maybeSingle();
          if (existingByCpf) clientId = (existingByCpf as any).id;
        }
        
        if (!clientId && formattedWhatsapp) {
          const { data: existingByWhatsapp } = await supabase
            .from('clients' as any)
            .select('id')
            .eq('company_id', company.id)
            .eq('whatsapp', formattedWhatsapp)
            .maybeSingle();
          if (existingByWhatsapp) clientId = (existingByWhatsapp as any).id;
        }

        if (!clientId) {
          // Create new client
          const { data: newClient, error: clientError } = await supabase
            .from('clients' as any)
            .insert({
              company_id: company.id,
              name: clientForm.full_name,
              cpf: clientForm.cpf || null,
              email: clientForm.email || null,
              whatsapp: formattedWhatsapp,
              opt_in_whatsapp: optInWhatsapp,
            } as any)
            .select()
            .single();
          if (clientError) throw clientError;
          clientId = (newClient as any).id;
        }
      }

      // Persist client_id in localStorage
      if (clientId) {
        localStorage.setItem(`client_id_${company.id}`, clientId);
        setSavedClientId(clientId);
      }

      const [h, m] = selectedTime.split(':').map(Number);
      const startTime = new Date(selectedDate);
      startTime.setHours(h, m, 0, 0);
      const endTime = addMinutes(startTime, totalDuration);

      const appointmentData: any = {
        company_id: company.id,
        professional_id: selectedProfessional,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: totalPrice,
        status: 'pending',
        client_name: clientForm.full_name,
        client_whatsapp: clientForm.whatsapp ? formatWhatsApp(clientForm.whatsapp) : null,
      };

      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .insert(appointmentData)
        .select()
        .single();

      if (aptError) throw aptError;

      const aptServices = selectedServices.map((sid) => {
        const svc = services.find((s) => s.id === sid)!;
        return {
          appointment_id: appointment.id,
          service_id: sid,
          price: Number(svc.price),
          duration_minutes: svc.duration_minutes,
        };
      });
      await supabase.from('appointment_services').insert(aptServices);

      // Fire appointment_created webhook
      try {
        const { data: webhookConfigs } = await supabase
          .from('webhook_configs')
          .select('url')
          .eq('company_id', company.id)
          .eq('event_type', 'appointment_created')
          .eq('active', true);

        const professionalProfile = professionals.find((p) => p.id === selectedProfessional);
        const serviceNames = selectedServices.map((sid) => services.find((s) => s.id === sid)?.name).filter(Boolean);

        const createdPayload = {
          event: 'appointment_created',
          appointment_id: appointment.id,
          company_id: company.id,
          client_name: clientForm.full_name,
          client_whatsapp: formatWhatsApp(clientForm.whatsapp),
          client_email: clientForm.email,
          professional_name: professionalProfile?.full_name || '',
          service_name: serviceNames.join(', '),
          services: serviceNames,
          appointment_date: format(startTime, 'yyyy-MM-dd'),
          appointment_time: format(startTime, 'HH:mm'),
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_price: totalPrice,
        };

        await supabase.from('webhook_events').insert({
          company_id: company.id,
          event_type: 'appointment_created' as any,
          payload: createdPayload,
          status: webhookConfigs && webhookConfigs.length > 0 ? 'sent' : 'no_config',
        });

        for (const config of webhookConfigs || []) {
          fetch(config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(createdPayload),
          }).catch(() => {});
        }
      } catch (webhookErr) {
        // webhook failures are non-critical
      }

      toast.success('Agendamento realizado com sucesso!');
      setStep('services');
      setSelectedServices([]);
      setSelectedProfessional(null);
      setSelectedDate(undefined);
      setSelectedTime(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao agendar');
    } finally {
      setLoading(false);
    }
  };

  if (!company) {
    return (
      <div className={cn('min-h-screen flex items-center justify-center', isDark ? 'bg-[#1a1a2e] text-white' : 'bg-[#fdf6f0] text-[#3d2c2c]')}>
        <p className="opacity-60">Carregando...</p>
      </div>
    );
  }

  const Icon = isDark ? Scissors : Sparkles;

  // Theme classes
  const bgPage = isDark ? 'bg-[#1a1a2e]' : 'bg-[#fdf6f0]';
  const textPage = isDark ? 'text-white' : 'text-[#3d2c2c]';
  const bgHeader = isDark ? 'bg-[#16213e] border-[#2a2a4a]' : 'bg-white/80 border-[#e8ddd4]';
  const bgCard = isDark ? 'bg-[#16213e] border-[#2a2a4a]' : 'bg-white border-[#e8ddd4]';
  const bgMuted = isDark ? 'bg-[#2a2a4a]' : 'bg-[#f5ebe0]';
  const textMuted = isDark ? 'text-gray-400' : 'text-[#8b7e74]';
  const accentColor = isDark ? 'bg-amber-500 text-black' : 'bg-rose-400 text-white';
  const accentBorder = isDark ? 'border-amber-500' : 'border-rose-400';
  const accentText = isDark ? 'text-amber-400' : 'text-rose-500';
  const accentBg = isDark ? 'bg-amber-500/10' : 'bg-rose-400/10';
  const iconBg = isDark ? 'bg-amber-500' : 'bg-rose-400';

  const skipProfessionalStep = !!professionalSlug;

  // Dynamic branding from company_settings
  const brandStyle: React.CSSProperties = companySettings?.primary_color
    ? {
        '--brand-primary': companySettings.primary_color,
        '--brand-secondary': companySettings.secondary_color || '#F59E0B',
      } as React.CSSProperties
    : {};

  // Use settings logo_url if company doesn't have one
  const displayLogoUrl = company.logo_url || companySettings?.logo_url;

  return (
    <div className={cn('min-h-screen', bgPage, textPage)} style={brandStyle}>
      {/* Header */}
      <header className={cn('border-b', bgHeader)}>
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {displayLogoUrl ? (
            <img src={displayLogoUrl} alt={company.name} className="w-10 h-10 rounded-xl object-cover" />
          ) : (
            <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', iconBg)}>
              <Icon className="h-5 w-5 text-white" />
            </div>
          )}
          <div>
            <h1 className="font-bold text-lg">{company.name}</h1>
            <p className={cn('text-xs', textMuted)}>
              {businessType === 'barbershop' ? 'Barbearia' : 'Estética'} • Agendamento online
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Progress bar */}
        <div className="flex gap-1">
          {(skipProfessionalStep
            ? ['services', 'datetime', 'client', 'confirm'] as Step[]
            : ['services', 'professional', 'datetime', 'client', 'confirm'] as Step[]
          ).map((s, i, arr) => {
            const stepIndex = arr.indexOf(step);
            return (
              <div
                key={s}
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors',
                  i <= stepIndex
                    ? isDark ? 'bg-amber-500' : 'bg-rose-400'
                    : isDark ? 'bg-[#2a2a4a]' : 'bg-[#e8ddd4]'
                )}
              />
            );
          })}
        </div>

        {/* Step: Services */}
        {step === 'services' && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">Escolha os serviços</h2>
            <div className="space-y-2">
              {services.map((svc) => (
                <div
                  key={svc.id}
                  onClick={() => toggleService(svc.id)}
                  className={cn(
                    'p-4 rounded-xl border cursor-pointer transition-all',
                    bgCard,
                    selectedServices.includes(svc.id) && accentBorder,
                    selectedServices.includes(svc.id) && accentBg
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Checkbox checked={selectedServices.includes(svc.id)} />
                    <div className="flex-1">
                      <p className="font-semibold">{svc.name}</p>
                      <div className={cn('flex gap-3 text-sm', textMuted)}>
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {svc.duration_minutes} min</span>
                        <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> R$ {Number(svc.price).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {selectedServices.length > 0 && (
              <div className={cn('flex items-center justify-between p-3 rounded-lg', bgMuted)}>
                <div className="text-sm">
                  <span>{selectedServices.length} serviço(s)</span>
                  <span className="mx-2 opacity-40">•</span>
                  <span>{totalDuration} min</span>
                  <span className="mx-2 opacity-40">•</span>
                  <span className="font-semibold">R$ {totalPrice.toFixed(2)}</span>
                </div>
                <Button
                  onClick={() => {
                    if (skipProfessionalStep) {
                      setStep('datetime');
                    } else {
                      fetchProfessionals();
                      setStep('professional');
                    }
                  }}
                  className={cn(isDark ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-rose-400 hover:bg-rose-500 text-white')}
                >
                  Próximo <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Step: Professional */}
        {step === 'professional' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('services')} className={textMuted}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <h2 className="text-xl font-bold">Escolha o profissional</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {professionals.map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    setSelectedProfessional(p.id);
                    fetchProfessionalHours(p.id);
                    setStep('datetime');
                  }}
                  className={cn(
                    'p-4 rounded-xl border cursor-pointer transition-all',
                    bgCard,
                    selectedProfessional === p.id && accentBorder,
                    selectedProfessional === p.id && accentBg
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center font-bold', accentBg, accentText)}>
                      {p.full_name?.charAt(0)?.toUpperCase()}
                    </div>
                    <p className="font-semibold">{p.full_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step: Date/Time */}
        {step === 'datetime' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep(skipProfessionalStep ? 'services' : 'professional')} className={textMuted}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <h2 className="text-xl font-bold">Escolha data e horário</h2>

            {/* Next Available Slots */}
            {nextSlots.length > 0 && (
              <div className={cn('rounded-xl border p-4 space-y-3', bgCard)}>
                <div className="flex items-center gap-2">
                  <Zap className={cn('h-4 w-4', accentText)} />
                  <p className="font-semibold text-sm">Próximos horários disponíveis</p>
                </div>
                {nextSlots.map(({ date, slots }) => {
                  const dayLabel = isToday(date)
                    ? 'Hoje'
                    : isTomorrow(date)
                    ? 'Amanhã'
                    : format(date, "EEEE, dd/MM", { locale: ptBR });
                  return (
                    <div key={date.toISOString()}>
                      <p className={cn('text-xs font-medium mb-1.5 capitalize', textMuted)}>{dayLabel}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((slot) => (
                          <Button
                            key={`${date.toISOString()}-${slot}`}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickSlot(date, slot)}
                            className={cn(
                              'transition-all',
                              isDark
                                ? 'border-amber-500/40 hover:bg-amber-500 hover:text-black'
                                : 'border-rose-400/40 hover:bg-rose-400 hover:text-white'
                            )}
                          >
                            {slot}
                          </Button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {nextSlotsLoading && (
              <p className={cn('text-sm', textMuted)}>Buscando próximos horários...</p>
            )}

            <p className={cn('text-xs text-center', textMuted)}>ou escolha uma data no calendário</p>

            <div className={cn('rounded-xl border p-4', bgCard)}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => { setSelectedDate(date); setSelectedTime(null); }}
                locale={ptBR}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
              />
            </div>
            {selectedDate && (() => {
              console.log('[Booking] RENDER slots section', {
                selectedDate: format(selectedDate, 'yyyy-MM-dd'),
                slotsLoading,
                generatedSlotsCount: generatedSlots.length,
                generatedFirstSlots: generatedSlots.slice(0, 5),
                availableSlotsCount: availableSlots.length,
                firstSlots: availableSlots.slice(0, 5),
                totalDuration,
                selectedProfessional,
                businessHoursCount: businessHours.length,
              });
              return null;
            })()}
            {selectedDate && (
              <div>
                <p className={cn('text-sm font-medium mb-2')}>
                  Horários disponíveis
                  {totalDuration > 0 && (
                    <span className={cn('font-normal ml-2', textMuted)}>
                      (bloco de {totalDuration} min necessário)
                    </span>
                  )}
                </p>
                {slotsLoading ? (
                  <p className={cn('text-sm', textMuted)}>Calculando disponibilidade...</p>
                ) : availableSlots.length === 0 && generatedSlots.length === 0 ? (
                  <div className="space-y-3">
                    <p className={cn('text-sm', textMuted)}>
                      {businessHours.length === 0
                        ? 'Horários de funcionamento não configurados'
                        : 'Nenhum horário disponível neste dia'}
                    </p>
                    <div className={cn('p-4 rounded-xl border border-dashed', isDark ? 'border-amber-500/50 bg-amber-500/5' : 'border-rose-400/50 bg-rose-400/5')}>
                      <div className="flex items-start gap-3">
                        <Bell className={cn('h-5 w-5 mt-0.5', accentText)} />
                        <div className="flex-1">
                          <p className="font-semibold text-sm">Quer ser avisado se surgir vaga?</p>
                          <p className={cn('text-xs mt-1', textMuted)}>
                            Entre na lista de espera e avisaremos quando um horário ficar disponível para {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}.
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            className={cn('mt-3', accentBorder, accentText)}
                            onClick={handleJoinWaitlist}
                            disabled={waitlistLoading}
                          >
                            <Bell className="h-4 w-4 mr-1" />
                            {waitlistLoading ? 'Entrando...' : 'Avisar se surgir vaga'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {(availableSlots.length > 0 ? availableSlots : generatedSlots).map((slot) => (
                      <Button
                        key={slot}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedTime(slot)}
                        className={cn(
                          selectedTime === slot
                            ? isDark ? 'bg-amber-500 text-black border-amber-500' : 'bg-rose-400 text-white border-rose-400'
                            : cn(bgCard, 'hover:opacity-80')
                        )}
                      >
                        {slot}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {selectedTime && (
              <Button
                onClick={() => setStep('client')}
                className={cn('w-full', isDark ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-rose-400 hover:bg-rose-500 text-white')}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        )}

        {/* Step: Client info */}
        {step === 'client' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('datetime')} className={textMuted}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <h2 className="text-xl font-bold">
              {savedClientId ? 'Confirme seus dados' : 'Cadastro rápido'}
            </h2>
            {savedClientId && (
              <p className={cn('text-sm', textMuted)}>Seus dados foram carregados automaticamente.</p>
            )}
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nome *</Label>
                <Input
                  value={clientForm.full_name}
                  onChange={(e) => setClientForm({ ...clientForm, full_name: e.target.value })}
                  required
                  className={cn(isDark ? 'bg-[#16213e] border-[#2a2a4a] text-white' : 'bg-white border-[#e8ddd4]')}
                />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
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
                  placeholder="000.000.000-00"
                  maxLength={14}
                  className={cn(isDark ? 'bg-[#16213e] border-[#2a2a4a] text-white' : 'bg-white border-[#e8ddd4]')}
                />
              </div>
              <div className="space-y-1">
                <Label>WhatsApp *</Label>
                <Input
                  value={clientForm.whatsapp}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                    let masked = digits;
                    if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                    else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                    setClientForm({ ...clientForm, whatsapp: masked });
                  }}
                  placeholder="(11) 99999-9999"
                  maxLength={15}
                  required
                  className={cn(isDark ? 'bg-[#16213e] border-[#2a2a4a] text-white' : 'bg-white border-[#e8ddd4]')}
                />
                {clientForm.whatsapp && clientForm.whatsapp.replace(/\D/g, '').length > 0 && !isValidWhatsApp(clientForm.whatsapp) && (
                  <p className="text-sm text-destructive">Número inválido. Use DDD + número.</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Email (opcional)</Label>
                <Input
                  type="email"
                  value={clientForm.email}
                  onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                  className={cn(isDark ? 'bg-[#16213e] border-[#2a2a4a] text-white' : 'bg-white border-[#e8ddd4]')}
                />
              </div>
              <div className="space-y-1">
                <Label>Data de nascimento</Label>
                <Input
                  type="date"
                  value={clientForm.birth_date}
                  onChange={(e) => setClientForm({ ...clientForm, birth_date: e.target.value })}
                  className={cn(isDark ? 'bg-[#16213e] border-[#2a2a4a] text-white' : 'bg-white border-[#e8ddd4]')}
                />
              </div>
            </div>
            <div className="flex items-start gap-3 pt-2">
              <Checkbox
                id="opt-in-whatsapp"
                checked={optInWhatsapp}
                onCheckedChange={(v) => setOptInWhatsapp(v === true)}
              />
              <label htmlFor="opt-in-whatsapp" className={cn('text-sm leading-snug cursor-pointer', textMuted)}>
                Aceito receber lembretes e comunicações via WhatsApp. Posso cancelar a qualquer momento.
              </label>
            </div>
            <Button
              onClick={() => setStep('confirm')}
              className={cn('w-full', isDark ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-rose-400 hover:bg-rose-500 text-white')}
              disabled={!clientForm.full_name || !clientForm.whatsapp || !isValidWhatsApp(clientForm.whatsapp)}
            >
              Revisar Agendamento <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}

        {/* Step: Confirm */}
        {step === 'confirm' && (
          <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={() => setStep('client')} className={textMuted}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <h2 className="text-xl font-bold">Confirmar Agendamento</h2>
            <div className={cn('rounded-xl border p-5 space-y-4', bgCard)}>
              <div>
                <p className={cn('text-sm', textMuted)}>Serviços</p>
                <div className="flex flex-wrap gap-2 mt-1">
                  {services.filter((s) => selectedServices.includes(s.id)).map((s) => (
                    <Badge key={s.id} className={cn(accentBg, accentText, 'border-0')}>{s.name}</Badge>
                  ))}
                </div>
              </div>
              <div>
                <p className={cn('text-sm', textMuted)}>Profissional</p>
                <p className="font-semibold">{professionals.find((p) => p.id === selectedProfessional)?.full_name}</p>
              </div>
              <div>
                <p className={cn('text-sm', textMuted)}>Data e horário</p>
                <p className="font-semibold">
                  {selectedDate && format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })} às {selectedTime}
                </p>
              </div>
              <div>
                <p className={cn('text-sm', textMuted)}>Duração total</p>
                <p className="font-semibold">{totalDuration} minutos</p>
              </div>
              <div className={cn('pt-3 border-t', isDark ? 'border-[#2a2a4a]' : 'border-[#e8ddd4]')}>
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span className={accentText}>R$ {totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleBook}
              className={cn('w-full', isDark ? 'bg-amber-500 hover:bg-amber-600 text-black' : 'bg-rose-400 hover:bg-rose-500 text-white')}
              disabled={loading}
              size="lg"
            >
              {loading ? 'Agendando...' : (
                <>
                  <CheckCircle2 className="h-5 w-5 mr-2" /> Confirmar Agendamento
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BookingPage;
