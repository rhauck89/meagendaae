import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Calendar, Clock, MapPin, Star, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp } from '@/lib/whatsapp';
import { SEOHead } from '@/components/SEOHead';

type Event = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  start_date: string;
  end_date: string;
  status: string;
};

type Slot = {
  id: string;
  professional_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
  professional_name?: string;
  professional_avatar?: string;
};

type Service = {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  override_price?: number;
};

const EventPublic = () => {
  const { eventId, eventSlug } = useParams();
  const [event, setEvent] = useState<Event | null>(null);
  const [company, setCompany] = useState<any>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Booking state
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [showBookingDialog, setShowBookingDialog] = useState(false);
  const [clientName, setClientName] = useState('');
  const [clientWhatsapp, setClientWhatsapp] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [booking, setBooking] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // Waitlist
  const [showWaitlistDialog, setShowWaitlistDialog] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<Slot | null>(null);

  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (eventId || eventSlug) loadEvent();
  }, [eventId, eventSlug]);

  const loadEvent = async () => {
    setLoading(true);
    // Find event by slug
    const { data: eventsArr } = await supabase
      .from('events')
      .select('*')
      .eq('slug', eventSlug!)
      .eq('status', 'published')
      .limit(1);
    const eventData = eventsArr?.[0] || null;

    if (!eventData) { setNotFound(true); setLoading(false); return; }
    setEvent(eventData as Event);

    // Load company
    const { data: companyData } = await supabase
      .from('public_company')
      .select('*')
      .eq('id', eventData.company_id)
      .maybeSingle();
    setCompany(companyData);

    // Load slots with professional info
    const { data: slotsData } = await supabase
      .from('event_slots')
      .select('*')
      .eq('event_id', eventData.id)
      .order('slot_date')
      .order('start_time');

    // Get professional names
    const profIds = [...new Set((slotsData || []).map((s: any) => s.professional_id))];
    const { data: profsData } = await supabase
      .from('public_professionals')
      .select('id, name, avatar_url')
      .in('id', profIds);

    const profMap = new Map((profsData || []).map((p: any) => [p.id, p]));
    const enrichedSlots = (slotsData || []).map((s: any) => {
      const prof = profMap.get(s.professional_id);
      return { ...s, professional_name: prof?.name, professional_avatar: prof?.avatar_url };
    });
    setSlots(enrichedSlots);

    // Load services with event price overrides
    const { data: svcData } = await supabase
      .from('public_services')
      .select('*')
      .eq('company_id', eventData.company_id);

    const { data: priceData } = await supabase
      .from('event_service_prices')
      .select('*')
      .eq('event_id', eventData.id);

    const priceMap = new Map((priceData || []).map((p: any) => [p.service_id, p.override_price]));
    const enrichedSvc = (svcData || []).map((s: any) => ({
      ...s,
      override_price: priceMap.get(s.id),
    }));
    setServices(enrichedSvc);

    // Set default selected date
    if (enrichedSlots.length > 0) {
      setSelectedDate(enrichedSlots[0].slot_date);
    }

    setLoading(false);
  };

  const uniqueDates = [...new Set(slots.map(s => s.slot_date))];
  const filteredSlots = selectedDate ? slots.filter(s => s.slot_date === selectedDate) : slots;

  const handleBookSlot = (slot: Slot) => {
    if (slot.current_bookings >= slot.max_bookings) {
      setWaitlistSlot(slot);
      setShowWaitlistDialog(true);
      return;
    }
    setSelectedSlot(slot);
    setSelectedServices([]);
    setBookingSuccess(false);
    setShowBookingDialog(true);
  };

  const toggleService = (svcId: string) => {
    setSelectedServices(prev => prev.includes(svcId) ? prev.filter(id => id !== svcId) : [...prev, svcId]);
  };

  const totalPrice = selectedServices.reduce((sum, svcId) => {
    const svc = services.find(s => s.id === svcId);
    if (!svc) return sum;
    return sum + (svc.override_price ?? svc.price);
  }, 0);

  const handleConfirmBooking = async () => {
    if (!selectedSlot || !clientName || !clientWhatsapp || selectedServices.length === 0) {
      toast.error('Preencha todos os campos e selecione ao menos um serviço');
      return;
    }
    setBooking(true);
    try {
      const { data, error } = await supabase.rpc('book_event_slot' as any, {
        p_slot_id: selectedSlot.id,
        p_client_name: clientName.trim(),
        p_client_whatsapp: formatWhatsApp(clientWhatsapp.trim()),
        p_client_email: clientEmail.trim(),
        p_service_ids: selectedServices,
        p_notes: `Evento: ${event?.name}`,
      });
      if (error) throw error;
      setBookingSuccess(true);
      toast.success('Agendamento confirmado! 🎉');
      // Refresh slots
      loadEvent();
    } catch (err: any) {
      if (err.message?.includes('Slot is full')) {
        toast.error('Este horário acabou de ser preenchido. Tente outro ou entre na lista de espera.');
      } else if (err.message?.includes('limite de agendamentos')) {
        toast.error('Você já atingiu o limite de agendamentos para este evento.');
      } else {
        toast.error(err.message || 'Erro ao agendar');
      }
    } finally {
      setBooking(false);
    }
  };

  const handleJoinWaitlist = async () => {
    if (!waitlistSlot || !event || !clientName || !clientWhatsapp) {
      toast.error('Preencha nome e WhatsApp');
      return;
    }
    setBooking(true);
    try {
      const { error } = await supabase.rpc('join_public_waitlist', {
        p_company_id: event.company_id,
        p_client_name: clientName.trim(),
        p_client_whatsapp: formatWhatsApp(clientWhatsapp.trim()),
        p_email: clientEmail.trim(),
        p_service_ids: selectedServices.length > 0 ? selectedServices : [services[0]?.id].filter(Boolean),
        p_desired_date: waitlistSlot.slot_date,
        p_professional_id: waitlistSlot.professional_id,
        p_time_from: waitlistSlot.start_time,
        p_time_to: waitlistSlot.end_time,
      });
      if (error) throw error;
      toast.success('Você entrou na lista de espera! Avisaremos se surgir uma vaga.');
      setShowWaitlistDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao entrar na lista de espera');
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Carregando evento...</p></div>;
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center flex-col gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-semibold">Evento não encontrado</h2>
        <p className="text-muted-foreground">Este evento não existe ou não está disponível.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SEOHead
        title={`${event?.name} | ${company?.name}`}
        description={event?.description || `Evento especial na ${company?.name}`}
      />

      {/* Hero Banner */}
      <div className="relative h-56 md:h-72 bg-gradient-to-br from-primary/80 to-primary overflow-hidden">
        {event?.cover_image && <img src={event.cover_image} alt={event.name} className="absolute inset-0 w-full h-full object-cover opacity-60" />}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10 max-w-4xl mx-auto">
          <Badge className="w-fit mb-2 bg-white/20 text-white border-white/30">Agenda Aberta</Badge>
          <h1 className="text-3xl md:text-4xl font-display font-bold text-white">{event?.name}</h1>
          <p className="text-white/80 mt-1 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {event && format(parseISO(event.start_date), "dd 'de' MMMM", { locale: ptBR })}
            {event && event.start_date !== event.end_date && ` a ${format(parseISO(event.end_date), "dd 'de' MMMM", { locale: ptBR })}`}
          </p>
          {company && <p className="text-white/70 text-sm mt-1">{company.name}</p>}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8">
        {/* Description */}
        {event?.description && (
          <Card>
            <CardContent className="p-6">
              <p className="text-foreground whitespace-pre-wrap">{event.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Date tabs */}
        {uniqueDates.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {uniqueDates.map(date => (
              <Button
                key={date}
                variant={selectedDate === date ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedDate(date)}
              >
                {format(parseISO(date), "dd/MM (EEE)", { locale: ptBR })}
              </Button>
            ))}
          </div>
        )}

        {/* Slots */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-display font-semibold">Horários Disponíveis</h2>
            {(() => {
              const totalSlots = slots.reduce((sum, s) => sum + s.max_bookings, 0);
              const totalBooked = slots.reduce((sum, s) => sum + s.current_bookings, 0);
              const remaining = totalSlots - totalBooked;
              if (totalSlots === 0) return null;
              const isLow = remaining > 0 && remaining <= 5;
              return (
                <Badge variant="outline" className={cn(
                  'text-sm font-semibold',
                  remaining === 0 ? 'border-destructive text-destructive' :
                  isLow ? 'border-orange-500 text-orange-600' :
                  'border-primary text-primary'
                )}>
                  {remaining === 0 ? '❌ Esgotado' :
                   isLow ? `🔥 Últimas ${remaining} vagas` :
                   `${remaining} vagas`}
                </Badge>
              );
            })()}
          </div>
          {filteredSlots.length === 0 ? (
            <p className="text-muted-foreground">Nenhum horário disponível para esta data.</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {filteredSlots.map(slot => {
                const isFull = slot.current_bookings >= slot.max_bookings;
                const spotsLeft = slot.max_bookings - slot.current_bookings;
                return (
                  <Card key={slot.id} className={cn('cursor-pointer transition-all hover:shadow-md', isFull && 'opacity-60')}>
                    <CardContent className="p-4 flex items-center justify-between" onClick={() => handleBookSlot(slot)}>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {slot.professional_avatar ? (
                            <img src={slot.professional_avatar} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (
                            <Clock className="h-5 w-5 text-primary" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</p>
                          {slot.professional_name && <p className="text-sm text-muted-foreground">{slot.professional_name}</p>}
                        </div>
                      </div>
                      <div className="text-right">
                        {isFull ? (
                          <Badge variant="outline" className="text-destructive border-destructive/30">Lotado</Badge>
                        ) : (
                          <Badge variant="outline" className="text-primary border-primary/30">
                            {spotsLeft} {spotsLeft === 1 ? 'vaga' : 'vagas'}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Services with event pricing */}
        {services.length > 0 && (
          <div>
            <h2 className="text-xl font-display font-semibold mb-4">Serviços</h2>
            <div className="grid gap-3">
              {services.map(svc => (
                <Card key={svc.id}>
                  <CardContent className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">{svc.duration_minutes} min</p>
                    </div>
                    <div className="text-right">
                      {svc.override_price != null ? (
                        <div>
                          <span className="text-sm line-through text-muted-foreground mr-2">R$ {Number(svc.price).toFixed(2)}</span>
                          <span className="font-bold text-primary">R$ {Number(svc.override_price).toFixed(2)}</span>
                        </div>
                      ) : (
                        <span className="font-semibold">R$ {Number(svc.price).toFixed(2)}</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Booking Dialog */}
      <Dialog open={showBookingDialog} onOpenChange={setShowBookingDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{bookingSuccess ? 'Agendamento Confirmado! 🎉' : 'Agendar Horário'}</DialogTitle>
            <DialogDescription>
              {bookingSuccess
                ? 'Seu horário foi reservado com sucesso.'
                : `${selectedSlot?.start_time.slice(0, 5)} - ${selectedSlot?.end_time.slice(0, 5)} • ${selectedSlot?.professional_name || ''}`}
            </DialogDescription>
          </DialogHeader>

          {bookingSuccess ? (
            <div className="text-center py-6">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <p className="text-muted-foreground">Você receberá uma confirmação em breve.</p>
              <Button className="mt-4" onClick={() => setShowBookingDialog(false)}>Fechar</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Services selection */}
              <div>
                <Label>Selecione os serviços *</Label>
                <div className="space-y-2 mt-2">
                  {services.map(svc => (
                    <div
                      key={svc.id}
                      onClick={() => toggleService(svc.id)}
                      className={cn(
                        'p-3 border rounded-lg cursor-pointer transition-all',
                        selectedServices.includes(svc.id) ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground/30'
                      )}
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{svc.name}</span>
                        <span className="font-semibold text-sm">
                          R$ {(svc.override_price ?? svc.price).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Seu nome *</Label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <Label>WhatsApp *</Label>
                <Input value={clientWhatsapp} onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let masked = digits;
                  if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                  else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                  setClientWhatsapp(masked);
                }} placeholder="(11) 99999-9999" maxLength={15} />
              </div>
              <div>
                <Label>Email (opcional)</Label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="seu@email.com" />
              </div>

              {totalPrice > 0 && (
                <div className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                  <span className="font-medium">Total</span>
                  <span className="text-lg font-bold text-primary">R$ {totalPrice.toFixed(2)}</span>
                </div>
              )}

              <Button className="w-full" onClick={handleConfirmBooking} disabled={booking}>
                {booking ? 'Agendando...' : 'Confirmar Agendamento'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Waitlist Dialog */}
      <Dialog open={showWaitlistDialog} onOpenChange={setShowWaitlistDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Lista de Espera</DialogTitle>
            <DialogDescription>
              Este horário está lotado. Entre na lista de espera e avisaremos se surgir uma vaga.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Seu nome *</Label>
              <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>WhatsApp *</Label>
              <Input value={clientWhatsapp} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let masked = digits;
                if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                setClientWhatsapp(masked);
              }} placeholder="(11) 99999-9999" maxLength={15} />
            </div>
            <div>
              <Label>Email (opcional)</Label>
              <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <Button className="w-full" onClick={handleJoinWaitlist} disabled={booking}>
              {booking ? 'Entrando...' : 'Entrar na Lista de Espera'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventPublic;
