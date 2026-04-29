import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { CheckCircle2, XCircle, Clock, CalendarIcon, Scissors, User, Loader2, ChevronLeft } from 'lucide-react';
import { format, parseISO, addMinutes, addDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type ExistingAppointment, type BlockedTime } from '@/lib/availability-engine';
import { openWhatsApp } from '@/lib/whatsapp';

const T = {
  bg: '#0B132B',
  card: '#111827',
  accent: '#F59E0B',
  accentHover: '#D97706',
  text: '#FFFFFF',
  textSec: '#9CA3AF',
  border: '#1F2937',
  green: 'rgba(34,197,94,0.15)',
  greenText: '#4ADE80',
};

const DEFAULT_TZ = 'America/Sao_Paulo';

const timeStringToMinutes = (v: string) => {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
};

const getAppointmentMinutesInTimezone = (value: string, timezone: string) => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(new Date(value));
  const hours = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minutes = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hours * 60 + minutes;
};

const filterOverlappingSlots = (
  slots: string[], appointments: ExistingAppointment[], serviceDuration: number,
  _bufferMinutes: number, timezone: string, excludeId: string,
) => {
  return slots.filter((slot) => {
    const slotStart = timeStringToMinutes(slot);
    const slotEnd = slotStart + serviceDuration;
    return !appointments.some((apt) => {
      if ((apt as any).id === excludeId) return false;
      const aStart = getAppointmentMinutesInTimezone(apt.start_time, timezone);
      const aEnd = getAppointmentMinutesInTimezone(apt.end_time, timezone);
      return aStart < slotEnd && aEnd > slotStart;
    });
  });
};

