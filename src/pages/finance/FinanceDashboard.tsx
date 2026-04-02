import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingDown, TrendingUp, Scissors, Users, BarChart3 } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { calculateFinancials } from '@/lib/financial-engine';

const FinanceDashboard = () => {
  const { companyId } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [professionalValue, setProfessionalValue] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchCurrentMonth();
      fetchChartData();
    }
  }, [companyId]);

  const fetchCurrentMonth = async () => {
    const now = new Date();
    const start = startOfMonth(now).toISOString().split('T')[0];
    const end = format(now, 'yyyy-MM-dd');

    const [aptsRes, manualRes, expsRes, collabRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('total_price, professional_id')
        .eq('company_id', companyId!)
        .eq('status', 'completed')
        .gte('start_time', `${start}T00:00:00`)
        .lte('start_time', `${end}T23:59:59`),
      supabase
        .from('company_revenues')
        .select('amount')
        .eq('company_id', companyId!)
        .eq('is_automatic', false)
        .gte('revenue_date', start)
        .lte('revenue_date', end),
      supabase
        .from('company_expenses')
        .select('amount')
        .eq('company_id', companyId!)
        .gte('expense_date', start)
        .lte('expense_date', end),
      supabase
        .from('collaborators')
        .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent')
        .eq('company_id', companyId!),
    ]);

    const apts = aptsRes.data || [];
    const aptRevenue = apts.reduce((s, a) => s + Number(a.total_price), 0);
    const manualRevenue = (manualRes.data || []).reduce((s, r) => s + Number(r.amount), 0);
    const totalExpenses = (expsRes.data || []).reduce((s, e) => s + Number(e.amount), 0);

    // Calculate professional commissions
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

  const profit = revenue - expenses;
  const avgTicket = serviceCount > 0 ? revenue / serviceCount : 0;
  const netCompany = revenue - professionalValue;
  const currentMonthLabel = format(new Date(), 'MMMM yyyy', { locale: ptBR });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Dashboard Financeiro</h2>
        <p className="text-sm text-muted-foreground">Visão geral das finanças da empresa</p>
      </div>

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

      <Card>
        <CardHeader>
          <CardTitle>Receitas vs Despesas (últimos 6 meses)</CardTitle>
        </CardHeader>
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
    </div>
  );
};

export default FinanceDashboard;
