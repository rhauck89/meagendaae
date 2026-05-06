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
  ChevronRight,
  Loader2,
  Gift
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subDays, startOfWeek, endOfWeek, addDays } from 'date-fns';
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
  actions: {
    label: string;
    icon: any;
    onClick: () => void;
    primary?: boolean;
  }[];
  loading?: boolean;
  empty?: boolean;
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
      
      console.log('[PROMOTION_INSIGHTS_DEBUG]', {
        mode: isAdmin ? 'admin' : 'professional',
        company_id: companyId,
        professional_id: currentProfessionalId
      });

      // Fetch data in parallel
      const fortyFiveDaysAgo = subDays(now, 45);

      const workingHoursQuery = currentProfessionalId
        ? supabase.from('professional_working_hours').select('day_of_week, open_time, close_time, is_closed').eq('professional_id', currentProfessionalId)
        : supabase.from('business_hours').select('day_of_week, open_time, close_time, is_closed').eq('company_id', companyId);

      const [
        clientsRes,
        appointmentsRes,
        servicesRes,
        professionalsRes,
        workingHoursRes
      ] = await Promise.all([
        supabase.from('clients').select('id, name, birth_date, whatsapp').eq('company_id', companyId),
        supabase.from('appointments').select('*').eq('company_id', companyId).neq('status', 'cancelled').gte('start_time', fortyFiveDaysAgo.toISOString()),
        supabase.from('services').select('id, name, price').eq('company_id', companyId).eq('active', true),
        supabase.from('collaborators').select('profile_id, profiles(full_name)').eq('company_id', companyId).eq('active', true),
        workingHoursQuery
      ]);

      const clients = clientsRes.data || [];
      const appointments = appointmentsRes.data || [];
      const services = servicesRes.data || [];
      const professionals = professionalsRes.data || [];
      let workingHours = workingHoursRes.data || [];

      // Fallback if professional has no specific hours
      if (currentProfessionalId && workingHours.length === 0) {
        const { data: bizHours } = await supabase.from('business_hours').select('day_of_week, open_time, close_time, is_closed').eq('company_id', companyId);
        workingHours = bizHours || [];
      }

      // Filter data if professional
      const filteredAppointments = currentProfessionalId 
        ? appointments.filter(a => a.professional_id === currentProfessionalId)
        : appointments;
      
      const filteredClientsIds = currentProfessionalId
        ? new Set(filteredAppointments.map(a => a.client_id))
        : null;

      const filteredClients = filteredClientsIds
        ? clients.filter(c => filteredClientsIds.has(c.id))
        : clients;

      // 1. Clientes sem retorno 30-40 dias
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

      // 2. Clientes inativos +40 dias
      const inactive40 = filteredClients.filter(c => {
        const lastVisit = clientsLastVisit.get(c.id);
        return !lastVisit || lastVisit <= fortyDaysAgo;
      });

      // 3. Aniversariantes do mês
      const currentMonth = now.getMonth() + 1;
      const birthdayClients = filteredClients.filter(c => {
        if (!c.birth_date) return false;
        const bMonth = parseInt(c.birth_date.split('-')[1]);
        return bMonth === currentMonth;
      });

      // 4 & 5. Serviços mais/menos contratados (last 30 days)
      const last30DaysAppts = filteredAppointments.filter(a => new Date(a.start_time) >= thirtyDaysAgo);
      const serviceCounts = new Map<string, number>();
      last30DaysAppts.forEach(a => {
        const serviceId = (a as any).service_id;
        if (!serviceId) return;
        serviceCounts.set(serviceId, (serviceCounts.get(serviceId) || 0) + 1);
      });


      const sortedServices = Array.from(serviceCounts.entries())
        .map(([id, count]) => ({ id, count, name: services.find(s => s.id === id)?.name || 'Serviço' }))
        .sort((a, b) => b.count - a.count);

      const topService = sortedServices[0];
      const bottomService = sortedServices.length > 1 ? sortedServices[sortedServices.length - 1] : null;

      // 6. Dia mais ocioso (last 4 weeks)
      const last4WeeksAppts = filteredAppointments.filter(a => new Date(a.start_time) >= subDays(now, 28));
      const dayCounts = new Array(7).fill(0);
      last4WeeksAppts.forEach(a => {
        const day = new Date(a.start_time).getDay();
        dayCounts[day]++;
      });

      const daysOfWeek = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const openDays = new Set(workingHours.filter((h: any) => !h.is_closed).map((h: any) => h.day_of_week));
      
      console.log('[PROMOTION_INSIGHTS_LOW_DAY_DEBUG]', {
        openDaysDetected: Array.from(openDays).map(d => daysOfWeek[d]),
        allDayCounts: dayCounts.map((count, idx) => `${daysOfWeek[idx]}: ${count}`),
        workingHours: workingHours.map((h: any) => ({ day: daysOfWeek[h.day_of_week], closed: h.is_closed }))
      });

      let idleDayIdx = -1;
      let minCount = Infinity;
      
      // Only consider days that are open
      for (let i = 0; i < 7; i++) {
        if (openDays.has(i)) {
          const count = dayCounts[i];
          if (count < minCount) {
            minCount = count;
            idleDayIdx = i;
          }
        } else {
          console.log(`[PROMOTION_INSIGHTS_LOW_DAY_DEBUG] Ignorando ${daysOfWeek[i]} pois está fechado.`);
        }
      }

      // Calculate occupancy rate for the idle day
      let occupancyInfo = "Sem dados suficientes";
      let recommendedPeriod = { start: '09:00', end: '12:00' };
      
      if (idleDayIdx !== -1) {
        const dayAppts = last4WeeksAppts.filter(a => new Date(a.start_time).getDay() === idleDayIdx);
        const morningAppts = dayAppts.filter(a => new Date(a.start_time).getHours() < 13).length;
        const afternoonAppts = dayAppts.filter(a => new Date(a.start_time).getHours() >= 13).length;
        
        // If morning has more appointments, afternoon is more idle (and vice versa)
        if (morningAppts > afternoonAppts) {
          recommendedPeriod = { start: '13:00', end: '18:00' };
        } else {
          recommendedPeriod = { start: '09:00', end: '13:00' };
        }

        const dayHours = workingHours.find((h: any) => h.day_of_week === idleDayIdx);
        if (dayHours && (dayHours as any).open_time && (dayHours as any).close_time) {
          const [openH, openM] = (dayHours as any).open_time.split(':').map(Number);
          const [closeH, closeM] = (dayHours as any).close_time.split(':').map(Number);
          const totalMin = (closeH * 60 + closeM) - (openH * 60 + openM);
          const capacity = Math.max(1, Math.floor(totalMin / 45)); 
          const avgDailyAppts = minCount / 4;
          const rate = Math.round((avgDailyAppts / capacity) * 100);
          const vacantSlots = Math.max(0, capacity - Math.round(avgDailyAppts));
          occupancyInfo = `${rate}% de ocupação (${vacantSlots} vagas livres em média)`;
        } else {
          occupancyInfo = `${Math.round(minCount / 4)} agendamentos em média`;
        }
      }

      console.log('[PROMOTION_INSIGHTS_LOW_DAY_DEBUG] Resultado Final:', {
        diaEscolhido: idleDayIdx !== -1 ? daysOfWeek[idleDayIdx] : 'Nenhum',
        minAppts: minCount,
        occupancyInfo,
        initialValuesSugeridos: idleDayIdx !== -1 ? {
          insight: 'idle_day',
          validDays: [idleDayIdx],
          startTime: recommendedPeriod.start,
          endTime: recommendedPeriod.end
        } : null
      });

      // 7. Profissional mais ocioso (next 7 days)
      // This is more complex as it requires availability checking
      // For this phase, let's use a simpler heuristic: professional with fewest appts in next 7 days
      const next7Days = addDays(now, 7);
      const nextAppts = appointments.filter(a => {
        const d = new Date(a.start_time);
        return d >= now && d <= next7Days;
      });

      const profApptCounts = new Map<string, number>();
      professionals.forEach(p => profApptCounts.set(p.profile_id, 0));
      nextAppts.forEach(a => {
        if (profApptCounts.has(a.professional_id)) {
          profApptCounts.set(a.professional_id, profApptCounts.get(a.professional_id)! + 1);
        }
      });

      const sortedProfs = Array.from(profApptCounts.entries())
        .map(([id, count]) => ({ 
          id, 
          count, 
          name: (professionals.find((p: any) => p.profile_id === id) as any)?.profiles?.full_name || 'Profissional' 
        }))
        .sort((a, b) => a.count - b.count);

      const idleProf = isAdmin ? sortedProfs[0] : (profApptCounts.has(profile?.id || '') ? { id: profile!.id, count: profApptCounts.get(profile!.id)!, name: 'Sua Agenda' } : null);

      const newInsights: InsightData[] = [
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
              label: 'Ver Clientes / Campanha', 
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
          id: 'inactive_40',
          title: 'Clientes Inativos (+40 dias)',
          description: 'Risco alto de perda. Necessário reativação.',
          icon: TrendingDown,
          value: inactive40.length,
          subValue: 'inativos',
          empty: inactive40.length === 0,
          actions: [
            { 
              label: 'Recuperar com WhatsApp', 
              icon: MessageCircle, 
              onClick: () => onAction('campaign', { insight: 'reactivation_40', clients: inactive40 }),
              primary: true 
            },
            { 
              label: 'Cashback de Retorno', 
              icon: Zap, 
              onClick: () => onAction('promotion', { type: 'cashback', insight: 'reactivation', filter: 'inactive', filterValue: 45 }) 
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
            },
            { 
              label: 'Promoção de Aniversário', 
              icon: Tag, 
              onClick: () => onAction('promotion', { insight: 'birthdays', filter: 'birthday_month' }) 
            }
          ]
        },
        {
          id: 'top_service',
          title: 'Serviço em Alta',
          description: 'O mais procurado nos últimos 30 dias.',
          icon: TrendingUp,
          value: topService?.name || '---',
          subValue: topService ? `${topService.count} agendamentos` : 'Sem dados',
          empty: !topService,
          actions: [
            { 
              label: 'Promoção p/ Impulsionar', 
              icon: Tag, 
              onClick: () => onAction('promotion', { serviceId: topService?.id }),
              primary: true 
            }
          ]
        },
        {
          id: 'idle_day',
          title: 'Dia com Menos Movimento',
          description: 'Considerando apenas dias de atendimento.',
          icon: Calendar,
          value: idleDayIdx !== -1 ? daysOfWeek[idleDayIdx] : '---',
          subValue: occupancyInfo,
          empty: idleDayIdx === -1,
          actions: [
            { 
              label: 'Criar Promoção p/ este Dia', 
              icon: Clock, 
              onClick: () => onAction('promotion', { 
                insight: 'idle_day',
                validDays: [idleDayIdx],
                startTime: recommendedPeriod.start,
                endTime: recommendedPeriod.end
              }),
              primary: true 
            }
          ]
        },
        {
          id: 'idle_professional',
          title: isAdmin ? 'Profissional mais Ocioso' : 'Ociosidade da sua Agenda',
          description: 'Próximos 7 dias.',
          icon: User,
          value: idleProf?.name || '---',
          subValue: idleProf ? `${idleProf.count} agendamentos previstos` : 'Sem dados',
          empty: !idleProf,
          actions: [
            { 
              label: isAdmin ? 'Promover Profissional' : 'Promover minha Agenda', 
              icon: Zap, 
              onClick: () => onAction('promotion', { professionalId: idleProf?.id }),
              primary: true 
            },
            { 
              label: 'Divulgar Link', 
              icon: ExternalLink, 
              onClick: () => onAction('link', { professionalId: idleProf?.id }) 
            }
          ]
        }
      ];

      setInsights(newInsights);
      
      console.log('[PROMOTION_INSIGHTS_DEBUG] Totais:', {
        reactivation: reactivation3040.length,
        inactive: inactive40.length,
        birthdays: birthdayClients.length,
        topService: topService?.name
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
        <p className="text-muted-foreground animate-pulse">Analisando dados da sua empresa...</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {insights.map((insight) => (
        <Card key={insight.id} className={cn(
          "overflow-hidden transition-all hover:shadow-md border-border/50",
          insight.empty && "opacity-80"
        )}>
          <CardHeader className="pb-2 space-y-1">
            <div className="flex items-center justify-between">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <insight.icon className="h-5 w-5" />
              </div>
              {insight.empty && <Badge variant="secondary" className="text-[10px] h-5">Sem Dados</Badge>}
            </div>
            <CardTitle className="text-base font-bold pt-2">{insight.title}</CardTitle>
            <p className="text-xs text-muted-foreground line-clamp-1">{insight.description}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="pt-2">
              <div className="text-2xl font-black text-foreground">{insight.value}</div>
              <div className="text-xs text-muted-foreground font-medium">{insight.subValue}</div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              {insight.actions.map((action, idx) => (
                <Button
                  key={idx}
                  variant={action.primary ? "default" : "outline"}
                  size="sm"
                  className={cn(
                    "w-full justify-between h-9 text-xs font-bold",
                    action.primary ? "shadow-sm" : "border-primary/20 hover:bg-primary/5"
                  )}
                  onClick={action.onClick}
                  disabled={insight.empty}
                >
                  <span className="flex items-center gap-2">
                    <action.icon className="h-3.5 w-3.5" />
                    {action.label}
                  </span>
                  <ChevronRight className="h-3 w-3 opacity-50" />
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
