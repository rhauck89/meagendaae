import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, RotateCcw, BarChart3 } from 'lucide-react';
import { startOfMonth, subMonths, startOfDay, endOfDay, startOfMonth as som, endOfMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, LineChart, Line } from 'recharts';
import { calculateFinancials } from '@/lib/financial-engine';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--success))', 'hsl(var(--warning))', 'hsl(var(--destructive))', 'hsl(var(--accent))', '#8884d8', '#82ca9d', '#ffc658'];

interface ProfitRow { name: string; services: number; revenue: number; commission: number; profit: number; avgTicket: number; }
interface ServiceRow { name: string; revenue: number; count: number; }
interface ClientRow { name: string; spent: number; visits: number; }

const EmptyChartState = ({ message }: { message?: string }) => (
  <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
    <BarChart3 className="h-10 w-10 mb-2 opacity-30" />
    <p className="text-sm text-center">{message || 'Sem dados suficientes para exibir gráfico neste período.'}</p>
  </div>
);

const FinanceReports = () => {
  const { companyId } = useAuth();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());

  const [profitByPro, setProfitByPro] = useState<ProfitRow[]>([]);
  const [revenueByService, setRevenueByService] = useState<ServiceRow[]>([]);
  const [topClients, setTopClients] = useState<ClientRow[]>([]);
  const [expensesByCat, setExpensesByCat] = useState<{ name: string; value: number }[]>([]);
  const [monthlyTrend, setMonthlyTrend] = useState<{ name: string; revenue: number }[]>([]);
  const [revenueByPayment, setRevenueByPayment] = useState<{ name: string; value: number }[]>([]);

  useEffect(() => {
    if (companyId) { fetchAll(); fetchMonthlyTrend(); fetchRevenueByPayment(); }
  }, [companyId, startDate, endDate]);

  const fetchAll = async () => {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    const [aptsRes, collabRes, aptSvcRes, expsRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, total_price, professional_id, client_id, client_name, professional:profiles!appointments_professional_id_fkey(full_name)')
        .eq('company_id', companyId!)
        .eq('status', 'completed')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString()),
      supabase
        .from('collaborators')
        .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent')
        .eq('company_id', companyId!),
      supabase
        .from('appointment_services')
        .select('appointment_id, price, duration_minutes, service:services(name)') as any,
      supabase
        .from('company_expenses')
        .select('amount, category:company_expense_categories(name)')
        .eq('company_id', companyId!)
        .gte('expense_date', format(startDate, 'yyyy-MM-dd'))
        .lte('expense_date', format(endDate, 'yyyy-MM-dd')),
    ]);

    const apts = aptsRes.data || [];
    const collabs = collabRes.data || [];
    const aptSvcs = aptSvcRes.data || [];
    const exps = expsRes.data || [];

    const collabMap: Record<string, { type: string; commType: string; value: number }> = {};
    collabs.forEach(c => {
      collabMap[c.profile_id] = { type: c.collaborator_type, commType: c.commission_type, value: c.commission_value ?? c.commission_percent ?? 0 };
    });

    // 1. Profitability by professional
    const proGroup: Record<string, { name: string; revenue: number; count: number; pid: string }> = {};
    apts.forEach(a => {
      const pid = a.professional_id;
      const name = a.professional?.full_name || 'Sem nome';
      if (!proGroup[pid]) proGroup[pid] = { name, revenue: 0, count: 0, pid };
      proGroup[pid].revenue += Number(a.total_price);
      proGroup[pid].count += 1;
    });

    const profitRows: ProfitRow[] = Object.values(proGroup).map(g => {
      const collab = collabMap[g.pid] || { type: 'commissioned', commType: 'none', value: 0 };
      const fin = calculateFinancials(g.revenue, g.count, collab.type, collab.commType, collab.value);
      return { name: g.name, services: g.count, revenue: g.revenue, commission: fin.professionalValue, profit: fin.companyValue, avgTicket: g.count > 0 ? g.revenue / g.count : 0 };
    });
    profitRows.sort((a, b) => b.profit - a.profit);
    setProfitByPro(profitRows);

    // 2. Revenue by service
    const aptIdSet = new Set(apts.map(a => a.id));
    const svcMap: Record<string, ServiceRow> = {};
    aptSvcs.forEach((as: any) => {
      if (!aptIdSet.has(as.appointment_id)) return;
      const name = as.service?.name || 'Outros';
      if (!svcMap[name]) svcMap[name] = { name, revenue: 0, count: 0 };
      svcMap[name].revenue += Number(as.price);
      svcMap[name].count += 1;
    });
    setRevenueByService(Object.values(svcMap).sort((a, b) => b.revenue - a.revenue));

    // 3. Top clients
    const clientMap: Record<string, ClientRow> = {};
    apts.forEach(a => {
      const key = a.client_id || a.client_name || 'Anônimo';
      const name = a.client_name || 'Anônimo';
      if (!clientMap[key]) clientMap[key] = { name, spent: 0, visits: 0 };
      clientMap[key].spent += Number(a.total_price);
      clientMap[key].visits += 1;
    });
    setTopClients(Object.values(clientMap).sort((a, b) => b.spent - a.spent).slice(0, 15));

    // 4. Expenses by category
    const catMap: Record<string, { name: string; value: number }> = {};
    exps.forEach(e => {
      const name = (e.category as any)?.name || 'Sem categoria';
      if (!catMap[name]) catMap[name] = { name, value: 0 };
      catMap[name].value += Number(e.amount);
    });
    setExpensesByCat(Object.values(catMap).sort((a, b) => b.value - a.value));
  };

  const fetchMonthlyTrend = async () => {
    const now = new Date();
    const data: { name: string; revenue: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = subMonths(now, i);
      const s = som(m).toISOString().split('T')[0];
      const e = format(endOfMonth(m), 'yyyy-MM-dd');
      const label = format(m, 'MMM/yy', { locale: ptBR });
      const { data: apts } = await supabase
        .from('appointments')
        .select('total_price')
        .eq('company_id', companyId!)
        .eq('status', 'completed')
        .gte('start_time', `${s}T00:00:00`)
        .lte('start_time', `${e}T23:59:59`);
      data.push({ name: label, revenue: apts?.reduce((sum, a) => sum + Number(a.total_price), 0) || 0 });
    }
    setMonthlyTrend(data);
  };

  const revenueChartData = profitByPro.map(p => ({ name: p.name, receita: p.revenue, comissão: p.commission, lucro: p.profit }));
  const serviceChartData = revenueByService.slice(0, 8).map(s => ({ name: s.name, value: s.revenue }));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Relatórios Financeiros</h2>
        <p className="text-sm text-muted-foreground">Análise detalhada de lucratividade, receitas e despesas</p>
      </div>

      {/* Date filter */}
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

      {/* 1. Profitability by professional */}
      <Card>
        <CardHeader><CardTitle className="text-base">Lucratividade por Profissional</CardTitle></CardHeader>
        <CardContent>
          {profitByPro.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-center">Serviços</TableHead>
                    <TableHead className="text-right">Receita</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Lucro Empresa</TableHead>
                    <TableHead className="text-right">Ticket Médio</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profitByPro.map(p => (
                    <TableRow key={p.name}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-center">{p.services}</TableCell>
                      <TableCell className="text-right">R$ {p.revenue.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-warning">R$ {p.commission.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-bold">R$ {p.profit.toFixed(2)}</TableCell>
                      <TableCell className="text-right text-muted-foreground">R$ {p.avgTicket.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="border-t-2 font-bold">
                    <TableCell>Total</TableCell>
                    <TableCell className="text-center">{profitByPro.reduce((s, p) => s + p.services, 0)}</TableCell>
                    <TableCell className="text-right">R$ {profitByPro.reduce((s, p) => s + p.revenue, 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right text-warning">R$ {profitByPro.reduce((s, p) => s + p.commission, 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">R$ {profitByPro.reduce((s, p) => s + p.profit, 0).toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Profissional</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {revenueChartData.length === 0 ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis type="number" tickFormatter={v => `R$${v}`} className="text-xs" />
                    <YAxis type="category" dataKey="name" width={100} className="text-xs" />
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Legend />
                    <Bar dataKey="receita" name="Receita" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="comissão" name="Comissão" fill="hsl(var(--warning))" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="lucro" name="Lucro" fill="hsl(var(--success))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Receita por Serviço</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {serviceChartData.length === 0 ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={serviceChartData} cx="50%" cy="50%" outerRadius={90} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}>
                      {serviceChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Tendência de Receita Mensal</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              {monthlyTrend.length === 0 || monthlyTrend.every(d => d.revenue === 0) ? (
                <EmptyChartState />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={monthlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis tickFormatter={v => `R$${v}`} className="text-xs" />
                    <Tooltip formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
                    <Line type="monotone" dataKey="revenue" name="Receita" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue by service table */}
      <Card>
        <CardHeader><CardTitle className="text-base">Receita por Serviço</CardTitle></CardHeader>
        <CardContent>
          {revenueByService.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-center">Atendimentos</TableHead>
                    <TableHead className="text-right">Receita Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {revenueByService.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-center">{s.count}</TableCell>
                      <TableCell className="text-right font-semibold">R$ {s.revenue.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top clients */}
      <Card>
        <CardHeader><CardTitle className="text-base">Top Clientes</CardTitle></CardHeader>
        <CardContent>
          {topClients.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">Visitas</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topClients.map((c, i) => (
                    <TableRow key={c.name}>
                      <TableCell><Badge variant={i < 3 ? 'default' : 'outline'} className="text-xs">{i + 1}º</Badge></TableCell>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">{c.visits}</TableCell>
                      <TableCell className="text-right font-semibold">R$ {c.spent.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses by category */}
      <Card>
        <CardHeader><CardTitle className="text-base">Despesas por Categoria</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72">
            {expensesByCat.length === 0 ? (
              <EmptyChartState message="Nenhuma despesa registrada neste período." />
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
  );
};

export default FinanceReports;
