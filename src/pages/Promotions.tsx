import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, MessageCircle, Send, Users, Tag, Megaphone, Copy, BarChart3, Eye, TrendingUp, MousePointerClick, CalendarCheck, ChevronLeft, ChevronRight, Check, Clock, Flame, Timer } from 'lucide-react';
import { formatWhatsApp, displayWhatsApp } from '@/lib/whatsapp';

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  service_id: string | null;
  service_ids: string[] | null;
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
  client_filter: string;
  client_filter_value: number | null;
  professional_filter: string;
  professional_ids: string[] | null;
  message_template: string | null;
  status: string;
  created_at: string;
  created_by: string | null;
}

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string | null;
  last_visit?: string | null;
  total_spent?: number;
  birth_date?: string | null;
  visit_count?: number;
}

interface PromoMetrics {
  clicks: number;
  bookings: number;
  clientsReached: number;
}

const MESSAGE_TAGS = [
  { tag: '{{cliente_nome}}', label: 'Nome' },
  { tag: '{{cliente_primeiro_nome}}', label: 'Primeiro Nome' },
  { tag: '{{cliente_aniversario}}', label: 'Aniversário' },
  { tag: '{{empresa_nome}}', label: 'Empresa' },
  { tag: '{{profissional_nome}}', label: 'Profissional' },
  { tag: '{{servicos_promocao}}', label: 'Serviços' },
  { tag: '{{profissionais_promocao}}', label: 'Profissionais' },
  { tag: '{{valor_normal}}', label: 'Valor Normal' },
  { tag: '{{valor_promocional}}', label: 'Valor Promo' },
  { tag: '{{link_promocao}}', label: 'Link' },
];

const DEFAULT_TEMPLATE = `Olá {{cliente_nome}}! 👋

Estamos com uma promoção especial na *{{empresa_nome}}*! 🎉

✂️ De R$ {{valor_normal}} por apenas *R$ {{valor_promocional}}*

Garanta seu horário:
{{link_promocao}}

Te esperamos! 🙏`;

