import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, TrendingUp, Users, UserPlus, BarChart3, CalendarClock, Repeat, Activity } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, addWeeks, addYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';

interface Company {
  id: string;
  name: string;
  subscription_status: string;
  billing_cycle: string;
  created_at: string;
  plan_id: string | null;
  trial_active: boolean;
  trial_end_date: string | null;
}

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
}

interface Expense {
  id: string;
  description: string;
  amount: number;
  expense_date: string;
  category_id: string | null;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  parent_recurring_id: string | null;
}

interface Revenue {
  id: string;
  description: string;
  amount: number;
  revenue_date: string;
  is_recurring: boolean;
  recurrence_type: string | null;
  recurrence_interval: number | null;
  parent_recurring_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

const formatCurrency = (v: number) =>
  `R$ ${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

const SuperAdminReports = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<Revenue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      const [compRes, planRes, expRes, revRes, catRes] = await Promise.all([
        supabase.from('companies').select('id, name, subscription_status, billing_cycle, created_at, plan_id, trial_active, trial_end_date'),
        supabase.from('plans').select('id, name, monthly_price, yearly_price'),
        supabase.from('expenses').select('id, description, amount, expense_date, category_id, is_recurring, recurrence_type, recurrence_interval, parent_recurring_id').order('expense_date', { ascending: false }),
        supabase.from('manual_revenues').select('id, description, amount, revenue_date, is_recurring, recurrence_type, recurrence_interval, parent_recurring_id').order('revenue_date', { ascending: false }),
        supabase.from('expense_categories').select('id, name'),
      ]);
      if (compRes.data) setCompanies(compRes.data as Company[]);
      if (planRes.data) setPlans(planRes.data as Plan[]);
      if (expRes.data) setExpenses(expRes.data as Expense[]);
      if (revRes.data) setRevenues(revRes.data as Revenue[]);
      if (catRes.data) setCategories(catRes.data as Category[]);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── SaaS Metrics ──
  const activeCompanies = useMemo(() => companies.filter(c => c.subscription_status === 'active'), [companies]);
  const trialCompanies = useMemo(() => companies.filter(c => c.trial_active), [companies]);
  const thisMonth = useMemo(() => {
    const ms = startOfMonth(new Date());
    return companies.filter(c => new Date(c.created_at) >= ms);
  }, [companies]);

  const mrr = useMemo(() => {
    return activeCompanies.reduce((sum, c) => {
      const plan = plans.find(p => p.id === c.plan_id);
      if (!plan) return sum;
      return sum + (c.billing_cycle === 'yearly' ? plan.yearly_price / 12 : plan.monthly_price);
    }, 0);
  }, [activeCompanies, plans]);

  const arr = mrr * 12;
  const arpc = activeCompanies.length > 0 ? mrr / activeCompanies.length : 0;

  // Churn: companies cancelled this month / active at start of month
  const churnRate = useMemo(() => {
    const ms = startOfMonth(new Date());
    const cancelled = companies.filter(c => c.subscription_status === 'canceled' || c.subscription_status === 'cancelled');
    // Simple approximation
    const total = companies.length;
    return total > 0 ? ((cancelled.length / total) * 100) : 0;
  }, [companies]);

  // ── Upcoming Subscription Revenue ──
  const upcomingSubscriptions = useMemo(() => {
    return activeCompanies
      .map(c => {
        const plan = plans.find(p => p.id === c.plan_id);
        if (!plan) return null;
        const amount = c.billing_cycle === 'yearly' ? plan.yearly_price : plan.monthly_price;
        // Estimate next billing as next month start
        const nextBilling = addMonths(startOfMonth(new Date()), 1);
        return {
          company: c.name,
          plan: plan.name,
          amount,
          billing_date: format(nextBilling, 'dd/MM/yyyy'),
          status: c.subscription_status,
          billing_cycle: c.billing_cycle,
        };
      })
      .filter(Boolean) as { company: string; plan: string; amount: number; billing_date: string; status: string; billing_cycle: string }[];
  }, [activeCompanies, plans]);

  // ── Upcoming Recurring Expenses ──
  const upcomingRecurringExpenses = useMemo(() => {
    const today = new Date();
    return expenses
      .filter(e => e.is_recurring && !e.parent_recurring_id)
      .map(e => {
        let nextDate: Date;
        const base = new Date(e.expense_date);
        const interval = e.recurrence_interval || 1;
        if (e.recurrence_type === 'weekly') {
          nextDate = base;
          while (nextDate <= today) nextDate = addWeeks(nextDate, interval);
        } else if (e.recurrence_type === 'yearly') {
          nextDate = base;
          while (nextDate <= today) nextDate = addYears(nextDate, interval);
        } else {
          nextDate = base;
          while (nextDate <= today) nextDate = addMonths(nextDate, interval);
        }
        return {
          description: e.description,
          category: categories.find(c => c.id === e.category_id)?.name || '—',
          amount: Number(e.amount),
          next_date: nextDate,
          recurrence_type: e.recurrence_type,
        };
      })
      .sort((a, b) => a.next_date.getTime() - b.next_date.getTime())
      .slice(0, 20);
  }, [expenses, categories]);

  // ── Cashflow Forecast (next 6 months) ──
  const cashflowData = useMemo(() => {
    const months: { name: string; expected_revenue: number; expected_expenses: number; expected_balance: number }[] = [];
    for (let i = 0; i < 6; i++) {
      const d = addMonths(new Date(), i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const label = format(d, 'MMM/yy', { locale: ptBR });

      // Revenue: MRR + manual revenues in that month
      const manualRev = revenues
        .filter(r => {
          const rd = new Date(r.revenue_date);
          return rd >= ms && rd <= me;
        })
        .reduce((s, r) => s + Number(r.amount), 0);
      const expectedRevenue = mrr + manualRev;

      // Expenses in that month
      const monthExp = expenses
        .filter(e => {
          const ed = new Date(e.expense_date);
          return ed >= ms && ed <= me;
        })
        .reduce((s, e) => s + Number(e.amount), 0);

      months.push({
        name: label,
        expected_revenue: expectedRevenue,
        expected_expenses: monthExp,
        expected_balance: expectedRevenue - monthExp,
      });
    }
    return months;
  }, [revenues, expenses, mrr]);

  const recurrenceLabel = (type: string | null) => {
    if (type === 'weekly') return 'Semanal';
    if (type === 'monthly') return 'Mensal';
    if (type === 'yearly') return 'Anual';
    return '';
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">📈 Relatórios Financeiros</h2>

      {/* SaaS Metrics */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
          <Activity className="h-4 w-4" /> Métricas SaaS
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <DollarSign className="h-6 w-6 text-success mb-1" />
              <p className="text-xs text-muted-foreground">MRR</p>
              <p className="text-lg font-display font-bold">{formatCurrency(mrr)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <TrendingUp className="h-6 w-6 text-primary mb-1" />
              <p className="text-xs text-muted-foreground">ARR</p>
              <p className="text-lg font-display font-bold">{formatCurrency(arr)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <Users className="h-6 w-6 text-primary mb-1" />
              <p className="text-xs text-muted-foreground">Clientes Ativos</p>
              <p className="text-lg font-display font-bold">{activeCompanies.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <UserPlus className="h-6 w-6 text-success mb-1" />
              <p className="text-xs text-muted-foreground">Novos (mês)</p>
              <p className="text-lg font-display font-bold">{thisMonth.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <BarChart3 className="h-6 w-6 text-destructive mb-1" />
              <p className="text-xs text-muted-foreground">Churn Rate</p>
              <p className="text-lg font-display font-bold">{churnRate.toFixed(1)}%</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex flex-col items-center text-center">
              <DollarSign className="h-6 w-6 text-warning mb-1" />
              <p className="text-xs text-muted-foreground">ARPC</p>
              <p className="text-lg font-display font-bold">{formatCurrency(arpc)}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cashflow Forecast Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="h-5 w-5" /> Previsão de Fluxo de Caixa (próximos 6 meses)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashflowData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="expected_revenue" name="Receita Prevista" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expected_expenses" name="Despesas Previstas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          {/* Balance line below */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {cashflowData.map((m) => (
              <div key={m.name} className="text-center">
                <p className="text-xs text-muted-foreground">{m.name}</p>
                <p className={`text-sm font-bold ${m.expected_balance >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(m.expected_balance)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for detail tables */}
      <Tabs defaultValue="subscriptions">
        <TabsList>
          <TabsTrigger value="subscriptions">Assinaturas</TabsTrigger>
          <TabsTrigger value="recurring_expenses">Despesas Recorrentes</TabsTrigger>
        </TabsList>

