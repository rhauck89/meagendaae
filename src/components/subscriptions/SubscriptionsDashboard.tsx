import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { AlertCircle, Calendar, Clock, DollarSign, TrendingUp, Users } from 'lucide-react';
import { endOfMonth, isThisWeek, isToday, parseISO, startOfMonth } from 'date-fns';

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

        calculatedMrr += sub.billing_cycle === 'monthly' ? monthlyPrice : yearlyPrice / 12;
      });

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
      title: 'Receita recorrente (MRR)',
      value: `R$ ${stats.mrr.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      color: 'bg-violet-600',
      description: 'Base mensal estimada',
    },
    {
      title: 'Assinantes ativos',
      value: stats.activeSubscribers,
      icon: Users,
      color: 'bg-blue-500',
      description: 'Clientes recorrentes',
    },
    {
      title: 'Em atraso',
      value: stats.overdueCount,
      icon: AlertCircle,
      color: 'bg-amber-500',
      description: 'Cobranças pendentes',
    },
    {
      title: 'Vencem esta semana',
      value: stats.vencemSemana,
      icon: Calendar,
      color: 'bg-green-600',
      description: `${stats.vencemHoje} vencem hoje`,
    },
    {
      title: 'Crescimento',
      value: '+0%',
      icon: TrendingUp,
      color: 'bg-teal-500',
      description: 'vs mês anterior',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {dashboardCards.map((card, i) => (
          <Card key={i} className="overflow-hidden rounded-2xl border-slate-200 bg-white shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-start gap-4">
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${card.color} text-white shadow-sm`}>
                  <card.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">{card.title}</p>
                  <h3 className="mt-1 text-2xl font-bold tracking-tight">{loading ? '...' : card.value}</h3>
                  <p className="mt-2 text-[11px] text-muted-foreground">{card.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
        <CardContent className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-500" />
              <h3 className="font-semibold">Alertas importantes</h3>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">{stats.vencemHoje} assinaturas vencem hoje</p>
              <p className="mt-1 text-xs text-muted-foreground">Acesse para ver quais são</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">{stats.overdueCount} clientes com atraso</p>
              <p className="mt-1 text-xs text-muted-foreground">Acompanhe tolerância e suspensão</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-sm font-semibold">
                R$ {stats.previstoMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} previstos este mês
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Receita recorrente prevista</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
