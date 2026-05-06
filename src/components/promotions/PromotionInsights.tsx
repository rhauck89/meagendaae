import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  User, 
  MessageCircle, 
  Tag, 
  Zap, 
  ExternalLink,
  Loader2,
  Gift,
  Flame,
  CalendarCheck
} from 'lucide-react';
import { format, parseISO, subDays, addDays, startOfDay, endOfDay, isAfter, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from '@/hooks/use-toast';
import { getAvailableSlots } from '@/lib/availability-service';
import { cn } from '@/lib/utils';

interface InsightData {
  id: string;
  title: string;
  description: string;
  icon: any;
  value: string | number;
  subValue?: string;
  examples?: string[];
  actions: {
    label: string;
    icon: any;
    onClick: () => void;
    primary?: boolean;
    disabled?: boolean;
    badge?: string;
  }[];
  loading?: boolean;
  empty?: boolean;
  highlight?: boolean;
}

interface PromotionInsightsProps {
  isAdmin: boolean;
  onAction: (type: 'promotion' | 'campaign' | 'link', data?: any) => void;
}

export function PromotionInsights({ isAdmin, onAction }: PromotionInsightsProps) {
  const { companyId, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<InsightData[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchInsights();
    }
  }, [companyId, isAdmin, profile?.id]);

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const currentProfessionalId = isAdmin ? null : profile?.id;
      
      // Fetch basic data
      const fortyFiveDaysAgo = subDays(now, 45);

      const [
        clientsRes,
        appointmentsRes,
        servicesRes,
        professionalsRes,
        workingHoursRes
      ] = await Promise.all([
        supabase.from('clients').select('id, name, birth_date, whatsapp').eq('company_id', companyId),
        supabase.from('appointments').select('*').eq('company_id', companyId).neq('status', 'cancelled').gte('start_time', fortyFiveDaysAgo.toISOString()),
        supabase.from('services').select('id, name, price, duration_minutes').eq('company_id', companyId).eq('active', true),
        supabase.from('collaborators').select('profile_id, profiles(full_name)').eq('company_id', companyId).eq('active', true),
        isAdmin 
          ? supabase.from('business_hours').select('day_of_week, open_time, close_time, is_closed').eq('company_id', companyId)
          : supabase.from('professional_working_hours').select('day_of_week, open_time, close_time, is_closed').eq('professional_id', profile?.id)
      ]);

      const clients = clientsRes.data || [];
      const appointments = appointmentsRes.data || [];
      const services = servicesRes.data || [];
      const professionals = professionalsRes.data || [];
      let workingHours = workingHoursRes.data || [];

      // Fallback for professional hours
      if (!isAdmin && workingHours.length === 0) {
        const { data: bizHours } = await supabase.from('business_hours').select('day_of_week, open_time, close_time, is_closed').eq('company_id', companyId);
        workingHours = bizHours || [];
      }

      // Filter data for professional context
      const filteredAppointments = currentProfessionalId 
        ? appointments.filter(a => a.professional_id === currentProfessionalId)
        : appointments;
      
      const filteredClientsIds = currentProfessionalId
        ? new Set(filteredAppointments.map(a => a.client_id))
        : null;

      const filteredClients = filteredClientsIds
        ? clients.filter(c => filteredClientsIds.has(c.id))
        : clients;

      // 1. Gaps Analysis (Today and Week)
      const calculateGaps = async (days: number) => {
        const gaps: { date: string; slots: string[]; professionalId: string }[] = [];
        const professionalList = isAdmin ? professionals.map(p => p.profile_id) : [profile?.id].filter(Boolean);
        const minDuration = services.length > 0 ? Math.min(...services.map(s => s.duration_minutes)) : 30;
        
        for (let i = 0; i < days; i++) {
          const targetDate = addDays(now, i);
          const dateStr = format(targetDate, 'yyyy-MM-dd');
          
          for (const profId of professionalList) {
            const result = await getAvailableSlots({
              source: 'public',
              companyId: companyId!,
              professionalId: profId as string,
              date: targetDate,
              totalDuration: minDuration,
              filterPastForToday: true
            });
            
            if (result.slots.length > 0) {
              gaps.push({ date: dateStr, slots: result.slots, professionalId: profId as string });
            }
          }
        }
        return gaps;
      };

      const gapsToday = await calculateGaps(1);
      const gapsWeek = await calculateGaps(7);

      const totalSlotsToday = gapsToday.reduce((acc, curr) => acc + curr.slots.length, 0);
      const totalSlotsWeek = gapsWeek.reduce((acc, curr) => acc + curr.slots.length, 0);

      // Example slots for display
      const todayExamples = gapsToday.flatMap(g => g.slots).slice(0, 3);
      const weekExamples = gapsWeek
        .filter(g => format(parseISO(g.date), 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd'))
        .flatMap(g => g.slots.map(s => `${format(parseISO(g.date), 'EEE', { locale: ptBR })} ${s}`))
        .slice(0, 3);

      // 2. Client Retention Analysis
      const thirtyDaysAgo = subDays(now, 30);
      const fortyDaysAgo = subDays(now, 40);

      const clientsLastVisit = new Map<string, Date>();
      filteredAppointments.forEach(a => {
        if (!a.client_id) return;
        const d = new Date(a.start_time);
        if (!clientsLastVisit.has(a.client_id) || d > clientsLastVisit.get(a.client_id)!) {
          clientsLastVisit.set(a.client_id, d);
        }
      });

      const reactivation3040 = filteredClients.filter(c => {
        const lastVisit = clientsLastVisit.get(c.id);
        return lastVisit && lastVisit <= thirtyDaysAgo && lastVisit > fortyDaysAgo;
      });

      const inactive40 = filteredClients.filter(c => {
        const lastVisit = clientsLastVisit.get(c.id);
        return !lastVisit || lastVisit <= fortyDaysAgo;
      });

      // 3. Birthdays
      const currentMonth = now.getMonth() + 1;
      const birthdayClients = filteredClients.filter(c => {
        if (!c.birth_date) return false;
        const bMonth = parseInt(c.birth_date.split('-')[1]);
        return bMonth === currentMonth;
      });

      // 4. Idle Day (Pattern Recognition)
      const last4WeeksAppts = filteredAppointments.filter(a => new Date(a.start_time) >= subDays(now, 28));
      const dayCounts = new Array(7).fill(0);
      last4WeeksAppts.forEach(a => {
        const day = new Date(a.start_time).getDay();
        dayCounts[day]++;
      });

      const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const openDays = new Set(workingHours.filter((h: any) => !h.is_closed).map((h: any) => h.day_of_week));
      
      let idleDayIdx = -1;
      let minCount = Infinity;
      for (let i = 0; i < 7; i++) {
        if (openDays.has(i)) {
          if (dayCounts[i] < minCount) {
            minCount = dayCounts[i];
            idleDayIdx = i;
          }
        }
      }

      // Action Handlers
      const handleRelampago = () => {
        if (totalSlotsToday === 0) return;
        const firstGap = gapsToday[0];
        onAction('promotion', {
          insight: 'today_gap',
          title: 'Relâmpago de Hoje',
          description: 'Aproveite nossos últimos horários disponíveis para hoje com uma condição especial.',
          startDate: firstGap.date,
          endDate: firstGap.date,
          startTime: firstGap.slots[0],
          endTime: firstGap.slots[firstGap.slots.length - 1],
          professionalId: isAdmin ? (gapsToday.length === 1 ? firstGap.professionalId : null) : profile?.id,
          messageTemplate: `Olá {{cliente_primeiro_nome}}! 👋\n\nNotamos que temos alguns horários disponíveis para HOJE na *{{empresa_nome}}*! 🎉\n\nQue tal aproveitar para dar aquele trato com um desconto especial?\n\nDisponível hoje: ${todayExamples.join(', ')}\n\nGaranta sua vaga:\n{{link_promocao}}`,
          singleDay: true
        });
      };

      const handleWeekFill = () => {
        if (totalSlotsWeek === 0) return;
        const firstGap = gapsWeek[0];
        const lastGap = gapsWeek[gapsWeek.length - 1];
        onAction('promotion', {
          insight: 'week_gap',
          title: 'Agenda Especial da Semana',
          description: 'Garanta seu horário nesta semana e aproveite benefícios exclusivos.',
          startDate: firstGap.date,
          endDate: lastGap.date,
          startTime: '09:00',
          endTime: '19:00',
          professionalId: isAdmin ? null : profile?.id,
          messageTemplate: `Olá {{cliente_primeiro_nome}}! 👋\n\nAproveite nossa agenda da semana na *{{empresa_nome}}*! 🎉\n\nPreparamos uma condição especial para você realizar seu serviço nos próximos dias.\n\nReserve agora:\n{{link_promocao}}`
        });
      };

      const newInsights: InsightData[] = [
        {
          id: 'gaps_today',
          title: 'Lacunas de Hoje',
          description: totalSlotsToday > 0 ? `Você tem ${totalSlotsToday} horários livres hoje.` : 'Agenda cheia para hoje.',
          icon: Flame,
          value: totalSlotsToday,
          subValue: totalSlotsToday === 1 ? 'horário vago' : 'horários vagos',
          examples: todayExamples,
          highlight: totalSlotsToday > 0,
          empty: totalSlotsToday === 0,
          actions: [
            { label: 'Criar Promoção Relâmpago', icon: Zap, onClick: handleRelampago, primary: true, disabled: totalSlotsToday === 0 },
            { label: 'Pontos em Dobro', icon: Gift, onClick: () => {}, badge: 'Em breve', disabled: true },
            { label: 'Notificar no WhatsApp', icon: MessageCircle, onClick: () => onAction('campaign', { insight: 'today_gap', type: 'whatsapp' }), disabled: totalSlotsToday === 0 }
          ]
        },
        {
          id: 'gaps_week',
          title: 'Lacunas da Semana',
          description: `Total de ${totalSlotsWeek} horários nos próximos 7 dias.`,
          icon: CalendarCheck,
          value: totalSlotsWeek,
          subValue: 'vagas na semana',
          examples: weekExamples,
          highlight: totalSlotsWeek > 5,
          empty: totalSlotsWeek === 0,
          actions: [
            { label: 'Preencher Agenda', icon: Tag, onClick: handleWeekFill, primary: true, disabled: totalSlotsWeek === 0 },
            { label: 'Cashback em Dobro', icon: Wallet, onClick: () => {}, badge: 'Em breve', disabled: true } as any
          ]
        },
        {
          id: 'reactivation_3040',
          title: 'Clientes Sumidos (30-40 dias)',
          description: 'Clientes que não aparecem há mais de um mês.',
          icon: Users,
          value: reactivation3040.length,
          subValue: 'clientes',
          empty: reactivation3040.length === 0,
          actions: [
            { 
              label: 'Enviar Campanha', 
              icon: MessageCircle, 
              onClick: () => onAction('campaign', { insight: 'reactivation_30', clients: reactivation3040 }),
              primary: true 
            },
            { 
              label: 'Nova Promoção', 
              icon: Tag, 
              onClick: () => onAction('promotion', { insight: 'reactivation', filter: 'inactive', filterValue: 30 }) 
            }
          ]
        },
        {
          id: 'birthdays',
          title: 'Aniversariantes do Mês',
          description: `Temos ${birthdayClients.length} clientes celebrando este mês.`,
          icon: Gift,
          value: birthdayClients.length,
          subValue: 'aniversariantes',
          empty: birthdayClients.length === 0,
          actions: [
            { 
              label: 'Enviar Parabéns', 
              icon: MessageCircle, 
              onClick: () => onAction('campaign', { insight: 'birthdays', clients: birthdayClients }),
              primary: true 
            }
          ]
        },
        {
          id: 'idle_day',
          title: 'Oportunidade de Agenda',
          description: 'Padrão recorrente de menor movimento.',
          icon: Calendar,
          value: idleDayIdx !== -1 ? `${daysOfWeek[idleDayIdx]}` : '---',
          subValue: 'dia mais ocioso',
          empty: idleDayIdx === -1,
          actions: [
            { 
              label: 'Criar Promoção p/ este Dia', 
              icon: Clock, 
              onClick: () => onAction('promotion', { 
                insight: 'idle_day',
                validDays: [idleDayIdx],
                startTime: '09:00',
                endTime: '13:00'
              }),
              primary: true 
            }
          ]
        }
      ];

      setInsights(newInsights);
      
      console.log('[PROMOTION_GAP_INSIGHTS_DEBUG]', {
        professional_id: profile?.id,
        company_id: companyId,
        lacunas_hoje: totalSlotsToday,
        lacunas_semana: totalSlotsWeek,
        exemplos_hoje: todayExamples,
        is_admin: isAdmin
      });

    } catch (error) {
      console.error('Error fetching insights:', error);
      toast({ title: 'Erro ao carregar insights', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground animate-pulse">Analisando disponibilidade da sua agenda...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {insights.map((insight) => (
        <Card key={insight.id} className={cn(
          "overflow-hidden transition-all hover:shadow-md border-border/50",
          insight.highlight && "ring-1 ring-primary/20 bg-primary/5",
          insight.empty && "opacity-80"
        )}>
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className={cn(
                "p-2 rounded-lg",
                insight.highlight ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
              )}>
                <insight.icon className="h-5 w-5" />
              </div>
              {insight.empty && <Badge variant="secondary" className="text-[10px] h-5">Sem Vagas</Badge>}
            </div>
            <CardTitle className="text-base font-bold pt-2">{insight.title}</CardTitle>
            <p className="text-xs text-muted-foreground line-clamp-1">{insight.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="pt-2 flex justify-between items-end">
              <div>
                <div className="text-2xl font-black text-foreground">{insight.value}</div>
                <div className="text-xs text-muted-foreground font-medium">{insight.subValue}</div>
              </div>
              {insight.examples && insight.examples.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                  {insight.examples.map((ex, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] h-5 px-1 bg-background/50 border-primary/20">
                      {ex}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {insight.actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.primary ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full justify-start text-xs font-semibold h-9",
                    !action.primary && "border-primary/20 hover:bg-primary/5"
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    action.onClick();
                  }}
                  disabled={action.disabled}
                >
                  <action.icon className="mr-2 h-3.5 w-3.5" />
                  {action.label}
                  {action.badge && (
                    <Badge variant="secondary" className="ml-auto text-[8px] h-4 uppercase tracking-tighter px-1">
                      {action.badge}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Add Wallet to icons mapping since it's used for cashback
const Wallet = ({ className }: { className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width="24" 
    height="24" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);
