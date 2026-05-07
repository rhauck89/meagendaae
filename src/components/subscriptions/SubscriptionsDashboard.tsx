import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  DollarSign,
  AlertCircle,
  Calendar,
  TrendingUp,
  Clock,
} from 'lucide-react';
import { format, isToday, isThisWeek, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface SubscriptionsDashboardProps {
  companyId: string;
}

export function SubscriptionsDashboard({ companyId }: SubscriptionsDashboardProps) {
  const [stats, setStats] = useState({
    activeSubscribers: 0,
    mrr: 0,
    overdueCount: 0,
    vencemHoje: 0,
    vencemSemana: 0,
    previstoMes: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchStats();
    }

    const handleRefresh = () => fetchStats();
    window.addEventListener('refresh-subscription-dashboard', handleRefresh);
    return () => window.removeEventListener('refresh-subscription-dashboard', handleRefresh);
  }, [companyId]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 1. Get active subscribers and MRR
      const { data: subscribers } = await supabase
        .from('client_subscriptions')
        .select(`
          status,
          billing_cycle,
          subscription_plans(price_monthly, price_yearly)
        `)
        .eq('company_id', companyId)
        .eq('status', 'active');

      let activeCount = 0;
      let calculatedMrr = 0;

      subscribers?.forEach((sub: any) => {
        activeCount++;
        const monthlyPrice = Number(sub.subscription_plans?.price_monthly || 0);
        const yearlyPrice = Number(sub.subscription_plans?.price_yearly || 0);
        
        if (sub.billing_cycle === 'monthly') {
          calculatedMrr += monthlyPrice;
        } else {
          calculatedMrr += (yearlyPrice / 12);
        }
      });

      // 2. Get charges stats
      const { data: charges } = await supabase
        .from('subscription_charges')
        .select('status, due_date, amount')
        .eq('company_id', companyId);

      let overdue = 0;
      let hoje = 0;
      let semana = 0;
      let previsto = 0;

      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      charges?.forEach((charge: any) => {
        const dueDate = parseISO(charge.due_date);
        const amount = Number(charge.amount);

        if (charge.status === 'overdue' || (charge.status === 'pending' && dueDate < now && !isToday(dueDate))) {
          overdue++;
        }

        if (isToday(dueDate) && charge.status !== 'paid') {
          hoje++;
        }

        if (isThisWeek(dueDate) && charge.status !== 'paid') {
          semana++;
        }

        if (dueDate >= monthStart && dueDate <= monthEnd) {
          previsto += amount;
        }
      });

      setStats({
        activeSubscribers: activeCount,
        mrr: calculatedMrr,
        overdueCount: overdue,
        vencemHoje: hoje,
        vencemSemana: semana,
        previstoMes: previsto,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const dashboardCards = [
    {
      title: 'Assinantes Ativos',
      value: stats.activeSubscribers,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Total de assinaturas ativas',
    },
    {
      title: 'Receita Recorrente (MRR)',
      value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: TrendingUp,
      color: 'bg-green-500',
      description: 'Faturamento mensal estimado',
    },
    {
      title: 'Previsto este Mês',
      value: `R$ ${stats.previstoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-primary',
      description: 'Total em cobranças este mês',
    },
    {
      title: 'Em Atraso',
      value: stats.overdueCount,
      icon: AlertCircle,
      color: 'bg-destructive',
      description: 'Cobranças vencidas pendentes',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {dashboardCards.map((card, i) => (
          <Card key={i} className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{card.title}</p>
                    <h3 className="text-2xl font-bold">{loading ? '...' : card.value}</h3>
                  </div>
                  <div className={`p-2 rounded-lg ${card.color} bg-opacity-10`}>
                    <card.icon className={`h-5 w-5 ${card.color.replace('bg-', 'text-')}`} />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-2">{card.description}</p>
              </div>
              <div className={`h-1 w-full ${card.color}`}></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-none shadow-sm bg-muted/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-amber-100">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <h3 className="font-semibold text-lg">Alertas de Vencimento</h3>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-muted">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Vencem Hoje</span>
                  <span className="text-xs text-muted-foreground">Cobranças pendentes</span>
                </div>
                <Badge variant={stats.vencemHoje > 0 ? "destructive" : "secondary"} className="text-sm px-3">
                  {stats.vencemHoje}
                </Badge>
              </div>
              <div className="flex justify-between items-center p-3 bg-background rounded-lg border border-muted">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">Vencem esta Semana</span>
                  <span className="text-xs text-muted-foreground">Próximos 7 dias</span>
                </div>
                <Badge variant="secondary" className="text-sm px-3">
                  {stats.vencemSemana}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm bg-muted/10">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-full bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">Resumo Mensal</h3>
            </div>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                O faturamento de assinaturas representa uma base sólida para o seu negócio. 
                Mantenha as cobranças em dia para garantir o fluxo de caixa.
              </p>
              <div className="pt-2">
                <div className="flex justify-between text-xs mb-1">
                  <span>Meta de Conversão</span>
                  <span>75%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div className="bg-primary h-full w-[75%]"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