        {/* Upcoming Subscription Revenue */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">📅 Receita de Assinaturas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Ciclo</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Próx. Cobrança</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingSubscriptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">Nenhuma assinatura ativa</TableCell>
                      </TableRow>
                    ) : upcomingSubscriptions.map((s, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{s.company}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{s.plan}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.billing_cycle === 'yearly' ? 'Anual' : 'Mensal'}</TableCell>
                        <TableCell className="text-right font-medium text-success">{formatCurrency(s.amount)}</TableCell>
                        <TableCell className="text-sm">{s.billing_date}</TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-success/10 text-success border-success/20">Ativo</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Upcoming Recurring Expenses */}
        <TabsContent value="recurring_expenses" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Repeat className="h-4 w-4" /> Próximas Despesas Recorrentes
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Próxima Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingRecurringExpenses.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma despesa recorrente</TableCell>
                      </TableRow>
                    ) : upcomingRecurringExpenses.map((e, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium text-sm">{e.description}</TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{e.category}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground">{recurrenceLabel(e.recurrence_type)}</TableCell>
                        <TableCell className="text-right font-medium text-destructive">{formatCurrency(e.amount)}</TableCell>
                        <TableCell className="text-sm">{format(e.next_date, 'dd/MM/yyyy')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperAdminReports;