function generateSlug(title: string): string {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const WIZARD_STEPS = [
  { num: 1, label: 'Serviço' },
  { num: 2, label: 'Agenda' },
  { num: 3, label: 'Mensagem' },
];

// --- Datetime helpers ---
function normalizeTime(t: string | null, fallback: string): string {
  if (!t) return fallback;
  // Handle "HH:MM:SS" or "HH:MM" — always return "HH:MM:SS"
  const parts = t.split(':');
  const hh = parts[0] || '00';
  const mm = parts[1] || '00';
  const ss = parts[2] || '00';
  return `${hh}:${mm}:${ss}`;
}
function getPromoStart(p: Promotion): Date {
  return new Date(`${p.start_date}T${normalizeTime(p.start_time, '00:00:00')}`);
}
function getPromoEnd(p: Promotion): Date {
  return new Date(`${p.end_date}T${normalizeTime(p.end_time, '23:59:59')}`);
}

function promoVisualStatus(p: Promotion, now: Date): 'scheduled' | 'active' | 'paused' | 'expired' {
  if (p.status === 'paused') return 'paused';
  const start = getPromoStart(p);
  const end = getPromoEnd(p);
  if (now > end) return 'expired';
  if (now < start) return 'scheduled';
  return 'active';
}

function formatCountdown(ms: number): string {
  if (!isFinite(ms) || isNaN(ms) || ms <= 0) return '';
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 24) {
    const d = Math.floor(h / 24);
    return `${d}d ${h % 24}h`;
  }
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

export default function Promotions() {
  const { companyId, profile } = useAuth();
  const { isAdmin } = useUserRole();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [clientsDialogOpen, setClientsDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [highlightedPromoId, setHighlightedPromoId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Wizard step
  const [wizardStep, setWizardStep] = useState(1);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [serviceSelectionMode, setServiceSelectionMode] = useState<'single' | 'multiple' | 'all'>('single');
  const [discountType, setDiscountType] = useState<'fixed_price' | 'percentage' | 'fixed_amount'>('fixed_price');
  const [discountValue, setDiscountValue] = useState('');
  const [promotionPrice, setPromotionPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDay, setSingleDay] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxSlots, setMaxSlots] = useState('10');
  const [clientFilter, setClientFilter] = useState('all');
  const [clientFilterValue, setClientFilterValue] = useState('30');
  const [professionalFilter, setProfessionalFilter] = useState('all');
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);

  // Data
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [metrics, setMetrics] = useState<PromoMetrics>({ clicks: 0, bookings: 0, clientsReached: 0 });
  const [lowOccupancy, setLowOccupancy] = useState(false);

  // Update clock every 60s for countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId]);

  // Clear highlight after a few seconds
  useEffect(() => {
    if (highlightedPromoId) {
      const t = setTimeout(() => setHighlightedPromoId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [highlightedPromoId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchPromotions(), fetchServices(), fetchProfessionals(), fetchCompanyInfo(), checkOccupancy()]);
    setLoading(false);
  };

  const fetchCompanyInfo = async () => {
    const { data } = await supabase.from('companies').select('name, slug').eq('id', companyId!).single();
    if (data) { setCompanyName(data.name); setCompanySlug(data.slug); }
  };

  const fetchPromotions = async () => {
    const { data } = await supabase
      .from('promotions')
      .select('*')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });
    if (data) setPromotions(data as unknown as Promotion[]);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('id, name, price, duration_minutes').eq('company_id', companyId!).eq('active', true).order('name');
    if (data) setServices(data);
  };

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, profiles!collaborators_profile_id_fkey(id, full_name, avatar_url)')
      .eq('company_id', companyId!)
      .eq('active', true);
    if (data) setProfessionals(data);
  };

  const checkOccupancy = async () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = format(tomorrow, 'yyyy-MM-dd');
    const { data: appointments } = await supabase
      .from('appointments')
      .select('id')
      .eq('company_id', companyId!)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`)
      .in('status', ['confirmed', 'pending']);
    setLowOccupancy((appointments?.length || 0) < 3);
  };

  const handleServiceChange = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setServiceSelectionMode('single');
    setSelectedServiceIds([serviceId]);
    const svc = services.find(s => s.id === serviceId);
    if (svc) {
      setPromotionPrice('');
      setDiscountValue('');
    }
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds(prev => 
      prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSelectAllServices = () => {
    setServiceSelectionMode('all');
    setSelectedServiceIds(services.map(s => s.id));
    setSelectedServiceId('');
  };

  const getEffectiveServiceIds = (): string[] => {
    if (serviceSelectionMode === 'all') return services.map(s => s.id);
    if (serviceSelectionMode === 'multiple') return selectedServiceIds;
    return selectedServiceId ? [selectedServiceId] : [];
  };

  const calculatePromoPrice = (originalPrice: number): number => {
    if (discountType === 'fixed_price') {
      return promotionPrice ? parseFloat(promotionPrice) : originalPrice;
    } else if (discountType === 'percentage') {
      const pct = parseFloat(discountValue) || 0;
      return originalPrice * (1 - pct / 100);
    } else { // fixed_amount
      const amt = parseFloat(discountValue) || 0;
      return Math.max(0, originalPrice - amt);
    }
  };

  // --- Wizard validation ---
  const validateStep1 = (): string | null => {
    if (!title.trim()) return 'Preencha o título da promoção';
    const effectiveIds = getEffectiveServiceIds();
    if (effectiveIds.length === 0) return 'Selecione ao menos um serviço';
    
    if (discountType === 'fixed_price') {
      if (!promotionPrice) return 'Informe o preço promocional';
      const promo = parseFloat(promotionPrice);
      if (promo <= 0) return 'O preço promocional deve ser maior que zero';
      // For single service, validate against original
      if (effectiveIds.length === 1) {
        const svc = services.find(s => s.id === effectiveIds[0]);
        if (svc && promo >= Number(svc.price)) return 'O preço promocional deve ser menor que o preço original';
      }
    } else {
      if (!discountValue) return 'Informe o valor do desconto';
      const val = parseFloat(discountValue);
      if (val <= 0) return 'O valor do desconto deve ser maior que zero';
      if (discountType === 'percentage' && val >= 100) return 'O desconto percentual deve ser menor que 100%';
    }
    return null;
  };

  const validateStep2 = (): string | null => {
    if (!startDate) return 'Informe a data de início';
    if (!singleDay && !endDate) return 'Informe a data de término';
    if (!singleDay && endDate < startDate) return 'A data de término deve ser posterior à data de início';
    if (startTime && endTime && endTime <= startTime && (singleDay || startDate === endDate)) return 'O horário final deve ser posterior ao horário inicial';
    return null;
  };

  const goNext = () => {
    if (wizardStep === 1) {
      const err = validateStep1();
      if (err) { toast({ title: err, variant: 'destructive' }); return; }
    } else if (wizardStep === 2) {
      const err = validateStep2();
      if (err) { toast({ title: err, variant: 'destructive' }); return; }
    }
    setWizardStep(prev => Math.min(prev + 1, 3));
  };

  const goBack = () => setWizardStep(prev => Math.max(prev - 1, 1));

  const fetchFilteredClients = async (promotion: Promotion) => {
    setClientsLoading(true);
    setSelectedPromotion(promotion);

    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, whatsapp, birth_date, created_at')
      .eq('company_id', companyId!);

    if (!clients) { setClientsLoading(false); return; }

    const { data: appointments } = await supabase
      .from('appointments')
      .select('client_id, total_price, start_time, status')
      .eq('company_id', companyId!)
      .in('status', ['completed', 'confirmed']);

    const clientStats = new Map<string, { totalSpent: number; lastVisit: string | null; visitCount: number }>();
    appointments?.forEach(apt => {
      if (!apt.client_id) return;
      const c = clientStats.get(apt.client_id) || { totalSpent: 0, lastVisit: null, visitCount: 0 };
      c.totalSpent += Number(apt.total_price) || 0;
      c.visitCount++;
      if (!c.lastVisit || apt.start_time > c.lastVisit) c.lastVisit = apt.start_time;
      clientStats.set(apt.client_id, c);
    });

    let result: ClientRow[] = clients.map(c => {
      const s = clientStats.get(c.id);
      return { id: c.id, name: c.name, whatsapp: c.whatsapp, birth_date: c.birth_date, last_visit: s?.lastVisit || null, total_spent: s?.totalSpent || 0, visit_count: s?.visitCount || 0 };
    });

    const filter = promotion.client_filter;
    const filterVal = promotion.client_filter_value;

    if (filter === 'birthday_month') {
      const m = new Date().getMonth() + 1;
      result = result.filter(c => c.birth_date && parseInt(c.birth_date.split('-')[1], 10) === m);
    } else if (filter === 'top_spending') {
      result.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
      result = result.slice(0, filterVal || 20);
    } else if (filter === 'inactive') {
      const days = filterVal || 30;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(c => !c.last_visit || new Date(c.last_visit) < cutoff);
    } else if (filter === 'new_clients') {
      const days = filterVal || 30;
      const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(c => {
        const cl = clients.find(cl2 => cl2.id === c.id);
        return cl && new Date(cl.created_at) >= cutoff;
      });
    } else if (filter === 'frequent') {
      result = result.filter(c => (c.visit_count || 0) >= (filterVal || 5));
    }

    setFilteredClients(result);
    setClientsLoading(false);
    setClientsDialogOpen(true);
  };

  const fetchMetrics = async (promo: Promotion) => {
    setSelectedPromotion(promo);
    const [clicksRes, bookingsRes] = await Promise.all([
      supabase.from('promotion_clicks').select('id', { count: 'exact' }).eq('promotion_id', promo.id),
      supabase.from('promotion_bookings').select('id', { count: 'exact' }).eq('promotion_id', promo.id),
    ]);
    setMetrics({
      clicks: clicksRes.count || 0,
      bookings: bookingsRes.count || 0,
      clientsReached: 0,
    });
    setMetricsDialogOpen(true);
  };

  const handleCreate = async () => {
    const err1 = validateStep1();
    const err2 = validateStep2();
    if (err1 || err2) {
      toast({ title: err1 || err2 || 'Verifique os campos', variant: 'destructive' });
      return;
    }

    const slug = generateSlug(title);
    const finalEndDate = singleDay ? startDate : endDate;
    const effectiveIds = getEffectiveServiceIds();
    const primaryServiceId = effectiveIds.length === 1 ? effectiveIds[0] : null;
    const primarySvc = primaryServiceId ? services.find(s => s.id === primaryServiceId) : null;
    
    // Calculate prices for payload
    let payloadOrigPrice: number | null = null;
    let payloadPromoPrice: number | null = null;
    
    if (discountType === 'fixed_price' && primarySvc) {
      payloadOrigPrice = Number(primarySvc.price);
      payloadPromoPrice = parseFloat(promotionPrice) || null;
    } else if (primarySvc) {
      payloadOrigPrice = Number(primarySvc.price);
      payloadPromoPrice = calculatePromoPrice(Number(primarySvc.price));
    }

    const payload: any = {
      company_id: companyId!,
      title,
      slug,
      description: description || null,
      service_id: primaryServiceId,
      service_ids: effectiveIds.length > 1 ? effectiveIds : null,
      discount_type: discountType,
      discount_value: discountType !== 'fixed_price' ? (parseFloat(discountValue) || null) : null,
      promotion_price: payloadPromoPrice,
      original_price: payloadOrigPrice,
      start_date: startDate,
      end_date: finalEndDate,
      start_time: startTime || null,
      end_time: endTime || null,
      max_slots: parseInt(maxSlots) || 0,
      client_filter: clientFilter,
      client_filter_value: ['inactive', 'new_clients', 'top_spending', 'frequent'].includes(clientFilter) ? parseInt(clientFilterValue) || null : null,
      professional_filter: professionalFilter,
      professional_ids: professionalFilter === 'selected' ? selectedProfessionalIds : null,
      message_template: messageTemplate,
      created_by: profile?.id || null,
      status: 'active',
    };

    if (!isAdmin && profile?.id) {
      payload.professional_filter = 'selected';
      payload.professional_ids = [profile.id];
      payload.created_by = profile.id;
    }

    const { data, error } = await supabase.from('promotions').insert(payload).select('id').single();
    if (error) {
      toast({ title: 'Erro ao criar promoção', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Promoção criada com sucesso! 🎉' });
    setDialogOpen(false);
    resetForm();

    // Determine the right tab
    const promoStartDt = new Date(startDate + 'T' + (startTime || '00:00') + ':00');
    const targetTab = promoStartDt > new Date() ? 'scheduled' : 'active';
    setActiveTab(targetTab);

    await fetchPromotions();
    if (data?.id) setHighlightedPromoId(data.id);
  };

  const resetForm = () => {
    setTitle(''); setDescription(''); setSelectedServiceId(''); setSelectedServiceIds([]);
    setServiceSelectionMode('single'); setDiscountType('fixed_price'); setDiscountValue('');
    setPromotionPrice('');
    setStartDate(''); setEndDate(''); setSingleDay(false); setStartTime(''); setEndTime(''); setMaxSlots('10');
    setClientFilter('all'); setClientFilterValue('30'); setProfessionalFilter('all');
    setSelectedProfessionalIds([]); setMessageTemplate(DEFAULT_TEMPLATE);
    setWizardStep(1);
  };

  const toggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'active' ? 'paused' : 'active';
    await supabase.from('promotions').update({ status: newStatus } as any).eq('id', promo.id);
    fetchPromotions();
  };

  const getPromoLink = (promo: Promotion) => {
    return `${window.location.origin}/barbearia/${companySlug}/promo/${promo.slug || promo.id}`;
  };

  const buildWhatsAppLink = (client: ClientRow, promotion: Promotion) => {
    if (!client.whatsapp) return '';
    const number = formatWhatsApp(client.whatsapp);
    const promoLink = getPromoLink(promotion);

    const profName = (() => {
      if (promotion.professional_ids?.length === 1) {
        const p = professionals.find((pr: any) => pr.profile_id === promotion.professional_ids![0]);
        return p?.profiles?.full_name || '';
      }
      return companyName;
    })();

    let msg = promotion.message_template || DEFAULT_TEMPLATE;
    msg = msg.replace(/\{\{cliente_nome\}\}/g, client.name);
    msg = msg.replace(/\{\{cliente_primeiro_nome\}\}/g, client.name.split(' ')[0]);
    msg = msg.replace(/\{\{cliente_aniversario\}\}/g, client.birth_date ? format(parseISO(client.birth_date), 'dd/MM') : '');
    msg = msg.replace(/\{\{empresa_nome\}\}/g, companyName);
    msg = msg.replace(/\{\{profissional_nome\}\}/g, profName);
    msg = msg.replace(/\{\{valor_normal\}\}/g, promotion.original_price ? `R$ ${Number(promotion.original_price).toFixed(2)}` : '');
    msg = msg.replace(/\{\{valor_promocional\}\}/g, promotion.promotion_price ? `R$ ${Number(promotion.promotion_price).toFixed(2)}` : '');
    msg = msg.replace(/\{\{link_promocao\}\}/g, promoLink);

    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  };

  const getFilterLabel = (f: string) => {
    const m: Record<string, string> = { all: 'Todos', birthday_month: 'Aniversariantes', top_spending: 'Maiores gastos', inactive: 'Inativos', new_clients: 'Novos', frequent: 'Frequentes' };
    return m[f] || f;
  };

  // --- Status-based filtering using datetime ---
  const isScheduled = (p: Promotion) => promoVisualStatus(p, now) === 'scheduled';
  const isActivePromo = (p: Promotion) => promoVisualStatus(p, now) === 'active';
  const isExpiredPromo = (p: Promotion) => promoVisualStatus(p, now) === 'expired';

  const filteredPromotions = promotions.filter(p => {
    if (activeTab === 'active') return isActivePromo(p);
    if (activeTab === 'scheduled') return isScheduled(p);
    if (activeTab === 'paused') return p.status === 'paused';
    if (activeTab === 'expired') return isExpiredPromo(p);
    return true;
  });

  // --- Status badge renderer ---
  const renderStatusBadge = (promo: Promotion) => {
    const status = promoVisualStatus(promo, now);
    switch (status) {
      case 'scheduled':
        return (
          <Badge className="bg-blue-600 text-white gap-1">
            <Clock className="h-3 w-3" />
            Começa às {promo.start_time?.slice(0, 5) || '00:00'}
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-emerald-600 text-white gap-1">
            <Flame className="h-3 w-3" />
            Ativa agora
          </Badge>
        );
      case 'paused':
        return <Badge variant="secondary">Pausada</Badge>;
      case 'expired':
        return (
          <Badge variant="outline" className="gap-1 text-muted-foreground">
            ⛔ Encerrada às {promo.end_time?.slice(0, 5) || '23:59'}
          </Badge>
        );
    }
  };

  // --- Countdown for active promos ---
  const renderCountdown = (promo: Promotion) => {
    const status = promoVisualStatus(promo, now);
    if (status !== 'active') return null;
    const end = getPromoEnd(promo);
    if (isNaN(end.getTime())) return null;
    const remaining = end.getTime() - now.getTime();
    if (!isFinite(remaining) || remaining <= 0) return null;
    const text = formatCountdown(remaining);
    if (!text) return null;
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium">
        <Timer className="h-3 w-3" />
        ⏰ Termina em {text}
      </div>
    );
  };

  // --- Wizard step rendering ---
  const renderStep1 = () => {
    const effectiveIds = getEffectiveServiceIds();
    const selectedSvcs = services.filter(s => effectiveIds.includes(s.id));
    
    return (
    <div className="space-y-4">
      <div>
        <Label>Título *</Label>
        <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Corte Promocional" />
      </div>
      <div>
        <Label>Descrição</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da promoção" rows={2} />
      </div>
      
      {/* Service selection mode */}
      <div>
        <Label>Serviços *</Label>
        <Select value={serviceSelectionMode} onValueChange={(v: 'single' | 'multiple' | 'all') => {
          setServiceSelectionMode(v);
          if (v === 'all') handleSelectAllServices();
          else if (v === 'single') { setSelectedServiceIds(selectedServiceId ? [selectedServiceId] : []); }
          else { setSelectedServiceId(''); }
        }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="single">Selecionar um serviço</SelectItem>
            <SelectItem value="multiple">Selecionar vários serviços</SelectItem>
            <SelectItem value="all">Todos os serviços</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Single service selector */}
      {serviceSelectionMode === 'single' && (
        <Select value={selectedServiceId} onValueChange={handleServiceChange}>
          <SelectTrigger><SelectValue placeholder="Selecionar serviço" /></SelectTrigger>
          <SelectContent>
            {services.map(s => (
              <SelectItem key={s.id} value={s.id}>
                {s.name} — R$ {Number(s.price).toFixed(2)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Multiple service selector */}
      {serviceSelectionMode === 'multiple' && (
        <div className="space-y-2 border rounded-lg p-3 max-h-48 overflow-y-auto">
          {services.map(s => (
            <label key={s.id} className="flex items-center justify-between gap-2 cursor-pointer p-2 rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedServiceIds.includes(s.id)}
                  onCheckedChange={() => toggleServiceSelection(s.id)}
                />
                <span className="text-sm">{s.name}</span>
              </div>
              <span className="text-sm text-muted-foreground">R$ {Number(s.price).toFixed(2)}</span>
            </label>
          ))}
        </div>
      )}

      {/* All services indicator */}
      {serviceSelectionMode === 'all' && (
        <div className="rounded-lg bg-primary/5 p-3 text-sm">
          <p className="font-medium text-primary">✅ Todos os {services.length} serviços selecionados</p>
        </div>
      )}

      {/* Discount type */}
      {effectiveIds.length > 0 && (
        <>
          <div>
            <Label>Tipo de desconto *</Label>
            <Select value={discountType} onValueChange={(v: 'fixed_price' | 'percentage' | 'fixed_amount') => {
              setDiscountType(v);
              setPromotionPrice('');
              setDiscountValue('');
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed_price">Preço fixo (R$)</SelectItem>
                <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                <SelectItem value="fixed_amount">Valor fixo de desconto (R$)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fixed price input */}
          {discountType === 'fixed_price' && (
            <div>
              <Label>Preço Promocional *</Label>
              <Input type="number" value={promotionPrice} onChange={e => setPromotionPrice(e.target.value)} placeholder="Ex: 25.00" step="0.01" />
            </div>
          )}

          {/* Percentage input */}
          {discountType === 'percentage' && (
            <div>
              <Label>Desconto (%) *</Label>
              <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="Ex: 20" min="1" max="99" />
            </div>
          )}

          {/* Fixed amount input */}
          {discountType === 'fixed_amount' && (
            <div>
              <Label>Desconto (R$) *</Label>
              <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="Ex: 10.00" step="0.01" />
            </div>
          )}

          {/* Preview of prices */}
          {selectedSvcs.length > 0 && (discountType !== 'fixed_price' ? parseFloat(discountValue) > 0 : parseFloat(promotionPrice) > 0) && (
            <div className="rounded-lg border p-3 space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Prévia dos preços:</p>
              {selectedSvcs.slice(0, 5).map(svc => {
                const orig = Number(svc.price);
                const promo = discountType === 'fixed_price' ? parseFloat(promotionPrice) : calculatePromoPrice(orig);
                const pctOff = orig > 0 ? Math.round(((orig - promo) / orig) * 100) : 0;
                return (
                  <div key={svc.id} className="flex items-center justify-between text-sm">
                    <span>{svc.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="line-through text-muted-foreground">R$ {orig.toFixed(2)}</span>
                      <span className="font-bold text-primary">R$ {promo.toFixed(2)}</span>
                      {pctOff > 0 && <Badge variant="outline" className="text-xs">{pctOff}% OFF</Badge>}
                    </div>
                  </div>
                );
              })}
              {selectedSvcs.length > 5 && <p className="text-xs text-muted-foreground">...e mais {selectedSvcs.length - 5} serviço(s)</p>}
            </div>
          )}
        </>
      )}
    </div>
    );
  };

  const renderStep2 = () => (
    <div className="space-y-4">
      <label className="flex items-center gap-2 cursor-pointer">
        <Checkbox checked={singleDay} onCheckedChange={(v) => setSingleDay(!!v)} />
        <span className="text-sm font-medium">Promoção de um único dia</span>
      </label>

      <div className={singleDay ? '' : 'grid grid-cols-2 gap-4'}>
        <div>
          <Label>{singleDay ? 'Data *' : 'Data Início *'}</Label>
          <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
        </div>
        {!singleDay && (
          <div>
            <Label>Data Fim *</Label>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
          </div>
        )}
      </div>

      {singleDay && startDate && (
        <p className="text-sm text-muted-foreground">
          📅 {format(parseISO(startDate), "dd/MM/yyyy (EEEE)", { locale: ptBR })}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div><Label>Horário Início</Label><Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} /></div>
        <div><Label>Horário Fim</Label><Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} /></div>
      </div>

      {singleDay && startDate && startTime && endTime && (
        <div className="rounded-lg bg-muted p-3 text-sm">
          <p>📅 {format(parseISO(startDate), 'dd/MM/yyyy')}</p>
          <p>🕒 {startTime} – {endTime}</p>
        </div>
      )}

      <div>
        <Label>Vagas máximas</Label>
        <Input type="number" value={maxSlots} onChange={e => setMaxSlots(e.target.value)} min="0" />
        <p className="text-xs text-muted-foreground mt-1">0 = ilimitado</p>
      </div>

      {isAdmin && (
        <div>
          <Label>Profissionais participantes</Label>
          <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os profissionais</SelectItem>
              <SelectItem value="selected">Selecionar</SelectItem>
            </SelectContent>
          </Select>
          {professionalFilter === 'selected' && (
            <div className="space-y-2 pl-2 mt-2">
              {professionals.map((p: any) => (
                <label key={p.profile_id} className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={selectedProfessionalIds.includes(p.profile_id)}
                    onCheckedChange={(ch) => setSelectedProfessionalIds(prev => ch ? [...prev, p.profile_id] : prev.filter(id => id !== p.profile_id))}
                  />
                  <span className="text-sm">{p.profiles?.full_name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div>
        <Label>Filtro de clientes</Label>
        <Select value={clientFilter} onValueChange={setClientFilter}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os clientes</SelectItem>
            <SelectItem value="birthday_month">Aniversariantes do mês</SelectItem>
            <SelectItem value="top_spending">Maiores gastos</SelectItem>
            <SelectItem value="inactive">Inativos</SelectItem>
            <SelectItem value="new_clients">Novos</SelectItem>
            <SelectItem value="frequent">Frequentes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {['inactive', 'new_clients'].includes(clientFilter) && (
        <div><Label>Dias</Label><Input type="number" value={clientFilterValue} onChange={e => setClientFilterValue(e.target.value)} /></div>
      )}
      {clientFilter === 'top_spending' && (
        <div><Label>Quantidade</Label><Input type="number" value={clientFilterValue} onChange={e => setClientFilterValue(e.target.value)} /></div>
      )}
      {clientFilter === 'frequent' && (
        <div><Label>Mínimo de visitas</Label><Input type="number" value={clientFilterValue} onChange={e => setClientFilterValue(e.target.value)} /></div>
      )}

      <div>
        <Label>Mensagem WhatsApp</Label>
        <div className="flex flex-wrap gap-1 mb-2">
          {MESSAGE_TAGS.map(t => (
            <Button key={t.tag} type="button" variant="outline" size="sm" onClick={() => setMessageTemplate(prev => prev + t.tag)} className="text-xs h-7">
              <Tag className="h-3 w-3 mr-1" />{t.label}
            </Button>
          ))}
        </div>
        <Textarea value={messageTemplate} onChange={e => setMessageTemplate(e.target.value)} rows={8} className="font-mono text-sm" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Promoções</h2>
          <p className="text-muted-foreground">Crie campanhas e preencha horários vazios</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Promoção</DialogTitle>
            </DialogHeader>

            {/* Progress indicator */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                {WIZARD_STEPS.map((step) => (
                  <div key={step.num} className={`flex items-center gap-1.5 ${wizardStep >= step.num ? 'text-primary font-medium' : ''}`}>
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border-2 transition-colors ${
                      wizardStep > step.num ? 'bg-primary border-primary text-primary-foreground' :
                      wizardStep === step.num ? 'border-primary text-primary' :
                      'border-muted-foreground/30'
                    }`}>
                      {wizardStep > step.num ? <Check className="h-3 w-3" /> : step.num}
                    </div>
                    <span className="hidden sm:inline">{step.label}</span>
                  </div>
                ))}
              </div>
              <Progress value={(wizardStep / 3) * 100} className="h-1.5" />
            </div>

            {/* Step content */}
            {wizardStep === 1 && renderStep1()}
            {wizardStep === 2 && renderStep2()}
            {wizardStep === 3 && renderStep3()}

            {/* Navigation */}
            <div className="flex justify-between pt-2">
              {wizardStep > 1 ? (
                <Button variant="outline" onClick={goBack}>
                  <ChevronLeft className="h-4 w-4 mr-1" />Voltar
                </Button>
              ) : <div />}

              {wizardStep < 3 ? (
                <Button onClick={goNext}>
                  Próximo<ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleCreate}>
                  <Megaphone className="h-4 w-4 mr-2" />Criar Promoção
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Low occupancy suggestion */}
      {lowOccupancy && (
        <Card className="border-dashed border-primary/40 bg-primary/5">
          <CardContent className="py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Agenda com vagas amanhã!</p>
                <p className="text-xs text-muted-foreground">Crie uma promoção para preencher horários vazios</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => { resetForm(); setDialogOpen(true); }}>
              Criar promoção rápida
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active">Ativas ({promotions.filter(p => isActivePromo(p)).length})</TabsTrigger>
          <TabsTrigger value="scheduled">Programadas ({promotions.filter(p => isScheduled(p)).length})</TabsTrigger>
          <TabsTrigger value="paused">Pausadas ({promotions.filter(p => p.status === 'paused').length})</TabsTrigger>
          <TabsTrigger value="expired">Encerradas ({promotions.filter(p => isExpiredPromo(p)).length})</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {loading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : filteredPromotions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma promoção</h3>
                <p className="text-muted-foreground">Crie sua primeira promoção para engajar seus clientes.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredPromotions.map(promo => {
                const remaining = promo.max_slots > 0 ? promo.max_slots - promo.used_slots : null;
                const status = promoVisualStatus(promo, now);
                const svc = services.find(s => s.id === promo.service_id);
                const promoServiceIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
                const promoSvcs = services.filter(s => promoServiceIds.includes(s.id));
                const isHighlighted = promo.id === highlightedPromoId;
                const discountLabel = promo.discount_type === 'percentage' && promo.discount_value
                  ? `${promo.discount_value}% OFF`
                  : promo.discount_type === 'fixed_amount' && promo.discount_value
                  ? `R$ ${Number(promo.discount_value).toFixed(2)} OFF`
                  : null;

                return (
                  <Card key={promo.id} className={`transition-all duration-500 ${status === 'expired' || status === 'paused' ? 'opacity-70' : ''} ${isHighlighted ? 'ring-2 ring-primary shadow-lg animate-pulse' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg">{promo.title}</CardTitle>
                        {renderStatusBadge(promo)}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {promo.description && <p className="text-sm text-muted-foreground">{promo.description}</p>}

                      {/* Discount badge */}
                      {discountLabel && (
                        <Badge className="bg-primary/10 text-primary border-primary/20">{discountLabel}</Badge>
                      )}

                      {/* Service + pricing */}
                      {promoSvcs.length === 1 && svc && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">✂️ {svc.name}</span>
                          {promo.original_price && promo.promotion_price && (
                            <>
                              <span className="line-through text-muted-foreground">R$ {Number(promo.original_price).toFixed(2)}</span>
                              <span className="font-bold text-primary">R$ {Number(promo.promotion_price).toFixed(2)}</span>
                            </>
                          )}
                        </div>
                      )}
                      {promoSvcs.length > 1 && (
                        <div className="text-sm text-muted-foreground">
                          ✂️ {promoSvcs.length} serviços: {promoSvcs.slice(0, 3).map(s => s.name).join(', ')}{promoSvcs.length > 3 ? ` +${promoSvcs.length - 3}` : ''}
                        </div>
                      )}

                      {/* Date + time range */}
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {promo.start_date === promo.end_date ? (
                          <span>📅 {format(parseISO(promo.start_date), 'dd/MM/yyyy')}</span>
                        ) : (
                          <span>📅 {format(parseISO(promo.start_date), 'dd/MM/yyyy')} - {format(parseISO(promo.end_date), 'dd/MM/yyyy')}</span>
                        )}
                        {promo.start_time && promo.end_time && <span>🕒 {promo.start_time.slice(0, 5)} - {promo.end_time.slice(0, 5)}</span>}
                      </div>

                      {/* Countdown timer for active promos */}
                      {renderCountdown(promo)}

                      {/* Slots + urgency */}
                      <div className="flex flex-wrap gap-2 text-xs">
                        <Badge variant="outline"><Users className="h-3 w-3 mr-1" />{getFilterLabel(promo.client_filter)}</Badge>
                        {remaining !== null && (
                          <Badge
                            variant={remaining <= 0 ? 'destructive' : 'outline'}
                            className={remaining > 0 && remaining <= 5 ? 'bg-orange-500 text-white border-orange-500' : ''}
                          >
                            {remaining <= 0 ? 'Esgotado' : remaining <= 5 ? (
                              <><Flame className="h-3 w-3 mr-1" />Últimas {remaining} vagas</>
                            ) : `${remaining} vagas`}
                          </Badge>
                        )}
                      </div>

                      {promo.slug && (
                        <div className="flex items-center gap-2">
                          <Input readOnly value={getPromoLink(promo)} className="text-xs h-8 bg-muted" />
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => { navigator.clipboard.writeText(getPromoLink(promo)); toast({ title: 'Link copiado!' }); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => toggleStatus(promo)}>
                          {promo.status === 'active' ? 'Pausar' : 'Ativar'}
                        </Button>
                        <Button size="sm" onClick={() => fetchFilteredClients(promo)} disabled={status !== 'active'}>
                          <Send className="h-3 w-3 mr-1" />Enviar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => fetchMetrics(promo)}>
                          <BarChart3 className="h-3 w-3 mr-1" />Métricas
                        </Button>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={getPromoLink(promo)} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3 mr-1" />Ver
                          </a>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Client list dialog */}
      <Dialog open={clientsDialogOpen} onOpenChange={setClientsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clientes — {selectedPromotion?.title}</DialogTitle>
          </DialogHeader>
          {clientsLoading ? (
            <p className="text-muted-foreground py-4">Carregando...</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-muted-foreground py-4">Nenhum cliente encontrado.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{filteredClients.length} cliente(s)</p>
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">WhatsApp</th>
                      <th className="text-left p-3 font-medium">Última Visita</th>
                      <th className="text-right p-3 font-medium">Total Gasto</th>
                      <th className="text-right p-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map(client => (
                      <tr key={client.id} className="border-t">
                        <td className="p-3">{client.name}</td>
                        <td className="p-3 text-muted-foreground">{client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}</td>
                        <td className="p-3 text-muted-foreground">{client.last_visit ? format(parseISO(client.last_visit), 'dd/MM/yyyy') : '-'}</td>
                        <td className="p-3 text-right">R$ {(client.total_spent || 0).toFixed(2)}</td>
                        <td className="p-3 text-right">
                          {client.whatsapp && selectedPromotion ? (
                            <a href={buildWhatsAppLink(client, selectedPromotion)} target="_blank" rel="noopener noreferrer">
                              <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-600/30 hover:bg-emerald-50">
                                <MessageCircle className="h-3 w-3 mr-1" />WhatsApp
                              </Button>
                            </a>
                          ) : <span className="text-xs text-muted-foreground">Sem WhatsApp</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Metrics dialog */}
      <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Métricas — {selectedPromotion?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6 text-center">
                <MousePointerClick className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{metrics.clicks}</p>
                <p className="text-xs text-muted-foreground">Cliques</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <CalendarCheck className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">{metrics.bookings}</p>
                <p className="text-xs text-muted-foreground">Agendamentos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 text-center">
                <TrendingUp className="h-8 w-8 mx-auto text-primary mb-2" />
                <p className="text-2xl font-bold">
                  {metrics.clicks > 0 ? `${Math.round((metrics.bookings / metrics.clicks) * 100)}%` : '0%'}
                </p>
                <p className="text-xs text-muted-foreground">Conversão</p>
              </CardContent>
            </Card>
          </div>
          {selectedPromotion && (
            <div className="mt-4 text-sm text-muted-foreground">
              <p>Vagas utilizadas: {selectedPromotion.used_slots} / {selectedPromotion.max_slots || '∞'}</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