const RescheduleAppointment = () => {
  const { appointmentId } = useParams<{ appointmentId: string }>();
  const [appointment, setAppointment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<'info' | 'date' | 'time' | 'success'>('info');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [businessHours, setBusinessHours] = useState<BusinessHours[]>([]);
  const [professionalHours, setProfessionalHours] = useState<BusinessHours[]>([]);
  const [exceptions, setExceptions] = useState<BusinessException[]>([]);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [existingAppointments, setExistingAppointments] = useState<any[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const slotReqRef = useRef(0);

  useEffect(() => {
    if (appointmentId) fetchAppointment();
  }, [appointmentId]);

  const fetchAppointment = async () => {
    const { data, error } = await supabase.rpc('get_appointment_public', {
      p_appointment_id: appointmentId!,
    });

    if (data && !error) {
      const apt = data as any;
      setAppointment(apt);
      setBufferMinutes(apt.company?.buffer_minutes || 0);
      const services = apt.appointment_services || [];
      const dur = services.reduce((s: number, as_: any) => s + (as_.service?.duration_minutes || as_.duration_minutes || 0), 0);
      setTotalDuration(dur);

      // Fetch business hours & exceptions
      const companyId = apt.company?.id || apt.company_id;
      const [bhRes, exRes, phRes] = await Promise.all([
        supabase.from('business_hours').select('*').eq('company_id', companyId),
        supabase.from('business_exceptions').select('*').eq('company_id', companyId),
        supabase.from('professional_working_hours').select('*').eq('professional_id', apt.professional_id).eq('company_id', companyId),
      ]);
      if (bhRes.data) setBusinessHours(bhRes.data as BusinessHours[]);
      if (exRes.data) setExceptions(exRes.data as BusinessException[]);
      if (phRes.data && phRes.data.length > 0) setProfessionalHours(phRes.data as BusinessHours[]);

      if (apt.status === 'cancelled' || apt.status === 'completed' || apt.status === 'no_show') {
        // Can't reschedule
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!selectedDate || !appointment) return;
    loadSlots();
  }, [selectedDate]);

  const loadSlots = async () => {
    if (!appointment || !selectedDate) return;
    setSlotsLoading(true);
    const reqId = ++slotReqRef.current;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const companyId = appointment.company?.id || appointment.company_id;

    const { data: aptData } = await supabase.rpc('get_booking_appointments', {
      p_company_id: companyId,
      p_professional_id: appointment.professional_id,
      p_selected_date: dateStr,
      p_timezone: DEFAULT_TZ,
    });

    if (reqId !== slotReqRef.current) return;
    const apts = (aptData || []) as ExistingAppointment[];
    setExistingAppointments(apts);

    // Pass the real bookings into the engine so the SAME free-window pipeline
    // used by the public booking flow filters them out — but exclude the
    // appointment being rescheduled from the occupied list (otherwise the user
    // would see no slots around their own current time).
    const apptsForEngine = apts.filter((a) => (a as any).id !== appointmentId);
    const rawSlots = calculateAvailableSlots({
      date: selectedDate,
      totalDuration,
      businessHours,
      exceptions,
      existingAppointments: apptsForEngine,
      bufferMinutes,
      professionalHours: professionalHours.length > 0 ? professionalHours : undefined,
      blockedTimes: [],
    });
    setAvailableSlots(rawSlots);
    setSlotsLoading(false);
  };

  const handleReschedule = async () => {
    if (!selectedDate || !selectedTime || !appointment) return;
    setSubmitting(true);
    const [rh, rm] = selectedTime.split(':').map(Number);
    const newStart = new Date(selectedDate);
    newStart.setHours(rh, rm, 0, 0);
    const newEnd = addMinutes(newStart, totalDuration);

    try {
      const { data, error } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: appointmentId!,
        p_new_start: newStart.toISOString(),
        p_new_end: newEnd.toISOString(),
      });

      if (error) {
        toast.error(error.message || 'Erro ao reagendar');
        return;
      }

      const res = data as any;
      if (res.success) {
        setStep('success');

        // Notificação push agora é disparada automaticamente pelo backend via trigger
        console.log('Reschedule push notification scheduled via backend');
      } else {
        toast.error('Não foi possível reagendar');
      }
    } catch {
      toast.error('Erro ao reagendar');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.accent }} />
      </div>
    );
  }

  if (!appointment) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: T.bg, color: T.text }}>
        <div className="text-center space-y-4">
          <XCircle className="h-16 w-16 mx-auto text-red-400" />
          <h1 className="text-xl font-bold">Agendamento não encontrado</h1>
        </div>
      </div>
    );
  }

  const canReschedule = !['cancelled', 'completed', 'no_show'].includes(appointment.status) && !appointment.promotion_id;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: T.bg, color: T.text }}>
      <div className="w-full max-w-md space-y-6">
        {!canReschedule && (
          <div className="text-center space-y-4">
            <XCircle className="h-16 w-16 mx-auto text-red-400" />
            <h1 className="text-xl font-bold">Não é possível reagendar</h1>
            <p style={{ color: T.textSec }}>{appointment.promotion_id ? 'Agendamentos de promoção não podem ser reagendados. Cancele e agende novamente.' : 'Este agendamento já foi cancelado ou concluído.'}</p>
          </div>
        )}

        {canReschedule && step === 'info' && (
          <>
            <div className="text-center">
              <h1 className="text-xl font-bold">Reagendar Horário</h1>
              <p className="text-sm mt-1" style={{ color: T.textSec }}>Selecione uma nova data e horário</p>
            </div>

            <div className="rounded-2xl p-5 space-y-4" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Profissional</p>
                  <p className="font-semibold text-sm">{appointment.professional?.full_name}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Scissors className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Serviços</p>
                  <p className="font-semibold text-sm">
                    {appointment.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <CalendarIcon className="h-5 w-5 shrink-0" style={{ color: T.accent }} />
                <div>
                  <p className="text-xs" style={{ color: T.textSec }}>Horário atual</p>
                  <p className="font-semibold text-sm">
                    {format(parseISO(appointment.start_time), "dd/MM/yyyy 'às' HH:mm")}
                  </p>
                </div>
              </div>
            </div>

            <Button
              onClick={() => setStep('date')}
              className="w-full rounded-xl py-5 font-semibold"
              style={{ background: T.accent, color: '#000' }}
            >
              Escolher nova data
            </Button>
          </>
        )}

        {canReschedule && step === 'date' && (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => setStep('info')} style={{ color: T.text }}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-bold">Selecione a data</h1>
            </div>

            <div className="rounded-2xl p-4 flex justify-center" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => { setSelectedDate(d); if (d) setStep('time'); }}
                disabled={(d) => d < startOfDay(new Date())}
                locale={ptBR}
                className="rounded-md"
              />
            </div>
          </>
        )}

        {canReschedule && step === 'time' && (
          <>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => { setStep('date'); setSelectedTime(null); }} style={{ color: T.text }}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-bold">
                {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
              </h1>
            </div>

            {slotsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin" style={{ color: T.accent }} />
              </div>
            ) : availableSlots.length === 0 ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
                <p style={{ color: T.textSec }}>Nenhum horário disponível nesta data</p>
                <Button onClick={() => setStep('date')} variant="ghost" className="mt-4" style={{ color: T.accent }}>
                  Escolher outra data
                </Button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {availableSlots.map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedTime(slot)}
                      className="py-3 rounded-xl text-sm font-semibold transition-all"
                      style={{
                        background: selectedTime === slot ? T.accent : T.card,
                        color: selectedTime === slot ? '#000' : T.text,
                        border: `1px solid ${selectedTime === slot ? T.accent : T.border}`,
                      }}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
                {selectedTime && (
                  <Button
                    onClick={handleReschedule}
                    disabled={submitting}
                    className="w-full rounded-xl py-5 font-semibold"
                    style={{ background: T.accent, color: '#000' }}
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Reagendando...</>
                    ) : (
                      <><CheckCircle2 className="h-4 w-4 mr-2" /> Confirmar {selectedTime}</>
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {step === 'success' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ background: T.green }}>
              <CheckCircle2 className="h-10 w-10" style={{ color: T.greenText }} />
            </div>
            <h1 className="text-xl font-bold">Reagendamento Confirmado!</h1>
            <p style={{ color: T.textSec }}>Seu agendamento foi reagendado com sucesso.</p>

            <div className="rounded-2xl p-4 text-left space-y-2" style={{ background: T.card, border: `1px solid ${T.border}` }}>
              <p className="text-sm" style={{ color: T.textSec }}>De:</p>
              <p className="text-sm">
                {format(parseISO(appointment.start_time), "dd 'de' MMMM", { locale: ptBR })} às{' '}
                {format(parseISO(appointment.start_time), 'HH:mm')}
              </p>
              <p className="text-sm mt-2" style={{ color: T.textSec }}>Para:</p>
              <p className="font-bold">
                {selectedDate && format(selectedDate, "dd 'de' MMMM", { locale: ptBR })} às {selectedTime}
              </p>
            </div>

            <Button
              onClick={() => {
                const profWhatsapp = appointment.professional?.whatsapp;
                const companyWhatsapp = appointment.company?.whatsapp;
                const rawPhone = (profWhatsapp || companyWhatsapp || '').replace(/\D/g, '');
                const phone = rawPhone.startsWith('55') ? rawPhone : '55' + rawPhone;
                const clientName = appointment.client_name || appointment.client?.name || 'Cliente';
                const services = appointment.appointment_services?.map((s: any) => s.service?.name).join(', ') || '';
                const oldDate = format(parseISO(appointment.start_time), "dd/MM/yyyy");
                const oldTime = format(parseISO(appointment.start_time), 'HH:mm');
                const newDate = selectedDate ? format(selectedDate, "dd/MM/yyyy") : '';
                const msg = `Olá! 👋\n\nUm cliente reagendou um horário.\n\nCliente: ${clientName}\n\nServiço: ${services}\n\nReagendado de:\n${oldDate} às ${oldTime}\n\nPara:\n*${newDate} às ${selectedTime}*`;
                openWhatsApp(phone, { source: 'reschedule-appointment', message: msg });
              }}
              className="w-full rounded-xl py-5 font-semibold"
              style={{ background: '#25D366', color: '#fff' }}
            >
              📲 Avisar o profissional
            </Button>

            <Button
              onClick={() => window.location.href = '/'}
              variant="ghost"
              className="w-full rounded-xl py-5"
              style={{ color: T.textSec }}
            >
              Voltar ao início
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default RescheduleAppointment;
