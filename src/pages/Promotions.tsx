import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useFeatureDiscovery } from '@/hooks/useFeatureDiscovery';
import { FeatureIntroModal } from '@/components/FeatureIntroModal';
import { useAuth } from '@/contexts/AuthContext';
import { useOnDataRefresh } from '@/hooks/useRefreshData';
import { useUserRole } from '@/hooks/useUserRole';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreVertical, Edit2, Trash2, Play, Pause, ExternalLink, RefreshCw, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, isToday, isTomorrow, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, MessageCircle, Send, Users, Tag, Megaphone, Copy, BarChart3, Eye, TrendingUp, MousePointerClick, CalendarCheck, ChevronLeft, ChevronRight, Check, Clock, Flame, Timer, Zap } from 'lucide-react';
import { formatWhatsApp, displayWhatsApp, buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';

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
  use_business_hours?: boolean;
  valid_days?: number[];
  min_interval_minutes?: number;
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
  promotion_type: string;
  cashback_validity_days: number | null;
  cashback_rules_text: string | null;
  cashback_cumulative: boolean;
  promotion_mode?: 'manual' | 'smart';
  source_insight?: string;
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

interface PromotionInsight {
  type: 'low_occupancy' | 'birthdays' | 'reactivation' | 'lunch_time' | 'afternoon_low' | 'tip';
  title: string;
  description: string;
  buttonLabel?: string;
  icon: any;
  data?: any;
}

const MESSAGE_TAGS_TRADITIONAL = [
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

const MESSAGE_TAGS_CASHBACK = [
  { tag: '{{cliente_nome}}', label: 'Nome' },
  { tag: '{{cliente_primeiro_nome}}', label: 'Primeiro Nome' },
  { tag: '{{empresa_nome}}', label: 'Empresa' },
  { tag: '{{servicos_promocao}}', label: 'Serviços' },
  { tag: '{{profissionais_promocao}}', label: 'Profissionais' },
  { tag: '{{valor_cashback}}', label: 'Valor Cashback' },
  { tag: '{{validade_cashback}}', label: 'Validade Cashback' },
  { tag: '{{regras_cashback}}', label: 'Regras Cashback' },
];

const DEFAULT_TEMPLATE = `Olá {{cliente_nome}}! 👋

Estamos com uma promoção especial na *{{empresa_nome}}*! 🎉

✂️ Serviço: {{servicos_promocao}}

💰 De R$ {{valor_normal}} por apenas *R$ {{valor_promocional}}*

👨‍🔧 Válido com: {{profissionais_promocao}}

Garanta seu horário:
{{link_promocao}}

Te esperamos! 🙏`;

const DEFAULT_CASHBACK_TEMPLATE = `Olá {{cliente_nome}}! 👋

A *{{empresa_nome}}* preparou uma promoção especial para você! 🎉

✂️ Serviço participante: {{servicos_promocao}}

💰 Ao realizar este serviço você ganha *{{valor_cashback}} de cashback* para usar no seu próximo agendamento!

📅 Profissionais participantes: {{profissionais_promocao}}

⏳ Validade do cashback: {{validade_cashback}} dias após realizar o serviço.

📌 Regras da promoção:
{{regras_cashback}}

⚠️ O cashback é válido somente para seu *próximo agendamento* e dentro do prazo informado.

Agende pelo nosso sistema e garanta seu benefício! 🙌`;

function generateSlug(title: string): string {
  return title.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const WIZARD_STEPS_TRADITIONAL = [
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
  const { hasSeen, markSeen, loading: discoveryLoading } = useFeatureDiscovery();
  const [showIntro, setShowIntro] = useState(false);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [creationMode, setCreationMode] = useState<'choice' | 'manual' | 'smart' | null>(null);
  const [smartMode, setSmartMode] = useState<'manual' | 'smart'>('manual');
  const [sourceInsight, setSourceInsight] = useState<string | null>(null);
  const [clientsDialogOpen, setClientsDialogOpen] = useState(false);
  const [metricsDialogOpen, setMetricsDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [highlightedPromoId, setHighlightedPromoId] = useState<string | null>(null);
  const [now, setNow] = useState(new Date());

  // Wizard step
  const [wizardStep, setWizardStep] = useState(1);

  // Form state
  const [promotionType, setPromotionType] = useState<'traditional' | 'cashback'>('traditional');
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
  const [useBusinessHours, setUseBusinessHours] = useState(true);
  const [validDays, setValidDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [minIntervalMinutes, setMinIntervalMinutes] = useState('0');
  const [maxSlots, setMaxSlots] = useState('10');
  const [clientFilter, setClientFilter] = useState('all');
  const [clientFilterValue, setClientFilterValue] = useState('30');
  const [professionalFilter, setProfessionalFilter] = useState('all');
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);
  const [cashbackValidityDays, setCashbackValidityDays] = useState('30');
  const [cashbackRulesText, setCashbackRulesText] = useState('');
  const [cashbackCumulative, setCashbackCumulative] = useState(false);

  const WIZARD_STEPS = promotionType === 'cashback'
    ? [{ num: 1, label: 'Serviço' }, { num: 2, label: 'Cashback' }, { num: 3, label: 'Agenda' }, { num: 4, label: 'Mensagem' }]
    : WIZARD_STEPS_TRADITIONAL;
  const totalSteps = WIZARD_STEPS.length;

  // Data
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [companySlug, setCompanySlug] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState('');
  const [metrics, setMetrics] = useState<PromoMetrics>({ clicks: 0, bookings: 0, clientsReached: 0 });
  const [insights, setInsights] = useState<PromotionInsight[]>([]);
  const [activeInsightIndex, setActiveInsightIndex] = useState(0);

  // Feature discovery intro
  useEffect(() => {
    if (!discoveryLoading && !hasSeen('promotions')) {
      setShowIntro(true);
    }
  }, [discoveryLoading, hasSeen]);

  // Update clock and rotation every 60s
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setInsights(prev => {
        if (prev.length > 1) {
          setActiveInsightIndex(current => (current + 1) % prev.length);
        }
        return prev;
      });
    }, 15000); // Rotate every 15s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId]);

  // Listen for external refresh events
  const handlePromotionsRefresh = useCallback(() => {
    if (companyId) fetchPromotions();
  }, [companyId]);
  useOnDataRefresh('promotions', handlePromotionsRefresh);
  useOnDataRefresh('promotions', handlePromotionsRefresh);

  // Clear highlight after a few seconds
  useEffect(() => {
    if (highlightedPromoId) {
      const t = setTimeout(() => setHighlightedPromoId(null), 4000);
      return () => clearTimeout(t);
    }
  }, [highlightedPromoId]);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([
      fetchPromotions(), 
      fetchServices(), 
      fetchProfessionals(), 
      fetchCompanyInfo(), 
      generateInsights()
    ]);
    setLoading(false);
  };

  const fetchCompanyInfo = async () => {
    const { data } = await supabase.from('companies').select('name, slug, business_type').eq('id', companyId!).single();
    if (data) { setCompanyName(data.name); setCompanySlug(data.slug); setCompanyBusinessType((data as any).business_type || 'barbershop'); }
  };

  const fetchPromotions = async () => {
    let query = supabase
      .from('promotions')
      .select('*')
      .eq('company_id', companyId!)
      .neq('promotion_type', 'cashback')
      .order('created_at', { ascending: false });
    
    // Professionals only see their own promotions
    if (!isAdmin && profile?.id) {
      query = query.eq('created_by', profile.id);
    }
    
    const { data } = await query;
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

  const generateInsights = async () => {
    if (!companyId) return;
    const newInsights: PromotionInsight[] = [];
    
    // 1. Tomorrow's occupancy
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = format(tomorrow, 'yyyy-MM-dd');
    const { data: tomorrowApps } = await supabase
      .from('appointments')
      .select('id')
      .eq('company_id', companyId!)
      .gte('start_time', `${dateStr}T00:00:00`)
      .lte('start_time', `${dateStr}T23:59:59`)
      .in('status', ['confirmed', 'pending']);

    const appCount = tomorrowApps?.length || 0;
    if (appCount < 5) {
      newInsights.push({
        type: 'low_occupancy',
        title: '📉 Agenda com vagas amanhã',
        description: `Você tem apenas ${appCount} horários agendados para amanhã.`,
        buttonLabel: '⚡ Criar promoção automática',
        icon: TrendingUp,
        data: { date: dateStr }
      });
    }

    // 2. Birthdays this month
    const currentMonth = new Date().getMonth() + 1;
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, birth_date')
      .eq('company_id', companyId!)
      .not('birth_date', 'is', null);
    
    const bdaysThisMonth = clients?.filter(c => {
      if (!c.birth_date) return false;
      const m = parseInt(c.birth_date.split('-')[1]);
      return m === currentMonth;
    }) || [];

    if (bdaysThisMonth.length > 0) {
      newInsights.push({
        type: 'birthdays',
        title: `🎂 ${bdaysThisMonth.length} aniversariantes este mês`,
        description: 'Envie um presente especial para fidelizar esses clientes.',
        buttonLabel: '🎁 Criar campanha aniversário',
        icon: Users,
        data: { count: bdaysThisMonth.length }
      });
    }

    // 3. Reactivation (Inactive)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { data: recentApps } = await supabase
      .from('appointments')
      .select('client_id')
      .eq('company_id', companyId!)
      .gte('start_time', thirtyDaysAgo.toISOString())
      .limit(100);
    
    const recentClientIds = new Set(recentApps?.map(a => a.client_id));
    const inactiveCount = (clients?.length || 0) - recentClientIds.size;
    
    if (inactiveCount > 5) {
      newInsights.push({
        type: 'reactivation',
        title: `😴 ${inactiveCount} clientes inativos`,
        description: 'Eles não aparecem há mais de 30 dias. Chame-os de volta!',
        buttonLabel: '🔁 Criar campanha reativação',
        icon: RefreshCw,
        data: { count: inactiveCount }
      });
    }

    // 4. Lunch time
    const currentHour = new Date().getHours();
    const isPastLunch = currentHour >= 14;
    newInsights.push({
      type: 'lunch_time',
      title: isPastLunch ? '🍽️ Almoço de Amanhã' : '🍽️ Horário fraco no almoço',
      description: isPastLunch ? 'Já comece a lotar seu horário de almoço de amanhã.' : 'Geralmente as 11h às 14h são horários mais calmos.',
      buttonLabel: isPastLunch ? '☀️ Promo almoço amanhã' : '☀️ Promo almoço',
      icon: Clock,
      data: { isTomorrow: isPastLunch }
    });

    // 5. Afternoon
    const isPastAfternoon = currentHour >= 19;
    newInsights.push({
      type: 'afternoon_low',
      title: isPastAfternoon ? '🌙 Tarde de Amanhã' : '🌙 Fim de tarde com baixa ocupação',
      description: isPastAfternoon ? 'Garanta agendamentos para o fim da tarde de amanhã.' : 'Preencha os horários após as 17h com um desconto rápido.',
      buttonLabel: isPastAfternoon ? '🌙 Promo tarde amanhã' : '🌙 Promo fim de tarde',
      icon: Flame,
      data: { isTomorrow: isPastAfternoon }
    });

    // Tip fallback
    newInsights.push({
      type: 'tip',
      title: '💡 Dica de Especialista',
      description: 'Promoções curtas (2-3 dias) com escassez convertem muito mais.',
      icon: Megaphone
    });

    setInsights(newInsights);
  };

  const applyInsight = (insight: PromotionInsight) => {
    resetForm();
    setSmartMode('smart');
    setSourceInsight(insight.type);
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');
    
    // Logic for early activation (start today at 19:00 or now)
    const nowHour = new Date().getHours();
    const defaultStartTime = nowHour < 19 ? '19:00' : `${String(Math.min(23, nowHour + 1)).padStart(2, '0')}:00`;

    switch (insight.type) {
      case 'low_occupancy':
        setTitle(`Relâmpago: Vagas para Amanhã`);
        setStartDate(todayStr);
        setEndDate(tomorrowStr);
        setSingleDay(false);
        setDiscountType('percentage');
        setDiscountValue('15');
        setStartTime(defaultStartTime);
        setEndTime('13:30'); 
        setUseBusinessHours(false);
        setDescription('Aproveite nossos horários vagos para amanhã com um desconto especial!');
        setMessageTemplate(`Olá {{cliente_primeiro_nome}}! 👋\n\nNotamos que amanhã ainda temos alguns horários disponíveis e resolvemos liberar um desconto de 15% para quem agendar agora! 😱\n\nCorre para garantir o seu: {{link_promocao}}`);
        break;
      case 'birthdays':
        const firstDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), 'yyyy-MM-dd');
        const lastDayOfMonth = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd');
        setTitle('Presente de Aniversário 🎂');
        setStartDate(firstDayOfMonth);
        setEndDate(lastDayOfMonth);
        setSingleDay(false);
        setClientFilter('birthday_month');
        setDiscountType('percentage');
        setDiscountValue('20');
        setDescription('Parabéns! Você ganhou um desconto exclusivo para usar no seu mês de aniversário.');
        setMessageTemplate(`Parabéns {{cliente_primeiro_nome}}! 🎂🎉\n\nA {{empresa_nome}} preparou um presente especial para o seu mês: 20% de DESCONTO em qualquer serviço!\n\nAgende seu momento: {{link_promocao}}`);
        break;
      case 'reactivation':
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        setTitle('Saudades de você! ❤️');
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(nextWeek, 'yyyy-MM-dd'));
        setSingleDay(false);
        setClientFilter('inactive');
        setClientFilterValue('30');
        setDiscountType('fixed_amount');
        setDiscountValue('10');
        setDescription('Faz tempo que não te vemos! Ganhe um desconto para seu próximo retorno.');
        setMessageTemplate(`Olá {{cliente_primeiro_nome}}, tudo bem? 😊\n\nFaz tempo que você não nos visita na {{empresa_nome}}... Saiba que sentimos sua falta!\n\nPara te incentivar a voltar, aqui está um cupom de R$ 10,00 para seu próximo agendamento: {{link_promocao}}`);
        break;
      case 'lunch_time':
        const isLunchTomorrow = insight.data?.isTomorrow;
        setTitle(isLunchTomorrow ? 'Promo Almoço Amanhã ☀️' : 'Promoção Almoço ☀️');
        setStartDate(todayStr);
        setEndDate(isLunchTomorrow ? tomorrowStr : todayStr);
        setSingleDay(!isLunchTomorrow);
        setUseBusinessHours(false);
        setStartTime(isLunchTomorrow ? defaultStartTime : '11:00');
        setEndTime('14:00');
        setDiscountType('percentage');
        setDiscountValue('10');
        setMessageTemplate(isLunchTomorrow 
          ? `Já pensou no almoço de amanhã? 🍽️✨\n\nAgende entre 11h e 14h de amanhã na {{empresa_nome}} e ganhe 10% OFF.\n\nReserve agora: {{link_promocao}}`
          : `Horário de almoço com desconto na {{empresa_nome}}! 🍽️✨\n\nAgende entre 11h e 14h e ganhe 10% OFF.\n\nReserve aqui: {{link_promocao}}`
        );
        break;
      case 'afternoon_low':
        const isAfternoonTomorrow = insight.data?.isTomorrow;
        setTitle(isAfternoonTomorrow ? 'Happy Hour Amanhã 🌙' : 'Happy Hour da Beleza 🌙');
        setStartDate(todayStr);
        setEndDate(isAfternoonTomorrow ? tomorrowStr : todayStr);
        setSingleDay(!isAfternoonTomorrow);
        setUseBusinessHours(false);
        setStartTime(isAfternoonTomorrow ? defaultStartTime : '17:00');
        setEndTime('20:00');
        setDiscountType('percentage');
        setDiscountValue('15');
        setMessageTemplate(isAfternoonTomorrow
          ? `Garanta seu Happy Hour de amanhã! 🌙✂️\n\nAgende para amanhã entre 17h e 20h e ganhe 15% de desconto!\n\nAgende agora: {{link_promocao}}`
          : `Que tal um trato no visual depois do trabalho? 🌙✂️\n\nNo nosso Happy Hour (17h às 20h) você ganha 15% de desconto!\n\nAgende agora: {{link_promocao}}`
        );
        break;
    }
    setDialogOpen(true);
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
    
    if (promotionType === 'cashback') {
      // Cashback only uses percentage or fixed_amount
      if (!discountValue) return 'Informe o valor do cashback';
      const val = parseFloat(discountValue);
      if (val <= 0) return 'O valor do cashback deve ser maior que zero';
      if (discountType === 'percentage' && val >= 100) return 'O percentual de cashback deve ser menor que 100%';
    } else if (discountType === 'fixed_price') {
      if (!promotionPrice) return 'Informe o preço promocional';
      const promo = parseFloat(promotionPrice);
      if (promo <= 0) return 'O preço promocional deve ser maior que zero';
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
    } else if ((promotionType === 'cashback' && wizardStep === 3) || (promotionType === 'traditional' && wizardStep === 2)) {
      const err = validateStep2();
      if (err) { toast({ title: err, variant: 'destructive' }); return; }
    }
    setWizardStep(prev => Math.min(prev + 1, totalSteps));
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
      .select('client_id, total_price, start_time, status, professional_id')
      .eq('company_id', companyId!)
      .in('status', ['completed', 'confirmed']);

    const clientStats = new Map<string, { totalSpent: number; lastVisit: string | null; visitCount: number; professionalIds: Set<string>; visitHours: number[] }>();
    appointments?.forEach(apt => {
      if (!apt.client_id) return;
      const c = clientStats.get(apt.client_id) || { totalSpent: 0, lastVisit: null, visitCount: 0, professionalIds: new Set<string>(), visitHours: [] };
      c.totalSpent += Number(apt.total_price) || 0;
      c.visitCount++;
      if (apt.professional_id) c.professionalIds.add(apt.professional_id);
      if (apt.start_time) c.visitHours.push(new Date(apt.start_time).getHours());
      if (!c.lastVisit || apt.start_time > c.lastVisit) c.lastVisit = apt.start_time;
      clientStats.set(apt.client_id, c);
    });

    let result: ClientRow[] = clients.map(c => {
      const s = clientStats.get(c.id);
      return { id: c.id, name: c.name, whatsapp: c.whatsapp, birth_date: c.birth_date, last_visit: s?.lastVisit || null, total_spent: s?.totalSpent || 0, visit_count: s?.visitCount || 0 };
    });

    // Smart logic priority if it's a smart promotion
    if (promotion.promotion_mode === 'smart' && promotion.source_insight) {
      const insight = promotion.source_insight;
      if (insight === 'reactivation') {
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 30);
        result = result.filter(c => !c.last_visit || new Date(c.last_visit) < cutoff);
      } else if (insight === 'birthdays') {
        const m = new Date().getMonth() + 1;
        result = result.filter(c => c.birth_date && parseInt(c.birth_date.split('-')[1], 10) === m);
      } else if (insight === 'low_occupancy') {
        // Active in last 60 days
        const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 60);
        result = result.filter(c => c.last_visit && new Date(c.last_visit) >= cutoff);
      } else if (insight === 'lunch_time') {
        // Customers who usually book between 9h and 14h
        result = result.filter(c => {
          const stats = clientStats.get(c.id);
          if (!stats) return false;
          const morningLunchVisits = stats.visitHours.filter(h => h >= 9 && h <= 14).length;
          return morningLunchVisits > 0;
        });
      } else if (insight === 'professional_idle' && promotion.professional_ids?.length) {
        // Customers of the target professional
        result = result.filter(c => {
          const stats = clientStats.get(c.id);
          if (!stats) return false;
          return promotion.professional_ids?.some(pid => stats.professionalIds.has(pid));
        });
      }
    } else {
      // Manual filter logic
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

  const handleSave = async () => {
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
      start_time: useBusinessHours ? null : (startTime || null),
      end_time: useBusinessHours ? null : (endTime || null),
      use_business_hours: useBusinessHours,
      valid_days: validDays,
      min_interval_minutes: parseInt(minIntervalMinutes) || 0,
      max_slots: parseInt(maxSlots) || 0,
      client_filter: clientFilter,
      client_filter_value: ['inactive', 'new_clients', 'top_spending', 'frequent'].includes(clientFilter) ? parseInt(clientFilterValue) || null : null,
      professional_filter: professionalFilter,
      professional_ids: professionalFilter === 'selected' ? selectedProfessionalIds : null,
      message_template: messageTemplate,
      created_by: profile?.id || null,
      status: isEditing && selectedPromotion ? selectedPromotion.status : 'active',
      promotion_type: promotionType,
      cashback_validity_days: promotionType === 'cashback' ? (parseInt(cashbackValidityDays) || 30) : null,
      cashback_rules_text: promotionType === 'cashback' ? (cashbackRulesText || null) : null,
      cashback_cumulative: promotionType === 'cashback' ? cashbackCumulative : false,
      promotion_mode: smartMode,
      source_insight: sourceInsight,
    };

    if (!isAdmin && profile?.id) {
      payload.professional_filter = 'selected';
      payload.professional_ids = [profile.id];
      payload.created_by = profile.id;
    }

    if (isEditing && selectedPromotion) {
      const { error } = await supabase.from('promotions').update(payload).eq('id', selectedPromotion.id);
      if (error) {
        toast({ title: 'Erro ao atualizar promoção', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Promoção atualizada com sucesso! 🎉' });
    } else {
      const { data, error } = await supabase.from('promotions').insert(payload).select('id').single();
      if (error) {
        toast({ title: 'Erro ao criar promoção', description: error.message, variant: 'destructive' });
        return;
      }
      toast({ title: 'Promoção criada com sucesso! 🎉' });
      if (data?.id) setHighlightedPromoId(data.id);
    }

    setDialogOpen(false);
    resetForm();

    // Determine the right tab
    const promoStartDt = new Date(startDate + 'T' + (startTime || '00:00') + ':00');
    const targetTab = promoStartDt > new Date() ? 'scheduled' : 'active';
    setActiveTab(targetTab);

    await fetchPromotions();
  };

  const resetForm = () => {
    setPromotionType('traditional');
    setTitle(''); setDescription(''); setSelectedServiceId(''); setSelectedServiceIds([]);
    setServiceSelectionMode('single'); setDiscountType('fixed_price'); setDiscountValue('');
    setPromotionPrice('');
    setStartDate(''); setEndDate(''); setSingleDay(false); setStartTime(''); setEndTime(''); 
    setUseBusinessHours(true); setValidDays([0, 1, 2, 3, 4, 5, 6]); setMinIntervalMinutes('0');
    setMaxSlots('10');
    setClientFilter('all'); setClientFilterValue('30'); setProfessionalFilter('all');
    setSelectedProfessionalIds([]); setMessageTemplate(DEFAULT_TEMPLATE);
    setCashbackValidityDays('30'); setCashbackRulesText(''); setCashbackCumulative(false);
    setWizardStep(1);
    setIsEditing(false);
    setSelectedPromotion(null);
    setCreationMode(null);
    setSmartMode('manual');
    setSourceInsight(null);
  };

  const handleEdit = (promo: Promotion) => {
    setSelectedPromotion(promo);
    setIsEditing(true);
    setCreationMode('manual');
    setSmartMode(promo.promotion_mode || 'manual');
    setSourceInsight(promo.source_insight || null);
    setPromotionType(promo.promotion_type as any || 'traditional');
    setTitle(promo.title);
    setDescription(promo.description || '');
    
    const sIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
    if (sIds.length === services.length) {
      setServiceSelectionMode('all');
      setSelectedServiceIds(services.map(s => s.id));
    } else if (sIds.length > 1) {
      setServiceSelectionMode('multiple');
      setSelectedServiceIds(sIds);
    } else {
      setServiceSelectionMode('single');
      setSelectedServiceId(sIds[0] || '');
      setSelectedServiceIds(sIds);
    }

    setDiscountType(promo.discount_type as any);
    setDiscountValue(promo.discount_value ? String(promo.discount_value) : '');
    setPromotionPrice(promo.promotion_price ? String(promo.promotion_price) : '');
    setStartDate(promo.start_date);
    setEndDate(promo.end_date);
    setSingleDay(promo.start_date === promo.end_date);
    setStartTime(promo.start_time || '');
    setEndTime(promo.end_time || '');
    setUseBusinessHours(promo.use_business_hours !== false);
    setValidDays(promo.valid_days || [0, 1, 2, 3, 4, 5, 6]);
    setMinIntervalMinutes(String(promo.min_interval_minutes || 0));
    setMaxSlots(String(promo.max_slots));
    setClientFilter(promo.client_filter);
    setClientFilterValue(String(promo.client_filter_value || '30'));
    setProfessionalFilter(promo.professional_filter);
    setSelectedProfessionalIds(promo.professional_ids || []);
    setMessageTemplate(promo.message_template || DEFAULT_TEMPLATE);
    setCashbackValidityDays(String(promo.cashback_validity_days || '30'));
    setCashbackRulesText(promo.cashback_rules_text || '');
    setCashbackCumulative(promo.cashback_cumulative || false);
    
    setWizardStep(1);
    setDialogOpen(true);
  };

  const handleDuplicate = (promo: Promotion) => {
    handleEdit(promo);
    setIsEditing(false);
    setSelectedPromotion(null);
    setTitle(`${promo.title} (Cópia)`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta promoção?')) return;
    const { error } = await supabase.from('promotions').delete().eq('id', id);
    if (error) {
      toast({ title: 'Erro ao excluir promoção', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Promoção excluída' });
    fetchPromotions();
  };

  const toggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'active' ? 'paused' : 'active';
    await supabase.from('promotions').update({ status: newStatus } as any).eq('id', promo.id);
    fetchPromotions();
  };

  const getPromoLink = (promo: Promotion) => {
    const routeType = companyBusinessType === 'esthetic' ? 'estetica' : 'barbearia';
    return `${window.location.origin}/${routeType}/${companySlug}?promo=${promo.id}`;
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

    // Build services text
    const promoServiceIds = promotion.service_ids || (promotion.service_id ? [promotion.service_id] : []);
    const promoSvcs = services.filter(s => promoServiceIds.includes(s.id));
    const servicosText = (() => {
      if (promoServiceIds.length === 0 || promoServiceIds.length >= services.length) {
        return 'Todos os serviços';
      }
      if (promoSvcs.length === 1) {
        return promoSvcs[0].name;
      }
      const names = promoSvcs.map(s => s.name);
      return names.slice(0, -1).join(', ') + ' e ' + names[names.length - 1];
    })();

    // Build professionals text
    const profissionaisText = (() => {
      if (promotion.professional_filter === 'all' || !promotion.professional_ids?.length) {
        return 'Todos os profissionais da equipe';
      }
      const profNames = promotion.professional_ids.map(pid => {
        const p = professionals.find((pr: any) => pr.profile_id === pid);
        return p?.profiles?.full_name || '';
      }).filter(Boolean);
      if (profNames.length === 1) return profNames[0];
      return profNames.slice(0, -1).join(', ') + ' e ' + profNames[profNames.length - 1];
    })();

    let msg = promotion.message_template || (promotion.promotion_type === 'cashback' ? DEFAULT_CASHBACK_TEMPLATE : DEFAULT_TEMPLATE);
    msg = msg.replace(/\{\{cliente_nome\}\}/g, client.name);
    msg = msg.replace(/\{\{cliente_primeiro_nome\}\}/g, client.name.split(' ')[0]);
    msg = msg.replace(/\{\{cliente_aniversario\}\}/g, client.birth_date ? format(parseISO(client.birth_date), 'dd/MM') : '');
    msg = msg.replace(/\{\{empresa_nome\}\}/g, companyName);
    msg = msg.replace(/\{\{profissional_nome\}\}/g, profName);
    msg = msg.replace(/\{\{servicos_promocao\}\}/g, servicosText);
    msg = msg.replace(/\{\{profissionais_promocao\}\}/g, profissionaisText);
    msg = msg.replace(/\{\{valor_normal\}\}/g, promotion.original_price ? `R$ ${Number(promotion.original_price).toFixed(2)}` : '');
    msg = msg.replace(/\{\{valor_promocional\}\}/g, promotion.promotion_price ? `R$ ${Number(promotion.promotion_price).toFixed(2)}` : '');
    msg = msg.replace(/\{\{link_promocao\}\}/g, promoLink);
    // Cashback-specific tags
    if (promotion.promotion_type === 'cashback') {
      const cashbackVal = promotion.discount_type === 'percentage'
        ? `${Number(promotion.discount_value || 0)}%`
        : `R$ ${Number(promotion.discount_value || 0).toFixed(2)}`;
      msg = msg.replace(/\{\{valor_cashback\}\}/g, cashbackVal);
      msg = msg.replace(/\{\{validade_cashback\}\}/g, String(promotion.cashback_validity_days || 30));
      msg = msg.replace(/\{\{regras_cashback\}\}/g, promotion.cashback_rules_text || '');
    }

    trackWhatsAppClick('promotions');
    return buildWhatsAppUrl(number, msg);
  };

  const handleEndNow = async (promo: Promotion) => {
    if (!confirm('Deseja encerrar esta promoção imediatamente?')) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = format(yesterday, 'yyyy-MM-dd');
    const { error } = await supabase.from('promotions').update({ end_date: dateStr, status: 'expired' } as any).eq('id', promo.id);
    if (error) {
      toast({ title: 'Erro ao encerrar promoção', variant: 'destructive' });
      return;
    }
    toast({ title: 'Promoção encerrada' });
    fetchPromotions();
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
    const isSmart = promo.promotion_mode === 'smart';
    const status = promoVisualStatus(promo, now);
    const start = getPromoStart(promo);
    const isTargetingTomorrow = isTomorrow(parseISO(promo.end_date)) && isToday(parseISO(promo.start_date));
    
    switch (status) {
      case 'scheduled':
        let dateText = '';
        const daysDiff = differenceInCalendarDays(start, now);
        const startTime = promo.start_time?.slice(0, 5) || '00:00';
        const formattedHour = startTime.split(':')[0] + 'h';

        if (isToday(start)) {
          dateText = `hoje às ${formattedHour}`;
        } else if (isTomorrow(start)) {
          dateText = `amanhã às ${formattedHour}`;
        } else if (daysDiff <= 6) {
          dateText = `${format(start, 'EEEE', { locale: ptBR })} às ${formattedHour}`;
        } else {
          dateText = `em ${format(start, 'dd/MM')} às ${formattedHour}`;
        }

        return (
          <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800 gap-1.5 py-1 px-3">
            <CalendarCheck className="h-3.5 w-3.5" />
            {isTargetingTomorrow ? `🟢 Ativa hoje às ${formattedHour} para reservas de amanhã` : `📅 Começa automaticamente ${dateText}`}
          </Badge>
        );
      case 'active':
        return (
          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800 gap-1.5 py-1 px-3 shadow-sm font-medium">
            {isTargetingTomorrow ? <Zap className="h-3.5 w-3.5 fill-emerald-500" /> : <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
            {isTargetingTomorrow ? '🚀 Ativa agora para reservas de amanhã' : '🟢 Ativa agora'}
          </Badge>
        );
      case 'paused':
        return <Badge variant="secondary" className="py-1 px-3">Pausada</Badge>;
      case 'expired':
        return (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground py-1 px-3 bg-muted/30">
            <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
            Encerrada
          </Badge>
        );
    }
  };

  // --- Countdown for active promos ---
  const renderCountdown = (promo: Promotion) => {
    const status = promoVisualStatus(promo, now);
    
    if (status === 'active') {
      const end = getPromoEnd(promo);
      if (isNaN(end.getTime())) return null;
      const remaining = end.getTime() - now.getTime();
      if (!isFinite(remaining) || remaining <= 0) return null;
      const text = formatCountdown(remaining);
      if (!text) return null;
      return (
        <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium bg-amber-50 dark:bg-amber-950/20 p-2 rounded-lg">
          <Timer className="h-3.5 w-3.5" />
          <span>⏰ Termina em {text}</span>
        </div>
      );
    }

    if (status === 'scheduled') {
      const start = getPromoStart(promo);
      const remaining = start.getTime() - now.getTime();
      if (remaining <= 0) return null;
      
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const days = Math.floor(hours / 24);
      
      let countdownText = '';
      if (days > 0) {
        countdownText = `Faltam ${days} ${days === 1 ? 'dia' : 'dias'}`;
      } else if (hours > 0) {
        countdownText = `Em ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
      } else {
        const minutes = Math.floor(remaining / (1000 * 60));
        countdownText = `Em ${minutes} min`;
      }
      
      return (
        <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium bg-indigo-50/50 dark:bg-indigo-900/10 p-2 rounded-lg">
          <Clock className="h-3.5 w-3.5" />
          <span>{countdownText}</span>
        </div>
      );
    }
    
    return null;
  };

  // --- Wizard step rendering ---
  const renderStep1 = () => {
    const effectiveIds = getEffectiveServiceIds();
    const selectedSvcs = services.filter(s => effectiveIds.includes(s.id));
    
    return (
    <div className="space-y-4 pt-1 sm:pt-0">
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

      {/* Discount/Cashback type */}
      {effectiveIds.length > 0 && (
        <>
          <div>
            <Label>{promotionType === 'cashback' ? 'Tipo de cashback *' : 'Tipo de desconto *'}</Label>
            <Select value={discountType} onValueChange={(v: 'fixed_price' | 'percentage' | 'fixed_amount') => {
              setDiscountType(v);
              setPromotionPrice('');
              setDiscountValue('');
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {promotionType === 'traditional' && <SelectItem value="fixed_price">Preço fixo (R$)</SelectItem>}
                <SelectItem value="percentage">{promotionType === 'cashback' ? 'Percentual do serviço (%)' : 'Porcentagem (%)'}</SelectItem>
                <SelectItem value="fixed_amount">{promotionType === 'cashback' ? 'Valor fixo (R$)' : 'Valor fixo de desconto (R$)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Fixed price input (traditional only) */}
          {discountType === 'fixed_price' && promotionType === 'traditional' && (
            <div>
              <Label>Preço Promocional *</Label>
              <Input type="number" value={promotionPrice} onChange={e => setPromotionPrice(e.target.value)} placeholder="Ex: 25.00" step="0.01" />
            </div>
          )}

          {/* Percentage input */}
          {discountType === 'percentage' && (
            <div>
              <Label>{promotionType === 'cashback' ? 'Cashback (%) *' : 'Desconto (%) *'}</Label>
              <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="Ex: 10" min="1" max="99" />
              {promotionType === 'cashback' && <p className="text-xs text-muted-foreground mt-1">Ex: 10% de cashback sobre o valor pago</p>}
            </div>
          )}

          {/* Fixed amount input */}
          {discountType === 'fixed_amount' && (
            <div>
              <Label>{promotionType === 'cashback' ? 'Cashback (R$) *' : 'Desconto (R$) *'}</Label>
              <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder="Ex: 10.00" step="0.01" />
              {promotionType === 'cashback' && <p className="text-xs text-muted-foreground mt-1">Ex: R$10 de cashback por serviço concluído</p>}
            </div>
          )}

          {/* Preview of prices (traditional) */}
          {promotionType === 'traditional' && selectedSvcs.length > 0 && (discountType !== 'fixed_price' ? parseFloat(discountValue) > 0 : parseFloat(promotionPrice) > 0) && (
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

          {/* Preview of cashback */}
          {promotionType === 'cashback' && selectedSvcs.length > 0 && parseFloat(discountValue) > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">💰 Prévia do cashback:</p>
              {selectedSvcs.slice(0, 5).map(svc => {
                const orig = Number(svc.price);
                const cashbackAmount = discountType === 'percentage'
                  ? orig * (parseFloat(discountValue) / 100)
                  : parseFloat(discountValue);
                return (
                  <div key={svc.id} className="flex items-center justify-between text-sm">
                    <span>{svc.name} (R$ {orig.toFixed(2)})</span>
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">+ R$ {cashbackAmount.toFixed(2)} cashback</span>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
    );
  };

  const renderCashbackStep = () => (
    <div className="space-y-4">
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 p-4">
        <h4 className="font-medium text-emerald-700 dark:text-emerald-400 mb-2">💰 Configuração do Cashback</h4>
        <p className="text-xs text-muted-foreground">O cashback será gerado automaticamente quando o serviço for concluído.</p>
      </div>

      <div>
        <Label>Validade do cashback após serviço concluído (em dias) *</Label>
        <Input type="number" value={cashbackValidityDays} onChange={e => setCashbackValidityDays(e.target.value)} placeholder="Ex: 30" min="1" />
        <p className="text-xs text-muted-foreground mt-1">O crédito expira após este período se não for utilizado.</p>
      </div>

      <div>
        <Label>Regras da promoção</Label>
        <Textarea value={cashbackRulesText} onChange={e => setCashbackRulesText(e.target.value)} placeholder="Ex: Válido apenas para serviços acima de R$50. Não acumulável com outras promoções." rows={3} />
        <p className="text-xs text-muted-foreground mt-1">Texto exibido na página da promoção e nos cards de divulgação.</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-4">
        <div>
          <Label className="text-sm font-medium">Cashback acumulativo?</Label>
          <p className="text-xs text-muted-foreground mt-0.5">Se ativado, o cliente pode acumular créditos de múltiplos serviços.</p>
        </div>
        <Switch checked={cashbackCumulative} onCheckedChange={setCashbackCumulative} />
      </div>

      <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
        <p className="font-medium text-xs text-muted-foreground">📋 Resumo:</p>
        <p className="text-xs">• Cashback: {discountType === 'percentage' ? `${discountValue || 0}% do valor pago` : `R$ ${discountValue || '0'} fixo`}</p>
        <p className="text-xs">• Validade: {cashbackValidityDays || 30} dias</p>
        <p className="text-xs">• Acumulativo: {cashbackCumulative ? 'Sim' : 'Não'}</p>
      </div>
    </div>
  );

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
          📅 {(() => {
            try {
              const d = parseISO(startDate);
              if (isNaN(d.getTime())) return 'Data inválida';
              return format(d, "dd/MM/yyyy (EEEE)", { locale: ptBR });
            } catch (e) {
              return 'Erro ao carregar data';
            }
          })()}
        </p>
      )}

      <div className="space-y-3 pt-2">
        <Label>Horários de agendamento</Label>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={useBusinessHours} onCheckedChange={setUseBusinessHours} id="business-hours" />
            <Label htmlFor="business-hours" className="font-normal">Seguir horário padrão da empresa</Label>
          </div>
          
          {!useBusinessHours && (
            <div className="pl-9 space-y-4 border-l-2 border-primary/10 ml-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Hora Início</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="h-8" />
                </div>
                <div>
                  <Label className="text-xs">Hora Fim</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="h-8" />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-2 block">Dias da semana válidos</Label>
                <div className="flex flex-wrap gap-2">
                  {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
                    <Button
                      key={i}
                      type="button"
                      variant={validDays.includes(i) ? "default" : "outline"}
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={() => setValidDays(prev => 
                        prev.includes(i) ? prev.filter(d => d !== i) : [...prev, i]
                      )}
                    >
                      {day}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <Label className="text-xs">Densidade (Intervalo mínimo em minutos)</Label>
                <Input 
                  type="number" 
                  value={minIntervalMinutes} 
                  onChange={e => setMinIntervalMinutes(e.target.value)} 
                  className="h-8" 
                  placeholder="0 = padrão do serviço"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <Label>Vagas máximas</Label>
        <Input type="number" value={maxSlots} onChange={e => setMaxSlots(e.target.value)} min="0" />
        <p className="text-xs text-muted-foreground mt-1">0 = ilimitado por período</p>
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
            <div className="space-y-2 pl-2 mt-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {professionals.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Carregando profissionais...</p>
              ) : professionals.map((p: any) => (
                <label key={p.profile_id} className="flex items-center gap-2 cursor-pointer py-1">
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

  const renderChoiceScreen = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 py-4">
      <div 
        role="button"
        tabIndex={0}
        className="h-full min-h-[160px] flex items-start p-7 gap-5 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group cursor-pointer"
        onClick={() => setCreationMode('manual')}
        onKeyDown={(e) => e.key === 'Enter' && setCreationMode('manual')}
      >
        <div className="bg-muted p-3.5 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-all duration-300 shrink-0 flex items-center justify-center w-14 h-14">
          <Edit2 className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 overflow-hidden pt-1">
          <h3 className="font-bold text-lg leading-tight break-words [overflow-wrap:anywhere]">Manual</h3>
          <p className="text-sm text-muted-foreground font-normal line-clamp-2 break-words [overflow-wrap:anywhere] white-space-normal leading-relaxed">
            Crie promoções do zero, definindo cada detalhe da sua campanha.
          </p>
        </div>
      </div>

      <div 
        role="button"
        tabIndex={0}
        className="h-full min-h-[160px] flex items-start p-7 gap-5 rounded-2xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all group relative cursor-pointer"
        onClick={() => setCreationMode('smart')}
        onKeyDown={(e) => e.key === 'Enter' && setCreationMode('smart')}
      >
        <div className="bg-primary/10 text-primary p-3.5 rounded-xl group-hover:bg-primary/20 transition-all duration-300 shrink-0 flex items-center justify-center w-14 h-14">
          <Zap className="h-6 w-6" />
        </div>
        <div className="flex flex-col gap-1.5 min-w-0 overflow-hidden pr-8 pt-1">
          <h3 className="font-bold text-lg leading-tight break-words [overflow-wrap:anywhere]">Inteligente</h3>
          <p className="text-sm text-muted-foreground font-normal line-clamp-2 break-words [overflow-wrap:anywhere] white-space-normal leading-relaxed">
            IA encontra oportunidades e monta campanhas prontas para você.
          </p>
        </div>
        <div className="absolute top-4 right-4">
          <Badge className="bg-primary text-primary-foreground text-[10px] uppercase px-2 py-0.5 shadow-sm border-none font-bold">IA</Badge>
        </div>
      </div>
    </div>
  );

  const renderSmartScreen = () => {
    const smartOptions = [
      { id: 'low_occupancy', title: 'Horários vagos amanhã', desc: 'Preencha horários livres com promoções rápidas', icon: TrendingUp, isPremium: true },
      { id: 'lunch_time', title: 'Promo almoço', desc: 'Aumente o movimento entre 11h às 14h', icon: Clock },
      { id: 'afternoon_low', title: 'Fim de tarde vazio', desc: 'Atraia clientes para o final do expediente', icon: Flame },
      { id: 'reactivation', title: 'Clientes inativos', desc: 'Recupere clientes que não agendam há 30 dias', icon: RefreshCw, isPremium: true },
      { id: 'birthdays', title: 'Aniversariantes', desc: 'Campanha especial para os aniversariantes do mês', icon: Users },
      { id: 'professional_idle', title: 'Profissional ocioso', desc: 'Impulsione a agenda de profissionais com poucas vagas', icon: Users },
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
        {smartOptions.map((opt) => (
          <div
            key={opt.id}
            role="button"
            tabIndex={0}
            className="h-full min-h-[120px] flex items-start p-6 gap-4 rounded-2xl border border-border bg-card hover:border-primary hover:bg-primary/5 transition-all group relative cursor-pointer"
            onClick={() => {
              if (opt.id === 'professional_idle') {
                resetForm();
                setSmartMode('smart');
                setSourceInsight(opt.id);
                setTitle('Destaque do Profissional');
                setDescription('Conheça nossos especialistas com um desconto especial!');
                setDiscountType('percentage');
                setDiscountValue('10');
                setDialogOpen(true);
                setCreationMode('manual');
              } else {
                const mockInsight: any = { type: opt.id as any };
                if (opt.id === 'lunch_time' || opt.id === 'afternoon_low') {
                  mockInsight.data = { isTomorrow: new Date().getHours() >= 14 };
                }
                applyInsight(mockInsight);
                setCreationMode('manual');
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (opt.id === 'professional_idle') {
                  resetForm(); setSmartMode('smart'); setSourceInsight(opt.id); setCreationMode('manual');
                } else {
                  applyInsight({ type: opt.id } as any); setCreationMode('manual');
                }
              }
            }}
          >
            <div className="bg-primary/10 p-3 rounded-xl text-primary shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300 flex items-center justify-center w-12 h-12">
              <opt.icon className="h-5 w-5" />
            </div>
            <div className={`min-w-0 flex-1 overflow-hidden pt-0.5 ${opt.isPremium ? 'pr-12' : ''}`}>
              <h4 className="font-bold text-base leading-tight mb-1.5 break-words [overflow-wrap:anywhere]">
                {opt.title}
              </h4>
              <p className="text-xs text-muted-foreground font-normal line-clamp-2 leading-relaxed break-words [overflow-wrap:anywhere] white-space-normal">
                {opt.desc}
              </p>
            </div>
            {opt.isPremium && (
              <div className="absolute top-4 right-4">
                <Badge variant="outline" className="text-[9px] uppercase font-bold text-primary border-primary/20 bg-primary/5 py-0 px-1.5 h-4 shadow-sm">PREMIUM</Badge>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

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
        <div className="mb-2">
          <Label>Mensagem WhatsApp</Label>
          <p className="text-xs text-muted-foreground mt-0.5">
            {promotionType === 'cashback' ? 'Mensagem de divulgação da promoção com cashback' : 'Mensagem de divulgação da promoção'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {(promotionType === 'cashback' ? MESSAGE_TAGS_CASHBACK : MESSAGE_TAGS_TRADITIONAL).map(t => (
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
            <Button onClick={() => { resetForm(); setIsEditing(false); setCreationMode('choice'); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl p-0 flex flex-col overflow-hidden">
            <DialogHeader>
              <DialogTitle>
                {isEditing ? 'Editar Promoção' : 
                 creationMode === 'choice' ? 'Como deseja criar?' :
                 creationMode === 'smart' ? 'Oportunidades Inteligentes' :
                 'Criar Promoção Manual'}
              </DialogTitle>
            </DialogHeader>

            {/* Step indicator (Manual only) */}
            {creationMode === 'manual' && (
              <div className="shrink-0 px-4 py-2.5 sm:py-3 border-b bg-background sm:px-6">
                <div className="space-y-2 sm:space-y-3">
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
                  <Progress value={(wizardStep / totalSteps) * 100} className="h-1.5" />
                </div>
              </div>
            )}

            <DialogBody className="p-4 sm:p-6">
              {/* Step content */}
              {creationMode === 'choice' && !isEditing && renderChoiceScreen()}
              {creationMode === 'smart' && !isEditing && renderSmartScreen()}
              
              {creationMode === 'manual' && (
                <>
                  {wizardStep === 1 && renderStep1()}
                  {promotionType === 'cashback' && wizardStep === 2 && renderCashbackStep()}
                  {((promotionType === 'cashback' && wizardStep === 3) || (promotionType === 'traditional' && wizardStep === 2)) && renderStep2()}
                  {((promotionType === 'cashback' && wizardStep === 4) || (promotionType === 'traditional' && wizardStep === 3)) && renderStep3()}
                </>
              )}
            </DialogBody>

            {/* Navigation (Manual only) */}
            {creationMode === 'manual' && (
              <DialogFooter className="flex-row items-center justify-between border-t bg-background p-4 sm:p-6">
                {wizardStep > 1 ? (
                  <Button variant="outline" onClick={goBack} className="h-10 px-4">
                    <ChevronLeft className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Voltar</span>
                  </Button>
                ) : (
                  <Button variant="outline" onClick={() => isEditing ? setDialogOpen(false) : setCreationMode('choice')} className="h-10 px-4">
                    <ChevronLeft className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Voltar</span>
                  </Button>
                )}

                {wizardStep < totalSteps ? (
                  <Button onClick={goNext} className="h-10 px-4">
                    Próximo<ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={handleSave} className="h-10 px-4 bg-primary text-primary-foreground hover:bg-primary/90">
                    <Check className="h-4 w-4 mr-2" />
                    {isEditing ? 'Salvar Alterações' : 'Criar Promoção'}
                  </Button>
                )}
              </DialogFooter>
            )}

            {creationMode === 'smart' && (
              <DialogFooter className="flex-row items-center justify-start border-t bg-background p-4 sm:p-6">
                <Button variant="outline" onClick={() => setCreationMode('choice')} className="h-10 px-4">
                  <ChevronLeft className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Voltar</span>
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Smart Promotions / Oportunidades */}
      {insights.length > 0 && (
        <Card className="border-dashed border-primary/40 bg-primary/5 mb-6 overflow-hidden relative transition-all duration-300">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4 transition-all duration-500 animate-in fade-in slide-in-from-right-4" key={activeInsightIndex}>
                <div className="bg-white dark:bg-slate-900 p-2.5 rounded-full shadow-sm border border-primary/10">
                  {insights[activeInsightIndex] && (() => {
                    const Icon = insights[activeInsightIndex].icon;
                    return <Icon className="h-5 w-5 text-primary" />;
                  })()}
                </div>
                <div>
                  <h3 className="font-semibold text-sm flex items-center gap-2">
                    {insights[activeInsightIndex].title}
                    {insights.length > 1 && (
                      <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-normal">
                        {activeInsightIndex + 1}/{insights.length}
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-muted-foreground">{insights[activeInsightIndex].description}</p>
                </div>
              </div>
              
              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                {insights.length > 1 && (
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50" 
                      onClick={() => setActiveInsightIndex(prev => (prev - 1 + insights.length) % insights.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 rounded-full hover:bg-white/50 dark:hover:bg-slate-800/50" 
                      onClick={() => setActiveInsightIndex(prev => (prev + 1) % insights.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                
                {insights[activeInsightIndex].buttonLabel && (
                  <Button 
                    size="sm" 
                    className="gap-2 shadow-sm font-medium"
                    onClick={() => applyInsight(insights[activeInsightIndex])}
                  >
                    {insights[activeInsightIndex].buttonLabel}
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
          
          {/* Progress bar for auto-rotation */}
          {insights.length > 1 && (
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-primary/5">
              <div 
                style={{ transitionDuration: '15s', width: '100%' }}
                className="h-full bg-primary/20 transition-all ease-linear"
                key={activeInsightIndex}
              />
            </div>
          )}
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
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
            <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
              {filteredPromotions.map(promo => {
                const remaining = promo.max_slots > 0 ? promo.max_slots - promo.used_slots : null;
                const status = promoVisualStatus(promo, now);
                const svc = services.find(s => s.id === promo.service_id);
                const promoServiceIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
                const promoSvcs = services.filter(s => promoServiceIds.includes(s.id));
                const isHighlighted = promo.id === highlightedPromoId;
                const isCashback = promo.promotion_type === 'cashback';
                const discountLabel = isCashback
                  ? (promo.discount_type === 'percentage' && promo.discount_value
                    ? `${promo.discount_value}% Cashback`
                    : promo.discount_type === 'fixed_amount' && promo.discount_value
                    ? `R$ ${Number(promo.discount_value).toFixed(2)} Cashback`
                    : null)
                  : (promo.discount_type === 'percentage' && promo.discount_value
                    ? `${promo.discount_value}% OFF`
                    : promo.discount_type === 'fixed_amount' && promo.discount_value
                    ? `R$ ${Number(promo.discount_value).toFixed(2)} OFF`
                    : null);

                return (
                  <Card key={promo.id} className={`transition-all duration-500 ${status === 'expired' || status === 'paused' ? 'opacity-70' : ''} ${isHighlighted ? 'ring-2 ring-primary shadow-lg animate-pulse' : ''}`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                          {promo.title}
                          {promo.promotion_mode === 'smart' ? (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary border-primary/20 bg-primary/5 py-0 px-1.5 h-4">🤖 IA</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] uppercase font-bold text-muted-foreground border-muted-foreground/20 bg-muted/30 py-0 px-1.5 h-4">🧩 Manual</Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-1">
                          {renderStatusBadge(promo)}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(promo)}>
                                <Edit2 className="h-4 w-4 mr-2" />Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDuplicate(promo)}>
                                <RefreshCw className="h-4 w-4 mr-2" />Duplicar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => toggleStatus(promo)}>
                                {promo.status === 'active' ? (
                                  <><Pause className="h-4 w-4 mr-2" />Pausar</>
                                ) : (
                                  <><Play className="h-4 w-4 mr-2" />Ativar</>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleEndNow(promo)}>
                                <X className="h-4 w-4 mr-2" />Encerrar agora
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem asChild>
                                <a href={getPromoLink(promo)} target="_blank" rel="noopener noreferrer" className="flex items-center">
                                  <ExternalLink className="h-4 w-4 mr-2" />Ver no Perfil
                                </a>
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(getPromoLink(promo)); toast({ title: 'Link copiado!' }); }}>
                                <Copy className="h-4 w-4 mr-2" />Copiar Link
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => fetchMetrics(promo)}>
                                <BarChart3 className="h-4 w-4 mr-2" />Métricas
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleDelete(promo.id)} className="text-destructive">
                                <Trash2 className="h-4 w-4 mr-2" />Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      {isAdmin && promo.created_by && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Criado por: {professionals.find((p: any) => p.profile_id === promo.created_by)?.profiles?.full_name || 'Admin'}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {promo.description && <p className="text-sm text-muted-foreground">{promo.description}</p>}

                      {/* Type + Discount badge */}
                      <div className="flex flex-wrap gap-1.5">
                        {promo.promotion_mode === 'smart' ? (
                          <Badge className="bg-primary text-primary-foreground border-none flex items-center gap-1 shadow-sm">
                            <Zap className="h-3 w-3 fill-current" /> IA
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-muted-foreground/30 text-muted-foreground flex items-center gap-1">
                            <Edit2 className="h-3 w-3" /> Manual
                          </Badge>
                        )}
                        {isCashback && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800">💰 Cashback</Badge>
                        )}
                        {discountLabel && (
                          <Badge className={isCashback ? 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-primary/10 text-primary border-primary/20'}>{discountLabel}</Badge>
                        )}
                        {isCashback && promo.cashback_validity_days && (
                          <Badge variant="outline" className="text-xs">Validade: {promo.cashback_validity_days} dias</Badge>
                        )}
                      </div>

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
                      <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          {promo.start_date === promo.end_date ? (
                            <span>📅 {format(parseISO(promo.start_date), 'dd/MM/yyyy')}</span>
                          ) : (
                            <span>📅 {format(parseISO(promo.start_date), 'dd/MM/yyyy')} - {format(parseISO(promo.end_date), 'dd/MM/yyyy')}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          {promo.use_business_hours !== false ? (
                            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                              <Clock className="h-3 w-3" /> {status === 'active' ? 'Hoje segue horário comercial' : 'Segue horário comercial'}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-primary font-medium">
                              <Clock className="h-3 w-3" /> 
                              {status === 'active' ? 'Hoje das ' : ''}
                              {promo.start_time?.slice(0, 5)} às {promo.end_time?.slice(0, 5)}
                              {promo.valid_days && promo.valid_days.length < 7 && (
                                <span className="ml-1 text-[10px] opacity-70">({promo.valid_days.length} dias/sem)</span>
                              )}
                            </span>
                          )}
                        </div>
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

                      {/* Link — only for traditional promos */}
                      {!isCashback && promo.slug && (
                        <div className="flex items-center gap-2">
                          <Input readOnly value={getPromoLink(promo)} className="text-xs h-8 bg-muted" />
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => { navigator.clipboard.writeText(getPromoLink(promo)); toast({ title: 'Link copiado!' }); }}>
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}

                      {/* Cashback auto-apply indicator */}
                      {isCashback && status === 'active' && (
                        <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20 p-2 rounded-lg">
                          <Flame className="h-3 w-3" />
                          <span>Cashback aplicado automaticamente ao concluir atendimentos elegíveis</span>
                        </div>
                      )}

                      <div className="flex gap-2 pt-2 flex-wrap">
                        <Button size="sm" onClick={() => fetchFilteredClients(promo)} disabled={status === 'expired'}>
                          <Send className="h-3 w-3 mr-1" />Divulgar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(promo)}>
                          <Edit2 className="h-3 w-3 mr-1" />Editar
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
        <DialogContent className="max-w-3xl p-0 flex flex-col overflow-hidden">
          <DialogHeader>
            <DialogTitle>Clientes — {selectedPromotion?.title}</DialogTitle>
          </DialogHeader>
          <DialogBody className="p-4 sm:p-6">
            {clientsLoading ? (
              <p className="text-muted-foreground py-4">Carregando...</p>
            ) : filteredClients.length === 0 ? (
              <p className="text-muted-foreground py-4">Nenhum cliente encontrado.</p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{filteredClients.length} cliente(s) filtrados</p>
                  {selectedPromotion?.promotion_mode === 'smart' && (
                    <div className="flex items-center gap-2 bg-primary/5 text-primary px-3 py-1.5 rounded-full border border-primary/20 shadow-sm">
                      <Zap className="h-3.5 w-3.5 fill-primary/20" />
                      <span className="text-xs font-semibold">Público sugerido pela IA</span>
                    </div>
                  )}
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs h-8"
                    onClick={() => {
                      setClientsDialogOpen(false);
                      handleEdit(selectedPromotion!);
                      setWizardStep(totalSteps); // Go to last step (filters)
                    }}
                  >
                    Editar filtros manualmente
                  </Button>
                </div>
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
          </DialogBody>
          <DialogFooter className="p-4 sm:p-6 border-t bg-background">
             <Button variant="outline" onClick={() => setClientsDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metrics dialog */}
      <Dialog open={metricsDialogOpen} onOpenChange={setMetricsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Métricas — {selectedPromotion?.title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
      <FeatureIntroModal
        featureKey="promotions"
        open={showIntro}
        onClose={() => { setShowIntro(false); markSeen('promotions'); }}
        onAction={() => setDialogOpen(true)}
      />
    </div>
  );
}
