import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Pencil, Trash2, Clock, DollarSign, Copy, ExternalLink, Upload, X, ImageIcon, Users } from 'lucide-react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Event = {
  id: string;
  company_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_image: string | null;
  start_date: string;
  end_date: string;
  status: 'draft' | 'published' | 'cancelled' | 'completed';
  created_at: string;
  max_bookings_per_client: number;
};

type EventSlot = {
  id: string;
  event_id: string;
  professional_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  max_bookings: number;
  current_bookings: number;
};

type EventServicePrice = {
  id: string;
  event_id: string;
  service_id: string;
  override_price: number;
};

type StatusFilter = 'all' | 'draft' | 'published' | 'cancelled' | 'completed';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  published: 'bg-primary/10 text-primary',
  cancelled: 'bg-destructive/10 text-destructive',
  completed: 'bg-success/10 text-success',
};

const statusLabels: Record<string, string> = {
  draft: 'Rascunho',
  published: 'Publicado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
};

const generateSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const Events = () => {
  const { companyId } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSlotsDialog, setShowSlotsDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formCoverPreview, setFormCoverPreview] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [formMaxBookingsPerClient, setFormMaxBookingsPerClient] = useState(0);
  const [saving, setSaving] = useState(false);
  const [eventSlotStats, setEventSlotStats] = useState<Record<string, { total: number; booked: number }>>({});
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [slotMode, setSlotMode] = useState<'manual' | 'auto'>('auto');
  const [slotProfessional, setSlotProfessional] = useState('');
  const [slotStartTime, setSlotStartTime] = useState('09:00');
  const [slotEndTime, setSlotEndTime] = useState('18:00');
  const [slotServiceDuration, setSlotServiceDuration] = useState(30);
  const [slotBreakMinutes, setSlotBreakMinutes] = useState(0);
  const [slotMaxBookings, setSlotMaxBookings] = useState(1);
  const [eventSlots, setEventSlots] = useState<EventSlot[]>([]);

  const [manualDate, setManualDate] = useState('');
  const [manualStart, setManualStart] = useState('');
  const [manualEnd, setManualEnd] = useState('');

  const [eventPrices, setEventPrices] = useState<EventServicePrice[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    if (companyId) {
      loadEvents();
      loadServices();
      loadProfessionals();
    }
  }, [companyId]);

  const loadEvents = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('company_id', companyId!)
      .order('start_date', { ascending: false });
    const eventsList = (data as any[]) || [];
    setEvents(eventsList);

    // Load slot stats for all events
    if (eventsList.length > 0) {
      const eventIds = eventsList.map(e => e.id);
      const { data: slotsData } = await supabase
        .from('event_slots')
        .select('event_id, max_bookings, current_bookings')
        .in('event_id', eventIds);
      
      const stats: Record<string, { total: number; booked: number }> = {};
      (slotsData || []).forEach((s: any) => {
        if (!stats[s.event_id]) stats[s.event_id] = { total: 0, booked: 0 };
        stats[s.event_id].total += s.max_bookings;
        stats[s.event_id].booked += s.current_bookings;
      });
      setEventSlotStats(stats);
    }

    setLoading(false);
  };

  const loadServices = async () => {
    const { data } = await supabase.from('services').select('*').eq('company_id', companyId!).eq('active', true);
    setServices(data || []);
  };

  const loadProfessionals = async () => {
    const { data } = await supabase.from('collaborators').select('*, profiles(id, full_name, avatar_url)').eq('company_id', companyId!).eq('active', true);
    setProfessionals(data || []);
  };

  const loadEventSlots = async (eventId: string) => {
    const { data } = await supabase.from('event_slots').select('*').eq('event_id', eventId).order('slot_date').order('start_time');
    setEventSlots((data as any[]) || []);
  };

  const loadEventPrices = async (eventId: string) => {
    const { data } = await supabase.from('event_service_prices').select('*').eq('event_id', eventId);
    setEventPrices((data as any[]) || []);
    const overrides: Record<string, string> = {};
    (data || []).forEach((p: any) => { overrides[p.service_id] = String(p.override_price); });
    setPriceOverrides(overrides);
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Formato não permitido. Use JPG ou PNG.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 5MB.');
      return;
    }

    setUploadingCover(true);
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${companyId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('event-covers')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('event-covers')
        .getPublicUrl(filePath);

      setFormCoverImage(urlData.publicUrl);
      setFormCoverPreview(urlData.publicUrl);
      toast.success('Imagem enviada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar imagem');
    } finally {
      setUploadingCover(false);
      if (coverInputRef.current) coverInputRef.current.value = '';
    }
  };

  const handleRemoveCover = () => {
    setFormCoverImage('');
    setFormCoverPreview('');
  };

  const openCreateDialog = (event?: Event) => {
    if (event) {
      setEditingEvent(event);
      setFormName(event.name);
      setFormDescription(event.description || '');
      setFormStartDate(event.start_date);
      setFormEndDate(event.end_date);
      setFormCoverImage(event.cover_image || '');
      setFormCoverPreview(event.cover_image || '');
      setFormStatus(event.status as 'draft' | 'published');
      setFormMaxBookingsPerClient(event.max_bookings_per_client || 0);
    } else {
      setEditingEvent(null);
      setFormName('');
      setFormDescription('');
      setFormStartDate('');
      setFormEndDate('');
      setFormCoverImage('');
      setFormCoverPreview('');
      setFormStatus('draft');
      setFormMaxBookingsPerClient(0);
    }
    setShowCreateDialog(true);
  };

  const handleSaveEvent = async () => {
    if (!formName || !formStartDate || !formEndDate) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    setSaving(true);
    try {
      const slug = generateSlug(formName);
      const payload = {
        company_id: companyId!,
        name: formName.trim(),
        slug,
        description: formDescription.trim() || null,
        cover_image: formCoverImage.trim() || null,
        start_date: formStartDate,
        end_date: formEndDate,
        status: formStatus,
        max_bookings_per_client: formMaxBookingsPerClient,
      };

      if (editingEvent) {
        const { error } = await supabase.from('events').update(payload).eq('id', editingEvent.id);
        if (error) throw error;
        toast.success('Evento atualizado!');
      } else {
        const { error } = await supabase.from('events').insert(payload);
        if (error) throw error;
        toast.success('Evento criado!');
      }
      setShowCreateDialog(false);
      loadEvents();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar evento');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Tem certeza que deseja excluir este evento?')) return;
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success('Evento excluído');
    loadEvents();
  };

  const openSlotsDialog = async (event: Event) => {
    setSelectedEvent(event);
    await loadEventSlots(event.id);
    if (professionals.length > 0) setSlotProfessional(professionals[0].profile_id);
    setShowSlotsDialog(true);
  };

  const handleGenerateSlots = async () => {
    if (!selectedEvent || !slotProfessional) return;
    setSaving(true);
    try {
      const days = eachDayOfInterval({
        start: parseISO(selectedEvent.start_date),
        end: parseISO(selectedEvent.end_date),
      });

      const totalSlotMinutes = slotServiceDuration + slotBreakMinutes;

      const slots: any[] = [];
      for (const day of days) {
        const dateStr = format(day, 'yyyy-MM-dd');
        let current = slotStartTime;
        while (current < slotEndTime) {
          const [h, m] = current.split(':').map(Number);
          const startMin = h * 60 + m;
          // End time is based on service duration only (break is between appointments)
          const serviceEndMin = startMin + slotServiceDuration;
          const serviceEndH = Math.floor(serviceEndMin / 60).toString().padStart(2, '0');
          const serviceEndM = (serviceEndMin % 60).toString().padStart(2, '0');
          const slotEnd = `${serviceEndH}:${serviceEndM}`;

          if (slotEnd > slotEndTime) break;

          slots.push({
            event_id: selectedEvent.id,
            professional_id: slotProfessional,
            slot_date: dateStr,
            start_time: current,
            end_time: slotEnd,
            max_bookings: slotMaxBookings,
          });

          // Next slot starts after service duration + break
          const nextMin = startMin + totalSlotMinutes;
          const nextH = Math.floor(nextMin / 60).toString().padStart(2, '0');
          const nextM = (nextMin % 60).toString().padStart(2, '0');
          current = `${nextH}:${nextM}`;
        }
      }

      const { error } = await supabase.from('event_slots').insert(slots);
      if (error) throw error;
      toast.success(`${slots.length} slots criados!`);
      await loadEventSlots(selectedEvent.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar slots');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualSlot = async () => {
    if (!selectedEvent || !slotProfessional || !manualDate || !manualStart || !manualEnd) {
      toast.error('Preencha todos os campos'); return;
    }
    const { error } = await supabase.from('event_slots').insert({
      event_id: selectedEvent.id,
      professional_id: slotProfessional,
      slot_date: manualDate,
      start_time: manualStart,
      end_time: manualEnd,
      max_bookings: slotMaxBookings,
    });
    if (error) { toast.error('Erro ao adicionar slot'); return; }
    toast.success('Slot adicionado!');
    await loadEventSlots(selectedEvent.id);
  };

  const handleDeleteSlot = async (slotId: string) => {
    await supabase.from('event_slots').delete().eq('id', slotId);
    if (selectedEvent) await loadEventSlots(selectedEvent.id);
  };

  const openPricesDialog = async (event: Event) => {
    setSelectedEvent(event);
    await loadEventPrices(event.id);
    setShowPricesDialog(true);
  };

  const handleSavePrices = async () => {
    if (!selectedEvent) return;
    setSaving(true);
    try {
      await supabase.from('event_service_prices').delete().eq('event_id', selectedEvent.id);

      const inserts = Object.entries(priceOverrides)
        .filter(([, price]) => price && Number(price) > 0)
        .map(([serviceId, price]) => ({
          event_id: selectedEvent.id,
          service_id: serviceId,
          override_price: Number(price),
        }));

      if (inserts.length > 0) {
        const { error } = await supabase.from('event_service_prices').insert(inserts);
        if (error) throw error;
      }
      toast.success('Preços do evento salvos!');
      setShowPricesDialog(false);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar preços');
    } finally {
      setSaving(false);
    }
  };

  const getPublicUrl = (event: Event) => `${window.location.origin}/event/${event.slug}`;

  const filteredEvents = events.filter(e => statusFilter === 'all' || e.status === statusFilter);

  const statusCounts = {
    all: events.length,
    draft: events.filter(e => e.status === 'draft').length,
    published: events.filter(e => e.status === 'published').length,
    cancelled: events.filter(e => e.status === 'cancelled').length,
    completed: events.filter(e => e.status === 'completed').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Agenda Aberta</h2>
          <p className="text-muted-foreground">Gerencie agendas abertas e suas vagas</p>
        </div>
        <Button onClick={() => openCreateDialog()} className="gap-2">
          <Plus className="h-4 w-4" /> Criar Evento
        </Button>
      </div>

      <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
        <TabsList>
          <TabsTrigger value="all">Todos ({statusCounts.all})</TabsTrigger>
          <TabsTrigger value="draft">Rascunho ({statusCounts.draft})</TabsTrigger>
          <TabsTrigger value="published">Publicados ({statusCounts.published})</TabsTrigger>
          <TabsTrigger value="completed">Concluídos ({statusCounts.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filteredEvents.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum evento encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => openCreateDialog()}>Criar primeiro evento</Button>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map(event => (
            <Card key={event.id} className="overflow-hidden">
              {event.cover_image && (
                <div className="h-32 bg-muted overflow-hidden">
                  <img src={event.cover_image} alt={event.name} className="w-full h-full object-cover" />
                </div>
              )}
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                  <Badge className={cn('text-xs', statusColors[event.status])}>{statusLabels[event.status]}</Badge>
                </div>
                {event.description && <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>}
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {format(parseISO(event.start_date), "dd/MM/yyyy", { locale: ptBR })} - {format(parseISO(event.end_date), "dd/MM/yyyy", { locale: ptBR })}
                </div>

                {/* Slot counter */}
                {(() => {
                  const stats = eventSlotStats[event.id];
                  if (!stats || stats.total === 0) return null;
                  const remaining = stats.total - stats.booked;
                  const isLow = remaining <= 5 && remaining > 0;
                  return (
                    <div className={cn(
                      'flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-lg',
                      remaining === 0 ? 'bg-destructive/10 text-destructive' :
                      isLow ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400' :
                      'bg-primary/10 text-primary'
                    )}>
                      <Users className="h-4 w-4" />
                      {remaining === 0 ? 'Esgotado' :
                       isLow ? `🔥 Últimas ${remaining} vagas` :
                       `${remaining} vagas disponíveis`}
                    </div>
                  );
                })()}

                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openCreateDialog(event)} className="gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openSlotsDialog(event)} className="gap-1.5">
                    <Clock className="h-3.5 w-3.5" /> Horários
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => openPricesDialog(event)} className="gap-1.5">
                    <DollarSign className="h-3.5 w-3.5" /> Preços
                  </Button>
                </div>

                {event.status === 'published' && (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={() => window.open(getPublicUrl(event), '_blank')}>
                      <ExternalLink className="h-3.5 w-3.5" /> Ver página
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(getPublicUrl(event)); toast.success('Link copiado!'); }}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}

                <Button size="sm" variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => handleDeleteEvent(event.id)}>
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Event Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Editar Evento' : 'Novo Evento'}</DialogTitle>
            <DialogDescription>Configure os detalhes do evento especial</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome do evento *</Label>
              <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Dia do Cliente" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="Descreva o evento..." rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data início *</Label>
                <Input type="date" value={formStartDate} onChange={e => setFormStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Data fim *</Label>
                <Input type="date" value={formEndDate} onChange={e => setFormEndDate(e.target.value)} />
              </div>
            </div>

            {/* Cover Image Upload */}
            <div>
              <Label>Imagem de capa</Label>
              <p className="text-xs text-muted-foreground mb-2">Recomendado: 1200×400 px · JPG ou PNG</p>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/jpeg,image/png,image/jpg"
                className="hidden"
                onChange={handleCoverUpload}
              />
              {formCoverPreview ? (
                <div className="relative rounded-lg overflow-hidden border bg-muted">
                  <img src={formCoverPreview} alt="Capa" className="w-full h-36 object-cover" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-8 gap-1.5 bg-background/80 backdrop-blur-sm"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                    >
                      <Upload className="h-3.5 w-3.5" /> Trocar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 gap-1.5"
                      onClick={handleRemoveCover}
                    >
                      <X className="h-3.5 w-3.5" /> Remover
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                >
                  {uploadingCover ? (
                    <p className="text-sm">Enviando...</p>
                  ) : (
                    <>
                      <ImageIcon className="h-8 w-8" />
                      <p className="text-sm font-medium">Clique para enviar imagem</p>
                      <p className="text-xs">JPG ou PNG, máx 5MB</p>
                    </>
                  )}
                </button>
              )}
            </div>

            <div>
              <Label>Máx. agendamentos por cliente</Label>
              <Input
                type="number"
                min={0}
                value={formMaxBookingsPerClient}
                onChange={e => setFormMaxBookingsPerClient(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground mt-1">0 = ilimitado</p>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as 'draft' | 'published')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleSaveEvent} disabled={saving}>
              {saving ? 'Salvando...' : editingEvent ? 'Atualizar Evento' : 'Criar Evento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Slots Dialog */}
      <Dialog open={showSlotsDialog} onOpenChange={setShowSlotsDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Horários - {selectedEvent?.name}</DialogTitle>
            <DialogDescription>Configure os horários disponíveis para o evento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Profissional</Label>
              <Select value={slotProfessional} onValueChange={setSlotProfessional}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {professionals.map(p => (
                    <SelectItem key={p.profile_id} value={p.profile_id}>{p.profiles?.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Máx. agendamentos por slot</Label>
              <Input type="number" min={1} value={slotMaxBookings} onChange={e => setSlotMaxBookings(Number(e.target.value))} />
            </div>

            <Tabs value={slotMode} onValueChange={v => setSlotMode(v as 'manual' | 'auto')}>
              <TabsList className="w-full">
                <TabsTrigger value="auto" className="flex-1">Geração Automática</TabsTrigger>
                <TabsTrigger value="manual" className="flex-1">Manual</TabsTrigger>
              </TabsList>
            </Tabs>

            {slotMode === 'auto' ? (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <p className="text-sm text-muted-foreground">Gerar slots para todos os dias do evento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={slotStartTime} onChange={e => setSlotStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="time" value={slotEndTime} onChange={e => setSlotEndTime(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Duração do serviço (min)</Label>
                    <Input type="number" min={5} step={5} value={slotServiceDuration} onChange={e => setSlotServiceDuration(Number(e.target.value))} />
                  </div>
                  <div>
                    <Label>Intervalo entre atendimentos (min)</Label>
                    <Input type="number" min={0} step={5} value={slotBreakMinutes} onChange={e => setSlotBreakMinutes(Number(e.target.value))} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada slot terá {slotServiceDuration} min de atendimento
                  {slotBreakMinutes > 0 ? ` + ${slotBreakMinutes} min de intervalo` : ''}
                  {' '}= próximo horário a cada {slotServiceDuration + slotBreakMinutes} min
                </p>
                <Button onClick={handleGenerateSlots} disabled={saving} className="w-full">
                  {saving ? 'Gerando...' : 'Gerar Slots'}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label>Data</Label>
                    <Input type="date" value={manualDate} onChange={e => setManualDate(e.target.value)} />
                  </div>
                  <div>
                    <Label>Início</Label>
                    <Input type="time" value={manualStart} onChange={e => setManualStart(e.target.value)} />
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Input type="time" value={manualEnd} onChange={e => setManualEnd(e.target.value)} />
                  </div>
                </div>
                <Button onClick={handleAddManualSlot} disabled={saving} variant="outline" className="w-full">
                  Adicionar Slot
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Slots configurados ({eventSlots.length})</h4>
              {eventSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum slot configurado</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1">
                  {eventSlots.map(slot => (
                    <div key={slot.id} className="flex items-center justify-between p-2 border rounded text-sm bg-background">
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{format(parseISO(slot.slot_date), 'dd/MM')}</span>
                        <span>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                        <Badge variant="outline" className="text-xs">
                          {slot.current_bookings}/{slot.max_bookings}
                        </Badge>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteSlot(slot.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Prices Dialog */}
      <Dialog open={showPricesDialog} onOpenChange={setShowPricesDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Preços do Evento - {selectedEvent?.name}</DialogTitle>
            <DialogDescription>Defina preços especiais para serviços durante o evento. Deixe em branco para manter o preço normal.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {services.map(svc => (
              <div key={svc.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium text-sm">{svc.name}</p>
                  <p className="text-xs text-muted-foreground">Preço normal: R$ {Number(svc.price).toFixed(2)}</p>
                </div>
                <div className="w-28">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="R$ evento"
                    value={priceOverrides[svc.id] || ''}
                    onChange={e => setPriceOverrides(prev => ({ ...prev, [svc.id]: e.target.value }))}
                  />
                </div>
              </div>
            ))}
            <Button className="w-full" onClick={handleSavePrices} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Preços do Evento'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Events;
