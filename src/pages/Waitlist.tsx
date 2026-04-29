import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Clock, CalendarPlus, Users, Loader2, AlertCircle, CheckCircle2, Bell, XCircle } from 'lucide-react';
import { format, parseISO, addMinutes, isBefore, startOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { calculateAvailableSlots } from '@/lib/availability-engine';
import { formatWhatsApp, openWhatsApp, normalizePhone } from '@/lib/whatsapp';
import { sendAppointmentCreatedWebhook } from '@/lib/automations';

type StatusTab = 'active' | 'notified' | 'expired' | 'converted' | 'all';

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  active: { label: 'Ativo', color: 'bg-blue-500/10 text-blue-700 border-blue-200', icon: Clock },
  waiting: { label: 'Ativo', color: 'bg-blue-500/10 text-blue-700 border-blue-200', icon: Clock },
  notified: { label: 'Notificado', color: 'bg-warning/10 text-warning border-warning/30', icon: Bell },
  expired: { label: 'Expirado', color: 'bg-muted text-muted-foreground border-border', icon: AlertCircle },
  converted: { label: 'Convertido', color: 'bg-green-500/10 text-green-700 border-green-200', icon: CheckCircle2 },
  confirmed: { label: 'Convertido', color: 'bg-green-500/10 text-green-700 border-green-200', icon: CheckCircle2 },
  cancelled: { label: 'Cancelado', color: 'bg-destructive/10 text-destructive border-destructive/30', icon: XCircle },
};

const normalizeStatus = (status: string, source: string): string => {
  if (source === 'waitlist') {
    if (status === 'active') return 'active';
    if (status === 'notified') return 'notified';
    if (status === 'expired') return 'expired';
    if (status === 'converted') return 'converted';
    return status;
  }
  // waiting_list source
  if (status === 'waiting') return 'active';
  if (status === 'confirmed') return 'converted';
  return status;
};

