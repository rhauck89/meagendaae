import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingDown, TrendingUp, Scissors, Users, BarChart3, Receipt, HandCoins, AlertTriangle, Clock, CalendarDays } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format, isPast, isToday, endOfWeek, startOfWeek, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line, Area, AreaChart } from 'recharts';
import { calculateFinancials } from '@/lib/financial-engine';
import { Badge } from '@/components/ui/badge';

const FinanceDashboard = () => {
  const { companyId } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [professionalValue, setProfessionalValue] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [payables, setPayables] = useState({ total: 0, overdue: 0, dueToday: 0 });
  const [receivables, setReceivables] = useState({ total: 0, overdue: 0, dueToday: 0 });
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [upcomingDues, setUpcomingDues] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });

  useEffect(() => {
    if (companyId) {
      fetchCurrentMonth();
      fetchChartData();
      fetchPayablesReceivables();
      fetchCashFlow();
      fetchUpcomingDues();
    }
  }, [companyId]);

  const fetchCurrentMonth = async () => {
    const now = new Date();
    const start = startOfMonth(now).toISOString().split('T')[0];
    const end = format(now, 'yyyy-MM-dd');

    const [aptsRes, manualRes, expsRes, collabRes] = await Promise.all([
      supabase.from('appointments').select('total_price, professional_id').eq('company_id', companyId!).eq('status', 'completed').gte('start_time', `${start}T00:00:00`).lte('start_time', `${end}T23:59:59`),
      supabase.from('company_revenues').select('amount').eq('company_id', companyId!).eq('is_automatic', false).gte('revenue_date', start).lte('revenue_date', end),
      supabase.from('company_expenses').select('amount').eq('company_id', companyId!).gte('expense_date', start).lte('expense_date', end),
      supabase.from('collaborators').select('profile_id, collaborator_type, commission_type, commission_value, commission_percent').eq('company_id', companyId!),
    ]);

    const apts = aptsRes.data || [];
    const aptRevenue = apts.reduce((s, a) => s + Number(a.total_price), 0);
    const manualRevenue = (manualRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
    const totalExpenses = (expsRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

    const collabs = collabRes.data || [];
    const collabMap: Record<string, any> = {};
    collabs.forEach(c => { collabMap[c.profile_id] = c; });

    let totalProfValue = 0;
    const proRevMap: Record<string, number> = {};
    const proCountMap: Record<string, number> = {};
    apts.forEach(a => {
      proRevMap[a.professional_id] = (proRevMap[a.professional_id] || 0) + Number(a.total_price);
      proCountMap[a.professional_id] = (proCountMap[a.professional_id] || 0) + 1;
    });
    Object.entries(proRevMap).forEach(([pid, rev]) => {
      const c = collabMap[pid];
      if (c) {
        const fin = calculateFinancials(rev, proCountMap[pid], c.collaborator_type, c.commission_type, c.commission_value ?? c.commission_percent ?? 0);
        totalProfValue += fin.professionalValue;
      }
    });

    setRevenue(aptRevenue + manualRevenue);
    setExpenses(totalExpenses);
    setServiceCount(apts.length);
    setProfessionalValue(totalProfValue);
  };

  const fetchPayablesReceivables = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const [payRes, recRes] = await Promise.all([
      supabase.from('company_expenses').select('amount, due_date').eq('company_id', companyId!).eq('status', 'pending').not('due_date', 'is', null),
      supabase.from('company_revenues').select('amount, due_date').eq('company_id', companyId!).eq('status', 'pending').not('due_date', 'is', null),
    ]);

    const payItems = payRes.data || [];
    const recItems = recRes.data || [];

    setPayables({
      total: payItems.reduce((s, i) => s + Number(i.amount), 0),
      overdue: payItems.filter(i => i.due_date && isPast(new Date(i.due_date + 'T12:00:00')) && !isToday(new Date(i.due_date + 'T12:00:00'))).reduce((s, i) => s + Number(i.amount), 0),
      dueToday: payItems.filter(i => i.due_date && isToday(new Date(i.due_date + 'T12:00:00'))).reduce((s, i) => s + Number(i.amount), 0),
    });

    setReceivables({
      total: recItems.reduce((s, i) => s + Number(i.amount), 0),
      overdue: recItems.filter(i => i.due_date && isPast(new Date(i.due_date + 'T12:00:00')) && !isToday(new Date(i.due_date + 'T12:00:00'))).reduce((s, i) => s + Number(i.amount), 0),
      dueToday: recItems.filter(i => i.due_date && isToday(new Date(i.due_date + 'T12:00:00'))).reduce((s, i) => s + Number(i.amount), 0),
    });
  };

  const fetchCashFlow = async () => {
    const data: any[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const month = subMonths(now, -i); // future months
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = format(endOfMonth(month), 'yyyy-MM-dd');
      const label = format(month, 'MMM/yy', { locale: ptBR });

      const [revRes, expRes] = await Promise.all([
        supabase.from('company_revenues').select('amount').eq('company_id', companyId!).eq('status', 'pending').gte('due_date', start).lte('due_date', end),
        supabase.from('company_expenses').select('amount').eq('company_id', companyId!).eq('status', 'pending').gte('due_date', start).lte('due_date', end),
      ]);

      const expectedRev = (revRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
      const expectedExp = (expRes.data || []).reduce((s, e) => s + Number(e.amount), 0);
      data.push({ name: label, receitas: expectedRev, despesas: expectedExp, saldo: expectedRev - expectedExp });
    }
    setCashFlowData(data);
  };

  const fetchUpcomingDues = async () => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const weekEndStr = format(endOfWeek(now), 'yyyy-MM-dd');
    const monthEndStr = format(endOfMonth(now), 'yyyy-MM-dd');

    const [payRes, recRes] = await Promise.all([
      supabase.from('company_expenses').select('due_date').eq('company_id', companyId!).eq('status', 'pending').not('due_date', 'is', null).gte('due_date', todayStr).lte('due_date', monthEndStr),
      supabase.from('company_revenues').select('due_date').eq('company_id', companyId!).eq('status', 'pending').not('due_date', 'is', null).gte('due_date', todayStr).lte('due_date', monthEndStr),
    ]);

    const allDues = [...(payRes.data || []), ...(recRes.data || [])];
    setUpcomingDues({
      today: allDues.filter(i => i.due_date === todayStr).length,
      thisWeek: allDues.filter(i => i.due_date! <= weekEndStr).length,
      thisMonth: allDues.length,
    });
  };

  const fetchChartData = async () => {
    const data: any[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = format(endOfMonth(month), 'yyyy-MM-dd');
      const label = format(month, 'MMM/yy', { locale: ptBR });

      const [aptsRes, manualRes, expsRes] = await Promise.all([
        supabase.from('appointments').select('total_price').eq('company_id', companyId!).eq('status', 'completed').gte('start_time', `${start}T00:00:00`).lte('start_time', `${end}T23:59:59`),
        supabase.from('company_revenues').select('amount').eq('company_id', companyId!).eq('is_automatic', false).gte('revenue_date', start).lte('revenue_date', end),
        supabase.from('company_expenses').select('amount').eq('company_id', companyId!).gte('expense_date', start).lte('expense_date', end),
      ]);

      const rev = (aptsRes.data?.reduce((s, a) => s + Number(a.total_price), 0) || 0) + (manualRes.data?.reduce((s, r) => s + Number(r.amount), 0) || 0);
      const exp = expsRes.data?.reduce((s, e) => s + Number(e.amount), 0) || 0;
      data.push({ name: label, receitas: rev, despesas: exp });
    }
    setChartData(data);
  };

  const avgTicket = serviceCount > 0 ? revenue / serviceCount : 0;
  const netCompany = revenue - professionalValue;
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Dashboard Financeiro</h2>
        <p className="text-sm text-muted-foreground">Visão geral das finanças da empresa</p>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="text-xl font-display font-bold">R$ {revenue.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{currentMonthLabel}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <Scissors className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Atendimentos</p>
              <p className="text-xl font-display font-bold">{serviceCount}</p>
              <p className="text-[10px] text-muted-foreground">Ticket médio: R$ {avgTicket.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <Users className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Valor Profissionais</p>
              <p className="text-xl font-display font-bold">R$ {professionalValue.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Comissões do período</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Líquido Empresa</p>
              <p className={`text-xl font-display font-bold ${netCompany < 0 ? 'text-destructive' : ''}`}>R$ {netCompany.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">Faturamento - Comissões</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payables & Receivables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              <Receipt className="h-6 w-6 text-destructive" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Contas a Pagar</p>
              <p className="text-xl font-display font-bold text-destructive">R$ {payables.total.toFixed(2)}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {payables.overdue > 0 && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasadas: R$ {payables.overdue.toFixed(2)}</Badge>}
                {payables.dueToday > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700">Hoje: R$ {payables.dueToday.toFixed(2)}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <HandCoins className="h-6 w-6 text-success" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Contas a Receber</p>
              <p className="text-xl font-display font-bold text-success">R$ {receivables.total.toFixed(2)}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {receivables.overdue > 0 && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasadas: R$ {receivables.overdue.toFixed(2)}</Badge>}
                {receivables.dueToday > 0 && <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700">Hoje: R$ {receivables.dueToday.toFixed(2)}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Próximos Vencimentos */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Próximos Vencimentos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl font-bold">{upcomingDues.today}</p>
              <p className="text-xs text-muted-foreground">Hoje</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{upcomingDues.thisWeek}</p>
              <p className="text-xs text-muted-foreground">Esta semana</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{upcomingDues.thisMonth}</p>
              <p className="text-xs text-muted-foreground">Este mês</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Receitas vs Despesas (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            {chartData.length === 0 || chartData.every(d => d.receitas === 0 && d.despesas === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Sem dados suficientes para exibir gráfico neste período.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cash Flow Forecast */}
      <Card>
        <CardHeader><CardTitle>Fluxo de Caixa Projetado (próximos 6 meses)</CardTitle></CardHeader>
        <CardContent>
          <div className="h-80">
            {cashFlowData.length === 0 || cashFlowData.every(d => d.receitas === 0 && d.despesas === 0) ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Sem dados de contas pendentes para projeção.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cashFlowData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Legend />
                  <Area type="monotone" dataKey="receitas" name="Receitas Previstas" stroke="hsl(var(--success))" fill="hsl(var(--success))" fillOpacity={0.2} />
                  <Area type="monotone" dataKey="despesas" name="Despesas Previstas" stroke="hsl(var(--destructive))" fill="hsl(var(--destructive))" fillOpacity={0.2} />
                  <Line type="monotone" dataKey="saldo" name="Saldo Projetado" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
