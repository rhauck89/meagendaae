import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Clock, CalendarPlus, Users, Loader2 } from 'lucide-react';
import { format, parseISO, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateAvailableSlots } from '@/lib/availability-engine';
import { formatWhatsApp } from '@/lib/whatsapp';

const Waitlist = () => {
  const { companyId } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceNamesMap, setServiceNamesMap] = useState<Record<string, string>>({});
  const [serviceDurationsMap, setServiceDurationsMap] = useState<Record<string, number>>({});

  // Booking modal state
  const [bookingTarget, setBookingTarget] = useState<any>(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    fetchEntries();
    fetchProfessionals();
  }, [companyId]);

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, slug, profiles!collaborators_profile_id_fkey(full_name, avatar_url)')
      .eq('company_id', companyId!)
      .eq('active', true);
    setProfessionals(data || []);
  };

  const fetchEntries = async () => {
    setLoading(true);
    const { data: wlData } = await supabase
      .from('waiting_list')
      .select(`
        *,
        client:profiles!waiting_list_client_id_fkey(full_name, whatsapp),
        professional:profiles!waiting_list_professional_id_fkey(full_name)
      `)
      .eq('company_id', companyId!)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });

    const { data: wData } = await supabase
      .from('waitlist')
      .select('*')
      .eq('company_id', companyId!)
      .eq('notified', false)
      .order('created_at', { ascending: true });

    const fromWl = (wlData || []).map((e: any) => ({
      id: e.id,
      client_name: e.client?.full_name || 'Cliente',
      client_whatsapp: e.client?.whatsapp || null,
      service_ids: e.service_ids,
      professional_id: e.professional_id || null,
      professional_name: e.professional?.full_name || null,
      desired_date: e.desired_date,
      created_at: e.created_at,
      source: 'waiting_list' as const,
    }));
    const fromW = (wData || []).map((e: any) => ({
      id: e.id,
      client_name: e.client_name || 'Cliente',
      client_whatsapp: e.client_whatsapp || null,
      service_ids: e.service_ids,
      professional_id: e.professional_id || null,
      professional_name: null,
      desired_date: e.desired_date,
      created_at: e.created_at,
      source: 'waitlist' as const,
    }));
    setEntries([...fromWl, ...fromW].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setLoading(false);
  };

  useEffect(() => {
    if (entries.length === 0) return;
    const allIds = [...new Set(entries.flatMap(e => e.service_ids || []))];
    if (allIds.length === 0) return;
    supabase
      .from('services')
      .select('id, name, duration_minutes')
      .in('id', allIds)
      .then(({ data }) => {
        const nameMap: Record<string, string> = {};
        const durMap: Record<string, number> = {};
        data?.forEach(s => {
          nameMap[s.id] = s.name;
          durMap[s.id] = s.duration_minutes;
        });
        setServiceNamesMap(nameMap);
        setServiceDurationsMap(durMap);
      });
  }, [entries]);

  const getServiceNames = (ids: string[]) => {
    if (!ids) return '—';
    return ids.map(id => serviceNamesMap[id] || '').filter(Boolean).join(', ') || '—';
  };

  const getTotalDuration = (ids: string[]) => {
    if (!ids) return 30;
    return ids.reduce((sum, id) => sum + (serviceDurationsMap[id] || 30), 0);
  };

  const openBookingModal = (entry: any) => {
    setBookingTarget(entry);
    setSelectedProfessional(entry.professional_id || '');
    setSelectedDate(entry.desired_date ? parseISO(entry.desired_date) : undefined);
    setSelectedSlot(null);
    setSlots([]);
    setBookingOpen(true);
  };

  // Fetch slots when professional + date are selected
  useEffect(() => {
    if (!bookingOpen || !selectedProfessional || !selectedDate || !companyId || !bookingTarget) return;
    fetchSlots();
  }, [selectedProfessional, selectedDate]);

  const fetchSlots = async () => {
    if (!selectedDate || !selectedProfessional || !companyId || !bookingTarget) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const [profHoursRes, bizHoursRes, blocksRes, exceptionsRes, companyRes, apptsRes] = await Promise.all([
        supabase.from('professional_working_hours').select('*').eq('professional_id', selectedProfessional).eq('company_id', companyId),
        supabase.from('business_hours').select('*').eq('company_id', companyId),
        supabase.from('blocked_times').select('*').eq('professional_id', selectedProfessional).eq('block_date', dateStr),
        supabase.from('business_exceptions').select('*').eq('company_id', companyId).eq('exception_date', dateStr),
        supabase.from('companies').select('buffer_minutes').eq('id', companyId).single(),
        supabase.from('appointments').select('id, start_time, end_time').eq('professional_id', selectedProfessional).eq('company_id', companyId).gte('start_time', `${dateStr}T00:00:00`).lt('start_time', `${dateStr}T23:59:59`).not('status', 'in', '("cancelled","no_show")'),
      ]);

      const totalDuration = getTotalDuration(bookingTarget.service_ids);
      const availableSlots = calculateAvailableSlots({
        date: selectedDate,
        totalDuration,
        businessHours: bizHoursRes.data || [],
        exceptions: exceptionsRes.data || [],
        existingAppointments: apptsRes.data || [],
        bufferMinutes: companyRes.data?.buffer_minutes || 0,
        professionalHours: profHoursRes.data && profHoursRes.data.length > 0 ? profHoursRes.data : undefined,
        blockedTimes: blocksRes.data || [],
      });
      setSlots(availableSlots);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      toast.error('Erro ao buscar horários');
    } finally {
      setSlotsLoading(false);
    }
  };

  const confirmBooking = async () => {
    if (!bookingTarget || !selectedSlot || !selectedDate || !selectedProfessional || !companyId) return;
    setBookingLoading(true);
    try {
      const totalDuration = getTotalDuration(bookingTarget.service_ids);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const startTime = new Date(`${dateStr}T${selectedSlot}:00`);
      const endTime = addMinutes(startTime, totalDuration);

      // Create client first
      const { data: clientId, error: clientErr } = await supabase.rpc('create_client', {
        p_company_id: companyId,
        p_name: bookingTarget.client_name,
        p_whatsapp: bookingTarget.client_whatsapp || '',
        p_email: '',
        p_cpf: '',
      });
      if (clientErr) throw clientErr;

      // Create appointment
      const { data: appointmentId, error: aptErr } = await supabase.rpc('create_appointment', {
        p_client_id: clientId,
        p_professional_id: selectedProfessional,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_total_price: 0,
        p_client_name: bookingTarget.client_name,
        p_client_whatsapp: bookingTarget.client_whatsapp || '',
        p_notes: 'Agendado via lista de espera',
      });
      if (aptErr) throw aptErr;

      // Create appointment services
      if (bookingTarget.service_ids && bookingTarget.service_ids.length > 0) {
        const servicesPayload = bookingTarget.service_ids.map((sid: string) => ({
          service_id: sid,
          price: 0,
          duration_minutes: serviceDurationsMap[sid] || 30,
        }));
        await supabase.rpc('create_appointment_services', {
          p_appointment_id: appointmentId,
          p_services: servicesPayload,
        });
      }

      // Mark waitlist entry as handled
      if (bookingTarget.source === 'waitlist') {
        await supabase.from('waitlist').update({ notified: true }).eq('id', bookingTarget.id);
      } else {
        await supabase.from('waiting_list').update({ status: 'confirmed' as any }).eq('id', bookingTarget.id);
      }

      toast.success('Agendamento criado com sucesso!');

      // Send WhatsApp notification
      if (bookingTarget.client_whatsapp) {
        const msg = encodeURIComponent(
          `✅ Seu horário foi confirmado!\n\n📅 ${format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}\n⏰ ${selectedSlot}\n\nObrigado pela paciência!`
        );
        window.open(`https://wa.me/${formatWhatsApp(bookingTarget.client_whatsapp)}?text=${msg}`, '_blank');
      }

      setBookingOpen(false);
      setBookingTarget(null);
      fetchEntries();
    } catch (err: any) {
      console.error('Booking error:', err);
      toast.error(err.message || 'Erro ao criar agendamento');
    } finally {
      setBookingLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Lista de Espera
        </h1>
        <Badge variant="outline" className="text-sm">
          {entries.length} aguardando
        </Badge>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum cliente na lista de espera</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <Card key={entry.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{entry.client_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getServiceNames(entry.service_ids)}
                    </p>
                    {entry.professional_name && (
                      <p className="text-xs text-muted-foreground">
                        Preferência: {entry.professional_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 sm:gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      📅 {format(parseISO(entry.desired_date), "dd 'de' MMM", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entrou {format(parseISO(entry.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                    {entry.professional_name && (
                      <p className="text-xs text-muted-foreground">
                        Pref: {entry.professional_name}
                      </p>
                    )}
                  </div>
                  {entry.client_whatsapp && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const msg = encodeURIComponent(
                          `Olá ${entry.client_name}! 👋\n\nVimos que você está na nossa lista de espera.\n\nTemos novidades sobre disponibilidade! Gostaria de agendar?\n\nAguardamos seu retorno!`
                        );
                        window.open(`https://wa.me/${formatWhatsApp(entry.client_whatsapp)}?text=${msg}`, '_blank');
                      }}
                    >
                      📲 WhatsApp
                    </Button>
                  )}
                  <Button size="sm" onClick={() => openBookingModal(entry)}>
                    <CalendarPlus className="h-4 w-4 mr-1" />
                    Agendar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Booking Modal */}
      <Dialog open={bookingOpen} onOpenChange={(open) => { if (!open) { setBookingOpen(false); setBookingTarget(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar para {bookingTarget?.client_name}</DialogTitle>
            <DialogDescription>
              {bookingTarget && getServiceNames(bookingTarget.service_ids)}
              {bookingTarget?.client_whatsapp && ` • ${bookingTarget.client_whatsapp}`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Professional selector */}
            <div>
              <label className="text-sm font-medium block mb-1.5">Profissional</label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p: any) => (
                    <SelectItem key={p.profile_id} value={p.profile_id}>
                      {(p.profiles as any)?.full_name || 'Profissional'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date + Slots in two columns */}
            {selectedProfessional && (
              <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4">
                <div>
                  <label className="text-sm font-medium block mb-1.5">Data</label>
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => { setSelectedDate(date || undefined); }}
                    locale={ptBR}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    className="rounded-md border pointer-events-auto"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium block mb-1.5">Horário disponível</label>
                  {!selectedDate ? (
                    <p className="text-sm text-muted-foreground mt-4">Selecione uma data</p>
                  ) : slotsLoading ? (
                    <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Buscando horários...
                    </div>
                  ) : slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground mt-4">Nenhum horário disponível nesta data</p>
                  ) : (
                    <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                      {slots.map(slot => (
                        <Button
                          key={slot}
                          variant={selectedSlot === slot ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedSlot(slot)}
                          className="text-sm"
                        >
                          {slot}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Confirm button */}
            {selectedSlot && selectedDate && (
              <div className="flex justify-end pt-2">
                <Button onClick={confirmBooking} disabled={bookingLoading}>
                  {bookingLoading ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Agendando...</>
                  ) : (
                    <>
                      <CalendarPlus className="h-4 w-4 mr-2" />
                      Confirmar agendamento às {selectedSlot}
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Waitlist;
