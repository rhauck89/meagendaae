import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingDown, TrendingUp, Scissors, Target } from 'lucide-react';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const FinanceDashboard = () => {
  const { companyId } = useAuth();
  const [revenue, setRevenue] = useState(0);
  const [expenses, setExpenses] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
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

    // Revenue from completed appointments
    const { data: appointments } = await supabase
      .from('appointments')
      .select('total_price')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', `${start}T00:00:00`)
      .lte('start_time', `${end}T23:59:59`);

    const aptRevenue = appointments?.reduce((s, a) => s + Number(a.total_price), 0) || 0;

    // Manual revenues
    const { data: manualRevs } = await supabase
      .from('company_revenues')
      .select('amount')
      .eq('company_id', companyId!)
      .eq('is_automatic', false)
      .gte('revenue_date', start)
      .lte('revenue_date', end);
    const manualRevenue = manualRevs?.reduce((s, r) => s + Number(r.amount), 0) || 0;

    // Expenses
    const { data: exps } = await supabase
      .from('company_expenses')
      .select('amount')
      .eq('company_id', companyId!)
      .gte('expense_date', start)
      .lte('expense_date', end);
    const totalExpenses = exps?.reduce((s, e) => s + Number(e.amount), 0) || 0;

    setRevenue(aptRevenue + manualRevenue);
    setExpenses(totalExpenses);
    setServiceCount(appointments?.length || 0);
  };

  const fetchChartData = async () => {
    const data: any[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const month = subMonths(now, i);
      const start = startOfMonth(month).toISOString().split('T')[0];
      const end = format(endOfMonth(month), 'yyyy-MM-dd');
      const label = format(month, 'MMM/yy', { locale: ptBR });

      const { data: apts } = await supabase
        .from('appointments')
        .select('total_price')
        .eq('company_id', companyId!)
        .eq('status', 'completed')
        .gte('start_time', `${start}T00:00:00`)
        .lte('start_time', `${end}T23:59:59`);

      const { data: manualRevs } = await supabase
        .from('company_revenues')
        .select('amount')
        .eq('company_id', companyId!)
        .eq('is_automatic', false)
        .gte('revenue_date', start)
        .lte('revenue_date', end);

      const { data: exps } = await supabase
        .from('company_expenses')
        .select('amount')
        .eq('company_id', companyId!)
        .gte('expense_date', start)
        .lte('expense_date', end);

      const rev = (apts?.reduce((s, a) => s + Number(a.total_price), 0) || 0) + (manualRevs?.reduce((s, r) => s + Number(r.amount), 0) || 0);
      const exp = exps?.reduce((s, e) => s + Number(e.amount), 0) || 0;

      data.push({ name: label, receitas: rev, despesas: exp });
    }
    setChartData(data);
  };

  const profit = revenue - expenses;
  const avgTicket = serviceCount > 0 ? revenue / serviceCount : 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Dashboard Financeiro</h2>
        <p className="text-sm text-muted-foreground">Visão geral das finanças da empresa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Receita do mês</p>
              <p className="text-xl font-display font-bold">R$ {revenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Despesas do mês</p>
              <p className="text-xl font-display font-bold">R$ {expenses.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Lucro</p>
              <p className={`text-xl font-display font-bold ${profit < 0 ? 'text-destructive' : ''}`}>R$ {profit.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <Target className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Ticket médio</p>
              <p className="text-xl font-display font-bold">R$ {avgTicket.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <Scissors className="h-6 w-6 text-accent-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Serviços realizados</p>
              <p className="text-xl font-display font-bold">{serviceCount}</p>
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceDashboard;