const Waitlist = () => {
  const { companyId } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceNamesMap, setServiceNamesMap] = useState<Record<string, string>>({});
  const [serviceDurationsMap, setServiceDurationsMap] = useState<Record<string, number>>({});
  const [activeTab, setActiveTab] = useState<StatusTab>('active');

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
      .order('created_at', { ascending: true });

    const { data: wData } = await supabase
      .from('waitlist')
      .select('*')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: true });

    const fromWl = (wlData || []).map((e: any) => ({
      id: e.id,
      client_name: e.client?.full_name || 'Cliente',
      client_whatsapp: e.client?.whatsapp || null,
      service_ids: e.service_ids,
      professional_id: e.professional_id || null,
      professional_name: e.professional?.full_name || null,
      desired_date: e.desired_date,
      time_from: e.time_from || null,
      time_to: e.time_to || null,
      created_at: e.created_at,
      status: e.status,
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
      time_from: e.time_from || null,
      time_to: e.time_to || null,
      created_at: e.created_at,
      status: e.status || (e.notified ? 'notified' : 'active'),
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

  // Filter entries by tab
  const filteredEntries = entries.filter(entry => {
    const norm = normalizeStatus(entry.status, entry.source);
    if (activeTab === 'all') return true;
    return norm === activeTab;
  });

  // Count per status
  const counts = entries.reduce((acc, entry) => {
    const norm = normalizeStatus(entry.status, entry.source);
    acc[norm] = (acc[norm] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const formatTimeRange = (from: string | null, to: string | null) => {
    if (!from && !to) return null;
    if (from && to) return `${from.substring(0, 5)} - ${to.substring(0, 5)}`;
    if (from) return `a partir de ${from.substring(0, 5)}`;
    return `até ${to!.substring(0, 5)}`;
  };

  const openBookingModal = (entry: any) => {
    setBookingTarget(entry);
    setSelectedProfessional(entry.professional_id || '');
    setSelectedDate(entry.desired_date ? parseISO(entry.desired_date) : undefined);
    setSelectedSlot(null);
    setSlots([]);
    setBookingOpen(true);
  };

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
      const startTime = fromZonedTime(`${dateStr} ${selectedSlot}:00`, 'America/Sao_Paulo');
      const endTime = addMinutes(startTime, totalDuration);

      const normalizedPhone = (bookingTarget.client_whatsapp || '').replace(/\D/g, '');

      // 1. Garantir Client Global
      const { data: globalClient, error: globalError } = await (supabase
        .from('clients_global' as any)
        .upsert({
          whatsapp: normalizedPhone || null,
          name: bookingTarget.client_name,
        }, { onConflict: 'whatsapp' })
        .select()
        .single() as any);

      if (globalError || !globalClient) {
        console.error("ERRO AO GERAR CLIENT GLOBAL:", globalError);
        throw new Error("Erro ao vincular perfil global");
      }

      console.log("GLOBAL CLIENT:", globalClient);

      // 2. Garantir Client Local
      const { data: localClient, error: localError } = await (supabase
        .from('clients' as any)
        .upsert({
          company_id: companyId!,
          global_client_id: (globalClient as any).id,
          user_id: (globalClient as any).user_id,
          name: bookingTarget.client_name,
          whatsapp: bookingTarget.client_whatsapp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'company_id, whatsapp' })
        .select()
        .single() as any);


      if (localError || !localClient) {
        console.error("ERRO AO GERAR CLIENT LOCAL:", localError);
        throw new Error("Erro ao vincular cliente à empresa");
      }

      const { data: appointmentId, error: aptErr } = await (supabase.rpc('create_appointment', {
        p_client_id: localClient.id,
        p_professional_id: selectedProfessional,
        p_start_time: startTime.toISOString(),
        p_end_time: endTime.toISOString(),
        p_total_price: 0,
        p_client_name: bookingTarget.client_name,
        p_client_whatsapp: bookingTarget.client_whatsapp || '',
        p_notes: 'Agendado via lista de espera',
      }) as any);
      if (aptErr) throw aptErr;


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

      // Mark waitlist entry as converted
      if (bookingTarget.source === 'waitlist') {
        await supabase.from('waitlist').update({ status: 'converted' } as any).eq('id', bookingTarget.id);
      } else {
        await supabase.from('waiting_list').update({ status: 'confirmed' as any }).eq('id', bookingTarget.id);
      }

      toast.success('Agendamento criado com sucesso!');

      // Fire Make automation webhook — non-blocking
      try {
        sendAppointmentCreatedWebhook({
          appointment_id: String(appointmentId),
          company_id: companyId,
          client_name: bookingTarget.client_name,
          client_phone: bookingTarget.client_whatsapp || null,
          professional_name: '',
          service_name: '',
          service_price: 0,
          appointment_date: format(selectedDate, 'yyyy-MM-dd'),
          appointment_time: selectedSlot,
          datetime_iso: startTime.toISOString(),
          origin: 'waitlist',
        });
      } catch { /* silent */ }

      if (bookingTarget.client_whatsapp) {
        const msg = encodeURIComponent(
          `\u2705 Seu hor\u00e1rio foi confirmado!\n\n\uD83D\uDCC5 ${format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}\n\u23F0 ${selectedSlot}\n\nObrigado pela paci\u00eancia!`
        );
        openWhatsApp(bookingTarget.client_whatsapp, { source: 'waitlist', message: `✅ Seu horário foi confirmado!\n\n📅 ${format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}\n⏰ ${selectedSlot}\n\nObrigado pela paciência!` });
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

  const getStatusBadge = (status: string, source: string) => {
    const norm = normalizeStatus(status, source);
    const config = statusConfig[norm] || statusConfig.active;
    const Icon = config.icon;
    return (
      <Badge variant="outline" className={`${config.color} text-xs`}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Lista de Espera
        </h1>
        <Badge variant="outline" className="text-sm">
          {counts.active || 0} aguardando
        </Badge>
      </div>

      {/* Status Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTab)}>
        <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5">
          <TabsTrigger value="active">Ativos ({counts.active || 0})</TabsTrigger>
          <TabsTrigger value="notified">Notificados ({counts.notified || 0})</TabsTrigger>
          <TabsTrigger value="converted">Convertidos ({counts.converted || 0})</TabsTrigger>
          <TabsTrigger value="expired">Expirados ({counts.expired || 0})</TabsTrigger>
          <TabsTrigger value="all">Todos ({entries.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum cliente nesta categoria</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry, idx) => {
            const norm = normalizeStatus(entry.status, entry.source);
            const isActionable = norm === 'active' || norm === 'notified';
            const timeRange = formatTimeRange(entry.time_from, entry.time_to);
            const isExpiredDate = isBefore(parseISO(entry.desired_date), startOfDay(new Date()));

            return (
              <Card key={entry.id} className={!isActionable ? 'opacity-60' : ''}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{entry.client_name}</p>
                        {getStatusBadge(entry.status, entry.source)}
                        {isExpiredDate && norm === 'active' && (
                          <Badge variant="destructive" className="text-xs">
                            <AlertCircle className="h-3 w-3 mr-1" />
                            Vencido
                          </Badge>
                        )}
                      </div>
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
                      {timeRange && (
                        <p className="text-xs font-medium text-primary">
                          ⏰ {timeRange}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Entrou {format(parseISO(entry.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                    {isActionable && (
                      <>
                        {entry.client_whatsapp && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              openWhatsApp(entry.client_whatsapp, { source: 'waitlist', message: `Olá ${entry.client_name}! 👋\n\nVimos que você está na nossa lista de espera.\n\nTemos novidades sobre disponibilidade! Gostaria de agendar?\n\nAguardamos seu retorno!` });
                            }}
                          >
                            📲 WhatsApp
                          </Button>
                        )}
                        <Button size="sm" onClick={() => openBookingModal(entry)}>
                          <CalendarPlus className="h-4 w-4 mr-1" />
                          Agendar
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking Modal */}
      <Dialog open={bookingOpen} onOpenChange={(open) => { if (!open) { setBookingOpen(false); setBookingTarget(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Agendar para {bookingTarget?.client_name}</DialogTitle>
            <DialogDescription>
              {bookingTarget && getServiceNames(bookingTarget.service_ids)}
              {bookingTarget?.client_whatsapp && ` \u2022 ${bookingTarget.client_whatsapp}`}
              {bookingTarget?.time_from && bookingTarget?.time_to && (
                <span className="block text-xs mt-1">
                  Preferência de horário: {bookingTarget.time_from.substring(0, 5)} - {bookingTarget.time_to.substring(0, 5)}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                      {slots.map(slot => {
                        const inRange = !bookingTarget?.time_from || !bookingTarget?.time_to ||
                          (slot >= bookingTarget.time_from.substring(0, 5) && slot <= bookingTarget.time_to.substring(0, 5));
                        return (
                          <Button
                            key={slot}
                            variant={selectedSlot === slot ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setSelectedSlot(slot)}
                            className={`text-sm ${inRange ? '' : 'opacity-50'}`}
                          >
                            {slot}
                            {inRange && bookingTarget?.time_from && <span className="ml-1 text-xs">★</span>}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

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
