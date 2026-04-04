import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureDiscovery } from '@/hooks/useFeatureDiscovery';
import { FeatureIntroModal } from '@/components/FeatureIntroModal';
import { useOnDataRefresh } from '@/hooks/useRefreshData';
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
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Plus, Pencil, Trash2, Clock, DollarSign, Copy, ExternalLink, Upload, X, ImageIcon, Users, Instagram, Download, Link, Camera, Zap } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { getCompanyBranding } from '@/hooks/useCompanyBranding';
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

const BulkPriceAdjuster = ({ services, onApply }: { services: { id: string; price: number; name: string }[]; onApply: (overrides: Record<string, string>) => void }) => {
  const [mode, setMode] = useState<'percentage' | 'fixed_add' | 'fixed_price'>('percentage');
  const [value, setValue] = useState('');

  const handleApply = () => {
    const v = Number(value);
    if (isNaN(v) || v < 0) { toast.error('Informe um valor válido'); return; }
    const overrides: Record<string, string> = {};
    services.forEach(svc => {
      let newPrice = 0;
      if (mode === 'percentage') newPrice = svc.price * (1 + v / 100);
      else if (mode === 'fixed_add') newPrice = svc.price + v;
      else newPrice = v;
      overrides[svc.id] = newPrice.toFixed(2);
    });
    onApply(overrides);
    toast.success('Preços ajustados!');
  };

  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="font-medium text-sm">Ajuste rápido de preços</span>
        </div>
        <p className="text-xs text-muted-foreground">Aplique um ajuste automático em todos os serviços do evento</p>
        <RadioGroup value={mode} onValueChange={(v: any) => setMode(v)} className="gap-1.5">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="percentage" id="bp-pct" />
            <Label htmlFor="bp-pct" className="text-xs font-normal cursor-pointer">Acréscimo percentual</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="fixed_add" id="bp-fix" />
            <Label htmlFor="bp-fix" className="text-xs font-normal cursor-pointer">Acréscimo valor fixo</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="fixed_price" id="bp-fp" />
            <Label htmlFor="bp-fp" className="text-xs font-normal cursor-pointer">Definir preço fixo</Label>
          </div>
        </RadioGroup>
        <div className="flex gap-2">
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder={mode === 'percentage' ? 'Ex: 20' : 'Ex: 10.00'}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="flex-1"
          />
          <Button size="sm" onClick={handleApply} disabled={!value}>Aplicar em todos</Button>
        </div>
      </CardContent>
    </Card>
  );
};

const generateSlug = (name: string) =>
  name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line + word + ' ';
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line.trim(), x, currentY);
      line = word + ' ';
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line.trim(), x, currentY);
}

