import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFeatureDiscovery } from '@/hooks/useFeatureDiscovery';
import { FeatureIntroModal } from '@/components/FeatureIntroModal';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingDown, TrendingUp, Scissors, Users, BarChart3, Receipt, HandCoins, AlertTriangle, Clock, CalendarDays, CalendarIcon } from 'lucide-react';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import FinancialPrivacyToggle from '@/components/FinancialPrivacyToggle';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { startOfMonth, endOfMonth, subMonths, subDays, format, isPast, isToday, endOfWeek, startOfWeek, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, Area, AreaChart } from 'recharts';
import { calculateFinancials } from '@/lib/financial-engine';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type FilterPreset = 'today' | 'yesterday' | 'last7' | 'this_month' | 'custom';

const FinanceDashboard = () => {
  const { companyId } = useAuth();
  const { hasSeen, markSeen, loading: discoveryLoading } = useFeatureDiscovery();
  const [showIntro, setShowIntro] = useState(false);

  // Filter state — default to TODAY
  const [filterPreset, setFilterPreset] = useState<FilterPreset>('today');
  const [customStart, setCustomStart] = useState<Date | undefined>(undefined);
  const [customEnd, setCustomEnd] = useState<Date | undefined>(undefined);

  // KPI state
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [professionalValue, setProfessionalValue] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const [payables, setPayables] = useState({ total: 0, overdue: 0, dueToday: 0 });
  const [receivables, setReceivables] = useState({ total: 0, overdue: 0, dueToday: 0 });
  const [cashFlowData, setCashFlowData] = useState<any[]>([]);
  const [upcomingDues, setUpcomingDues] = useState({ today: 0, thisWeek: 0, thisMonth: 0 });

  const { maskValue } = useFinancialPrivacy();

  // Compute date range from preset
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (filterPreset) {
      case 'today':
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'yesterday': {
        const y = subDays(now, 1);
        return { start: format(y, 'yyyy-MM-dd'), end: format(y, 'yyyy-MM-dd') };
      }
      case 'last7': {
        const s = subDays(now, 6);
        return { start: format(s, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      }
      case 'this_month':
        return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
      case 'custom':
        return {
          start: customStart ? format(customStart, 'yyyy-MM-dd') : format(now, 'yyyy-MM-dd'),
          end: customEnd ? format(customEnd, 'yyyy-MM-dd') : format(now, 'yyyy-MM-dd'),
        };
      default:
        return { start: format(now, 'yyyy-MM-dd'), end: format(now, 'yyyy-MM-dd') };
    }
  }, [filterPreset, customStart, customEnd]);

  // Label for current filter
  const filterLabel = useMemo(() => {
    switch (filterPreset) {
      case 'today': return 'Hoje';
      case 'yesterday': return 'Ontem';
      case 'last7': return 'Últimos 7 dias';
      case 'this_month': return format(new Date(), "MMMM 'de' yyyy", { locale: ptBR });
      case 'custom': {
        if (customStart && customEnd) {
          return `${format(customStart, 'dd/MM')} até ${format(customEnd, 'dd/MM')}`;
        }
        return 'Personalizado';
      }
      default: return '';
    }
  }, [filterPreset, customStart, customEnd]);

  // Feature discovery intro
  useEffect(() => {
    if (!discoveryLoading && !hasSeen('finance')) {
      setShowIntro(true);
    }
  }, [discoveryLoading, hasSeen]);

  // Fetch data when companyId or dateRange changes
  useEffect(() => {
    if (companyId) {
      fetchPeriodData();
      fetchPayablesReceivables();
      fetchCashFlow();
      fetchUpcomingDues();
      fetchChartData();
    }
  }, [companyId, dateRange.start, dateRange.end]);

  const fetchPeriodData = async () => {
    const { start, end } = dateRange;

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
      const month = subMonths(now, -i);
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

  return (
    <div className="space-y-6">
      {/* Header with filter */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-display font-bold">Dashboard Financeiro</h2>
          <p className="text-sm text-muted-foreground">
            Período: <span className="font-medium text-foreground capitalize">{filterLabel}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={filterPreset} onValueChange={(v) => setFilterPreset(v as FilterPreset)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="last7">Últimos 7 dias</SelectItem>
              <SelectItem value="this_month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {filterPreset === 'custom' && (
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1", !customStart && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {customStart ? format(customStart, 'dd/MM/yyyy') : 'Início'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customStart} onSelect={setCustomStart} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <span className="text-muted-foreground text-sm">até</span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("gap-1", !customEnd && "text-muted-foreground")}>
                    <CalendarIcon className="h-4 w-4" />
                    {customEnd ? format(customEnd, 'dd/MM/yyyy') : 'Fim'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={customEnd} onSelect={setCustomEnd} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          )}

          <FinancialPrivacyToggle />
        </div>
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
              <p className="text-xl font-display font-bold">{maskValue(revenue)}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{filterLabel}</p>
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
              <p className="text-[10px] text-muted-foreground">Ticket médio: {maskValue(avgTicket)}</p>
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
              <p className="text-xl font-display font-bold">{maskValue(professionalValue)}</p>
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
              <p className={`text-xl font-display font-bold ${netCompany < 0 ? 'text-destructive' : ''}`}>{maskValue(netCompany)}</p>
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
              <p className="text-xl font-display font-bold text-destructive">{maskValue(payables.total)}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {payables.overdue > 0 && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasadas: {maskValue(payables.overdue)}</Badge>}
                {payables.dueToday > 0 && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning">Hoje: {maskValue(payables.dueToday)}</Badge>}
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
              <p className="text-xl font-display font-bold text-success">{maskValue(receivables.total)}</p>
              <div className="flex gap-2 mt-1 flex-wrap">
                {receivables.overdue > 0 && <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasadas: {maskValue(receivables.overdue)}</Badge>}
                {receivables.dueToday > 0 && <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning">Hoje: {maskValue(receivables.dueToday)}</Badge>}
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
      <FeatureIntroModal
        featureKey="finance"
        open={showIntro}
        onClose={() => { setShowIntro(false); markSeen('finance'); }}
      />
    </div>
  );
};

export default FinanceDashboard;
