import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { startOfMonth, startOfDay, endOfDay, format } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))'];

const FinanceReports = () => {
  const { companyId } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [revenueByService, setRevenueByService] = useState<any[]>([]);
  const [revenueByPro, setRevenueByPro] = useState<any[]>([]);
  const [expensesByCat, setExpensesByCat] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) fetchAll();
  }, [companyId, startDate, endDate]);

  const fetchAll = async () => {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    // Revenue by service
    const { data: apts } = await supabase
      .from('appointments')
      .select('total_price, professional:profiles!appointments_professional_id_fkey(full_name)')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    const { data: aptServices } = await supabase
      .from('appointment_services')
      .select('appointment_id, price, service:services(name)');

    // Revenue by professional
    const proMap: Record<string, { name: string; value: number }> = {};
    apts?.forEach(a => {
      const name = a.professional?.full_name || 'Outros';
      if (!proMap[name]) proMap[name] = { name, value: 0 };
      proMap[name].value += Number(a.total_price);
    });
    setRevenueByPro(Object.values(proMap).sort((a, b) => b.value - a.value).slice(0, 10));

    // Revenue by service
    const aptIds = new Set(apts?.map(a => (a as any).id) || []);
    const svcMap: Record<string, { name: string; value: number }> = {};
    aptServices?.forEach(as => {
      const name = (as.service as any)?.name || 'Outros';
      if (!svcMap[name]) svcMap[name] = { name, value: 0 };
      svcMap[name].value += Number(as.price);
    });
    setRevenueByService(Object.values(svcMap).sort((a, b) => b.value - a.value).slice(0, 10));

    // Expenses by category
    const { data: exps } = await supabase
      .from('company_expenses')
      .select('amount, category:company_expense_categories(name)')
      .eq('company_id', companyId!)
      .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
      .lte('expense_date', format(endDate, 'yyyy-MM-dd'));

    const catMap: Record<string, { name: string; value: number }> = {};
    exps?.forEach(e => {
      const name = (e.category as any)?.name || 'Sem categoria';
      if (!catMap[name]) catMap[name] = { name, value: 0 };
      catMap[name].value += Number(e.amount);
    });
    setExpensesByCat(Object.values(catMap).sort((a, b) => b.value - a.value));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Relatórios Financeiros</h2>
        <p className="text-sm text-muted-foreground">Análise detalhada de receitas e despesas</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(startDate, 'dd/MM/yyyy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(endDate, 'dd/MM/yyyy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} disabled={d => d < startDate} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }}><RotateCcw className="h-3 w-3 mr-1" /> Resetar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Profissional</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByPro} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={v => `R$${v}`} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="value" name="Receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Serviço</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByService} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tickFormatter={v => `R$${v}`} className="text-xs" />
                  <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                  <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                  <Bar dataKey="value" name="Receita" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              {expensesByCat.length === 0 ? (
                <p className="text-center text-muted-foreground py-12">Nenhuma despesa no período</p>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={expensesByCat} cx="50%" cy="50%" outerRadius={100} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {expensesByCat.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default FinanceReports;