const Events = () => {
  const { companyId } = useAuth();
  const { hasSeen, markSeen, loading: discoveryLoading } = useFeatureDiscovery();
  const [showIntro, setShowIntro] = useState(false);
  const [events, setEvents] = useState<Event[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showSlotsDialog, setShowSlotsDialog] = useState(false);
  const [showPricesDialog, setShowPricesDialog] = useState(false);
  const [showStoryDialog, setShowStoryDialog] = useState(false);
  const [showStorySourceDialog, setShowStorySourceDialog] = useState(false);
  const [storyEvent, setStoryEvent] = useState<Event | null>(null);
  const [storyImageUrl, setStoryImageUrl] = useState<string | null>(null);
  const [generatingStory, setGeneratingStory] = useState(false);
  const [companySettings, setCompanySettings] = useState<any>(null);
  const [companyData, setCompanyData] = useState<any>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);

  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formSingleDay, setFormSingleDay] = useState(false);
  const [formCoverImage, setFormCoverImage] = useState('');
  const [formCoverPreview, setFormCoverPreview] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [formStatus, setFormStatus] = useState<'draft' | 'published'>('draft');
  const [formMaxBookingsPerClient, setFormMaxBookingsPerClient] = useState(0);
  const [formImagePositionX, setFormImagePositionX] = useState(50);
  const [formImagePositionY, setFormImagePositionY] = useState(50);
  const [formImageZoom, setFormImageZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [eventSlotStats, setEventSlotStats] = useState<Record<string, { total: number; booked: number }>>({});
  const coverInputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);

  const [slotMode, setSlotMode] = useState<'manual' | 'auto'>('auto');
  const [slotProfessionals, setSlotProfessionals] = useState<string[]>([]);
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

  // Feature discovery intro
  useEffect(() => {
    if (!discoveryLoading && !hasSeen('agenda_aberta')) {
      setShowIntro(true);
    }
  }, [discoveryLoading, hasSeen]);

  useEffect(() => {
    if (companyId) {
      loadEvents();
      loadServices();
      loadProfessionals();
      loadCompanyBranding();
    }
  }, [companyId]);

  // Listen for external refresh events
  const handleEventsRefresh = useCallback(() => {
    if (companyId) loadEvents();
  }, [companyId]);
  useOnDataRefresh('events', handleEventsRefresh);

  const loadCompanyBranding = async () => {
    const [settingsRes, companyRes] = await Promise.all([
      supabase.from('company_settings').select('*').eq('company_id', companyId!).maybeSingle(),
      supabase.from('companies').select('name, slug, logo_url, cover_url, business_type').eq('id', companyId!).maybeSingle(),
    ]);
    if (settingsRes.data) setCompanySettings(settingsRes.data);
    if (companyRes.data) setCompanyData(companyRes.data);
  };

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
      setFormSingleDay(event.start_date === event.end_date);
      setFormCoverImage(event.cover_image || '');
      setFormCoverPreview(event.cover_image || '');
      setFormStatus(event.status as 'draft' | 'published');
      setFormMaxBookingsPerClient(event.max_bookings_per_client || 0);
      setFormImagePositionX((event as any).image_position_x ?? 50);
      setFormImagePositionY((event as any).image_position_y ?? 50);
      setFormImageZoom((event as any).image_zoom ?? 1);
    } else {
      setEditingEvent(null);
      setFormName('');
      setFormDescription('');
      setFormStartDate('');
      setFormEndDate('');
      setFormSingleDay(false);
      setFormCoverImage('');
      setFormCoverPreview('');
      setFormStatus('draft');
      setFormMaxBookingsPerClient(0);
      setFormImagePositionX(50);
      setFormImagePositionY(50);
      setFormImageZoom(1);
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
      let slug = generateSlug(formName);
      
      // Ensure slug is unique for this company
      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('company_id', companyId!)
        .eq('slug', slug)
        .neq('id', editingEvent?.id || '00000000-0000-0000-0000-000000000000');
      if (existing && existing.length > 0) {
        slug = `${slug}-${Date.now().toString(36)}`;
      }
      
      const effectiveEndDate = formSingleDay ? formStartDate : formEndDate;
      const payload = {
        company_id: companyId!,
        name: formName.trim(),
        slug,
        description: formDescription.trim() || null,
        cover_image: formCoverImage.trim() || null,
        start_date: formStartDate,
        end_date: effectiveEndDate,
        status: formStatus,
        max_bookings_per_client: formMaxBookingsPerClient,
        image_position_x: formImagePositionX,
        image_position_y: formImagePositionY,
        image_zoom: formImageZoom,
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
    if (professionals.length > 0) setSlotProfessionals([professionals[0].profile_id]);
    setShowSlotsDialog(true);
  };

  const handleGenerateSlots = async () => {
    if (!selectedEvent || slotProfessionals.length === 0) {
      toast.error('Selecione ao menos um profissional');
      return;
    }
    setSaving(true);
    try {
      const days = eachDayOfInterval({
        start: parseISO(selectedEvent.start_date),
        end: parseISO(selectedEvent.end_date),
      });

      const totalSlotMinutes = slotServiceDuration + slotBreakMinutes;

      const slots: any[] = [];
      for (const profId of slotProfessionals) {
        for (const day of days) {
          const dateStr = format(day, 'yyyy-MM-dd');
          let current = slotStartTime;
          while (current < slotEndTime) {
            const [h, m] = current.split(':').map(Number);
            const startMin = h * 60 + m;
            const serviceEndMin = startMin + slotServiceDuration;
            const serviceEndH = Math.floor(serviceEndMin / 60).toString().padStart(2, '0');
            const serviceEndM = (serviceEndMin % 60).toString().padStart(2, '0');
            const slotEnd = `${serviceEndH}:${serviceEndM}`;

            if (slotEnd > slotEndTime) break;

            slots.push({
              event_id: selectedEvent.id,
              professional_id: profId,
              slot_date: dateStr,
              start_time: current,
              end_time: slotEnd,
              max_bookings: slotMaxBookings,
            });

            const nextMin = startMin + totalSlotMinutes;
            const nextH = Math.floor(nextMin / 60).toString().padStart(2, '0');
            const nextM = (nextMin % 60).toString().padStart(2, '0');
            current = `${nextH}:${nextM}`;
          }
        }
      }

      const { error } = await supabase.from('event_slots').insert(slots);
      if (error) throw error;
      toast.success(`${slots.length} slots criados para ${slotProfessionals.length} profissional(is)!`);
      await loadEventSlots(selectedEvent.id);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao gerar slots');
    } finally {
      setSaving(false);
    }
  };

  const handleAddManualSlot = async () => {
    if (!selectedEvent || slotProfessionals.length === 0 || !manualDate || !manualStart || !manualEnd) {
      toast.error('Preencha todos os campos'); return;
    }
    const slots = slotProfessionals.map(profId => ({
      event_id: selectedEvent.id,
      professional_id: profId,
      slot_date: manualDate,
      start_time: manualStart,
      end_time: manualEnd,
      max_bookings: slotMaxBookings,
    }));
    const { error } = await supabase.from('event_slots').insert(slots);
    if (error) { toast.error('Erro ao adicionar slot'); return; }
    toast.success(`Slot adicionado para ${slotProfessionals.length} profissional(is)!`);
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

  const getPublicUrl = (event: Event) => {
    const routeType = (companyData as any)?.business_type === 'esthetic' ? 'estetica' : 'barbearia';
    const slug = (companyData as any)?.slug;
    return slug ? `${window.location.origin}/${routeType}/${slug}/evento/${event.slug}` : `${window.location.origin}/evento/${event.slug}`;
  };

  const openStorySourceDialog = (event: Event) => {
    setStoryEvent(event);
    setStoryImageUrl(null);
    setShowStorySourceDialog(true);
  };

  const handleStorySourceCover = () => {
    setShowStorySourceDialog(false);
    if (storyEvent) generateStoryImage(storyEvent, storyEvent.cover_image || null);
  };

  const handleStorySourceCamera = () => {
    setShowStorySourceDialog(false);
    cameraInputRef.current?.click();
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storyEvent) return;
    const reader = new FileReader();
    reader.onload = () => {
      generateStoryImage(storyEvent, reader.result as string);
    };
    reader.readAsDataURL(file);
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  const generateStoryImage = async (event: Event, backgroundImage: string | null) => {
    setStoryImageUrl(null);
    setGeneratingStory(true);
    setShowStoryDialog(true);

    try {
      const branding = getCompanyBranding(companySettings, true);
      const primaryColor = branding.primaryColor;
      const secondaryColor = branding.secondaryColor;
      const bgColor = branding.backgroundColor;

      const canvas = document.createElement('canvas');
      canvas.width = 1080;
      canvas.height = 1920;
      const ctx = canvas.getContext('2d')!;

      // Background: use secondary/bg color as base
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, 1080, 1920);

      // Draw background image (cover or camera photo) full-bleed
      if (backgroundImage) {
        try {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            img.onload = () => resolve();
            img.onerror = () => reject();
            img.src = backgroundImage;
          });
          // Draw full cover
          const scale = Math.max(1080 / img.width, 1920 / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (1080 - w) / 2, (1920 - h) / 2, w, h);
        } catch {
          // Image failed, keep solid bg
        }
      }

      // Stronger gradient overlay bottom-to-top for text readability
      const gradOverlay = ctx.createLinearGradient(0, 1920, 0, 400);
      gradOverlay.addColorStop(0, 'rgba(0,0,0,0.92)');
      gradOverlay.addColorStop(0.4, 'rgba(0,0,0,0.7)');
      gradOverlay.addColorStop(0.7, 'rgba(0,0,0,0.3)');
      gradOverlay.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradOverlay;
      ctx.fillRect(0, 0, 1080, 1920);

      // Top gradient for header
      const gradTop = ctx.createLinearGradient(0, 0, 0, 500);
      gradTop.addColorStop(0, 'rgba(0,0,0,0.75)');
      gradTop.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradTop;
      ctx.fillRect(0, 0, 1080, 500);

      // === TOP SECTION ===
      // Header: "🔥 AGENDA ABERTA"
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
      ctx.fillText('🔥 AGENDA ABERTA', 540, 140);

      // Event name
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 64px system-ui, -apple-system, sans-serif';
      wrapText(ctx, event.name.toUpperCase(), 540, 280, 900, 76);

      // Date (secondary text)
      const dateText = event.start_date === event.end_date
        ? format(parseISO(event.start_date), "dd 'de' MMMM", { locale: ptBR })
        : `${format(parseISO(event.start_date), "dd/MM", { locale: ptBR })} a ${format(parseISO(event.end_date), "dd/MM/yyyy", { locale: ptBR })}`;

      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '44px system-ui, -apple-system, sans-serif';
      ctx.fillText(`📅 ${dateText}`, 540, 480);

      // === BOTTOM SECTION ===
      // Profile display: find professional or use company
      const eventSlotsList = eventSlots.length > 0 ? eventSlots : [];
      let profileName = companyData?.name || '';
      let profileImageUrl: string | null = companyData?.logo_url || null;

      if (eventSlotsList.length > 0) {
        const profId = eventSlotsList[0].professional_id;
        const prof = professionals.find(p => p.profile_id === profId);
        if (prof?.profiles) {
          profileName = prof.profiles.full_name || profileName;
          profileImageUrl = prof.profiles.avatar_url || profileImageUrl;
        }
      } else {
        const { data: slots } = await supabase.from('event_slots').select('professional_id').eq('event_id', event.id).limit(1);
        if (slots && slots.length > 0) {
          const prof = professionals.find(p => p.profile_id === slots[0].professional_id);
          if (prof?.profiles) {
            profileName = prof.profiles.full_name || profileName;
            profileImageUrl = prof.profiles.avatar_url || profileImageUrl;
          }
        }
      }

      // Profile photo circle at bottom
      const profileY = 1280;
      if (profileImageUrl) {
        try {
          const profImg = new Image();
          profImg.crossOrigin = 'anonymous';
          await new Promise<void>((resolve, reject) => {
            profImg.onload = () => resolve();
            profImg.onerror = () => reject();
            profImg.src = profileImageUrl!;
          });
          ctx.save();
          ctx.beginPath();
          ctx.arc(540, profileY, 70, 0, Math.PI * 2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(profImg, 470, profileY - 70, 140, 140);
          ctx.restore();

          // Subtle white border
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(540, profileY, 72, 0, Math.PI * 2);
          ctx.stroke();
        } catch {
          // skip profile image
        }
      }

      // Profile name
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = '36px system-ui, -apple-system, sans-serif';
      ctx.fillText(profileName, 540, profileY + 110);

      // Slot counter
      const stats = eventSlotStats[event.id];
      if (stats && stats.total > 0) {
        const remaining = stats.total - stats.booked;
        const slotText = remaining <= 0
          ? '🔥 ESGOTADO'
          : remaining <= 5
          ? `🔥 ÚLTIMAS ${remaining} VAGAS`
          : `${remaining} vagas disponíveis`;

        ctx.fillStyle = '#FFFFFF';
        ctx.font = remaining <= 5 && remaining > 0 ? 'bold 42px system-ui, -apple-system, sans-serif' : '40px system-ui, -apple-system, sans-serif';
        ctx.fillText(slotText, 540, profileY + 180);
      }

      // CTA button with company primary color
      const ctaY = 1660;
      const ctaW = 600;
      const ctaH = 100;
      const ctaX = (1080 - ctaW) / 2;

      ctx.fillStyle = primaryColor;
      roundRect(ctx, ctaX, ctaY, ctaW, ctaH, 50);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 40px system-ui, -apple-system, sans-serif';
      ctx.fillText('AGENDE AGORA', 540, ctaY + 62);

      const dataUrl = canvas.toDataURL('image/png');
      setStoryImageUrl(dataUrl);
    } catch (err) {
      console.error('Error generating story image:', err);
      toast.error('Erro ao gerar imagem');
    } finally {
      setGeneratingStory(false);
    }
  };

  const handleDownloadStory = () => {
    if (!storyImageUrl || !storyEvent) return;
    const link = document.createElement('a');
    link.download = `story-${storyEvent.slug}.png`;
    link.href = storyImageUrl;
    link.click();
    toast.success('Imagem baixada!');
  };

  const handleCopyBookingLink = () => {
    if (!storyEvent) return;
    navigator.clipboard.writeText(getPublicUrl(storyEvent));
    toast.success('Link copiado!');
  };

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
        <TabsList className="flex flex-wrap h-auto gap-1">
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
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
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
                  <div className="flex flex-col gap-1.5">
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" className="flex-1 gap-1.5" onClick={() => window.open(getPublicUrl(event), '_blank')}>
                        <ExternalLink className="h-3.5 w-3.5" /> Ver página
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(getPublicUrl(event)); toast.success('Link copiado!'); }}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button size="sm" variant="outline" className="w-full gap-1.5" onClick={() => openStorySourceDialog(event)}>
                      <Instagram className="h-3.5 w-3.5" /> Compartilhar nos Stories
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
                  {/* Safe area overlay */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    <div className="w-[16.67%] bg-black/30 border-r border-dashed border-white/40" />
                    <div className="flex-1 relative">
                      <div className="absolute inset-0 border-2 border-dashed border-white/50 rounded-sm m-1" />
                      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] text-white/70 bg-black/40 px-2 py-0.5 rounded whitespace-nowrap">
                        Área segura
                      </span>
                    </div>
                    <div className="w-[16.67%] bg-black/30 border-l border-dashed border-white/40" />
                  </div>
                  <div className="absolute top-2 right-2 flex gap-1.5 z-10">
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
                  className="w-full h-36 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer disabled:opacity-50 relative overflow-hidden"
                >
                  {/* Safe area guide overlay on empty state */}
                  <div className="absolute inset-0 flex pointer-events-none">
                    <div className="w-[16.67%] bg-muted-foreground/5 border-r border-dashed border-muted-foreground/20" />
                    <div className="flex-1" />
                    <div className="w-[16.67%] bg-muted-foreground/5 border-l border-dashed border-muted-foreground/20" />
                  </div>
                  {uploadingCover ? (
                    <p className="text-sm relative z-10">Enviando...</p>
                  ) : (
                    <div className="relative z-10 flex flex-col items-center gap-2">
                      <ImageIcon className="h-8 w-8" />
                      <p className="text-sm font-medium">Clique para enviar imagem</p>
                      <p className="text-xs">JPG ou PNG, máx 5MB</p>
                    </div>
                  )}
                </button>
              )}
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Elementos importantes devem ficar na área central
              </p>
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
            <div className="space-y-2">
              <Label>Profissionais do evento</Label>
              <div className="flex items-center gap-2 pb-1">
                <Checkbox
                  checked={slotProfessionals.length === professionals.length && professionals.length > 0}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setSlotProfessionals(professionals.map(p => p.profile_id));
                    } else {
                      setSlotProfessionals([]);
                    }
                  }}
                />
                <span className="text-sm font-medium">Selecionar todos</span>
                {slotProfessionals.length > 0 && (
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground ml-auto"
                    onClick={() => setSlotProfessionals([])}
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <div className="space-y-1.5 pl-1 max-h-40 overflow-y-auto border rounded-md p-2">
                {professionals.map(p => (
                  <div key={p.profile_id} className="flex items-center gap-2">
                    <Checkbox
                      checked={slotProfessionals.includes(p.profile_id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSlotProfessionals(prev => [...prev, p.profile_id]);
                        } else {
                          setSlotProfessionals(prev => prev.filter(id => id !== p.profile_id));
                        }
                      }}
                    />
                    <span className="text-sm">{p.profiles?.full_name}</span>
                  </div>
                ))}
              </div>
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
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
          <div className="space-y-4">
            {/* Bulk Price Adjustment */}
            <BulkPriceAdjuster services={services} onApply={(overrides) => setPriceOverrides(prev => ({ ...prev, ...overrides }))} />

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

      {/* Story Share Dialog */}
      <Dialog open={showStoryDialog} onOpenChange={setShowStoryDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" /> Compartilhar nos Stories
            </DialogTitle>
            <DialogDescription>
              Imagem otimizada para Instagram Stories (1080×1920)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {generatingStory ? (
              <div className="h-64 flex items-center justify-center bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground animate-pulse">Gerando imagem...</p>
              </div>
            ) : storyImageUrl ? (
              <div className="rounded-lg overflow-hidden border bg-muted">
                <img
                  src={storyImageUrl}
                  alt="Story preview"
                  className="w-full h-auto"
                />
              </div>
            ) : null}

            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2"
                onClick={handleDownloadStory}
                disabled={!storyImageUrl}
              >
                <Download className="h-4 w-4" /> Baixar Imagem
              </Button>
              <Button
                variant="outline"
                className="gap-2"
                onClick={handleCopyBookingLink}
              >
                <Link className="h-4 w-4" /> Copiar Link
              </Button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Baixe a imagem e compartilhe diretamente no Instagram Stories. Cole o link no sticker de link.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Story Source Selection Dialog */}
      <Dialog open={showStorySourceDialog} onOpenChange={setShowStorySourceDialog}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Instagram className="h-5 w-5" /> Imagem do Story
            </DialogTitle>
            <DialogDescription>
              Escolha a imagem de fundo para o Story
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Button className="w-full gap-2" variant="outline" onClick={handleStorySourceCover}>
              <ImageIcon className="h-4 w-4" /> Usar capa do evento
            </Button>
            <Button className="w-full gap-2" variant="outline" onClick={handleStorySourceCamera}>
              <Camera className="h-4 w-4" /> Tirar uma foto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Hidden camera input */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCameraCapture}
      />
      <FeatureIntroModal
        featureKey="agenda_aberta"
        open={showIntro}
        onClose={() => { setShowIntro(false); markSeen('agenda_aberta'); }}
        onAction={() => setShowCreateDialog(true)}
      />
    </div>
  );
};

export default Events;
