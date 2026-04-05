import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, TrendingUp, Users, Target, Percent } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, subDays, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { calculateFinancials, collaboratorTypeLabel, commissionLabel } from '@/lib/financial-engine';

type DateFilter = 'today' | '7days' | 'month' | 'custom';

const ProfessionalFinance = () => {
  const { profile } = useAuth();
  const [dateFilter, setDateFilter] = useState<DateFilter>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now) };
      case '7days':
        return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
      case 'month':
        return { start: startOfMonth(now), end: endOfMonth(now) };
      case 'custom':
        return {
          start: customStart ? startOfDay(parseISO(customStart)) : startOfMonth(now),
          end: customEnd ? endOfDay(parseISO(customEnd)) : endOfDay(now),
        };
    }
  }, [dateFilter, customStart, customEnd]);

  // Fetch collaborator info
  const { data: collaborator } = useQuery({
    queryKey: ['my-collaborator', profile?.id],
    queryFn: async () => {
      if (!profile?.id) return null;
      const { data } = await supabase
        .from('collaborators')
        .select('*')
        .eq('profile_id', profile.id)
        .single();
      return data;
    },
    enabled: !!profile?.id,
  });

  // Fetch completed appointments in range
  const { data: appointments = [] } = useQuery({
    queryKey: ['prof-finance-appointments', profile?.id, dateRange.start.toISOString(), dateRange.end.toISOString()],
    queryFn: async () => {
      if (!profile?.id) return [];
      const { data } = await supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, total_price, status, client_name,
          appointment_services(service_id, price, duration_minutes)
        `)
        .eq('professional_id', profile.id)
        .eq('status', 'completed')
        .gte('start_time', dateRange.start.toISOString())
        .lte('start_time', dateRange.end.toISOString())
        .order('start_time', { ascending: false });
      return data || [];
    },
    enabled: !!profile?.id,
  });

  // Fetch service names
  const serviceIds = useMemo(() => {
    const ids = new Set<string>();
    appointments.forEach((a: any) => {
      a.appointment_services?.forEach((s: any) => ids.add(s.service_id));
    });
    return Array.from(ids);
  }, [appointments]);

  const { data: servicesMap = {} } = useQuery({
    queryKey: ['prof-finance-services', serviceIds],
    queryFn: async () => {
      if (!serviceIds.length) return {};
      const { data } = await supabase.from('services').select('id, name').in('id', serviceIds);
      const map: Record<string, string> = {};
      data?.forEach((s: any) => { map[s.id] = s.name; });
      return map;
    },
    enabled: serviceIds.length > 0,
  });

  // Calculate metrics
  const metrics = useMemo(() => {
    const totalRevenue = appointments.reduce((sum: number, a: any) => sum + Number(a.total_price || 0), 0);
    const count = appointments.length;
    const avgTicket = count > 0 ? totalRevenue / count : 0;

    const collabType = collaborator?.collaborator_type || 'independent';
    const commType = collaborator?.commission_type || 'none';
    const commValue = collaborator?.commission_value || 0;

    const { professionalValue, companyValue } = calculateFinancials(
      totalRevenue, count, collabType, commType, commValue
    );

    // Today metrics
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const todayAppts = appointments.filter((a: any) => format(parseISO(a.start_time), 'yyyy-MM-dd') === todayStr);
    const todayRevenue = todayAppts.reduce((sum: number, a: any) => sum + Number(a.total_price || 0), 0);
    const todayFinancials = calculateFinancials(
      todayRevenue, todayAppts.length, collabType, commType, commValue
    );

    return {
      totalRevenue,
      count,
      avgTicket,
      professionalValue,
      companyValue,
      todayRevenue,
      todayProfessionalValue: todayFinancials.professionalValue,
      collabType,
      commType,
      commValue,
      isCommissioned: collabType === 'commissioned',
    };
  }, [appointments, collaborator]);

  // Chart data - revenue by day
  const chartData = useMemo(() => {
    const dayMap: Record<string, number> = {};
    appointments.forEach((a: any) => {
      const day = format(parseISO(a.start_time), 'dd/MM');
      dayMap[day] = (dayMap[day] || 0) + Number(a.total_price || 0);
    });
    return Object.entries(dayMap)
      .map(([day, value]) => ({ day, value }))
      .reverse();
  }, [appointments]);

  const chartConfig = {
    value: { label: 'Receita', color: 'hsl(var(--primary))' },
  };

  const getServiceNames = (appt: any) => {
    return appt.appointment_services
      ?.map((s: any) => servicesMap[s.service_id] || 'Serviço')
      .join(' + ') || '—';
  };

  const getCommissionForAppt = (appt: any) => {
    if (!metrics.isCommissioned) return null;
    const price = Number(appt.total_price || 0);
    const serviceCount = appt.appointment_services?.length || 1;
    const { professionalValue } = calculateFinancials(
      price, serviceCount, metrics.collabType, metrics.commType, metrics.commValue
    );
    return professionalValue;
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Financeiro</h2>
          {collaborator && (
            <p className="text-sm text-muted-foreground">
              {collaboratorTypeLabel(collaborator.collaborator_type)}
              {metrics.isCommissioned && ` • ${commissionLabel(metrics.commType, metrics.commValue)}`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={dateFilter} onValueChange={(v) => setDateFilter(v as DateFilter)}>
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="7days">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Este mês</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          {dateFilter === 'custom' && (
            <>
              <Input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="w-[150px]" />
              <Input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="w-[150px]" />
            </>
          )}
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Dia</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.todayRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita do Período</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.totalRevenue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atendimentos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.count}</div>
            <p className="text-xs text-muted-foreground">atendimentos</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ticket Médio</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(metrics.avgTicket)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Commission Cards */}
      {metrics.isCommissioned && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão do Dia</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.todayProfessionalValue)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Comissão do Período</CardTitle>
              <Percent className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(metrics.professionalValue)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receita por Dia</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="day" className="text-xs" />
                <YAxis className="text-xs" />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      {/* Appointments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Atendimentos</CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum atendimento concluído no período.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    {metrics.isCommissioned && <TableHead className="text-right">Comissão</TableHead>}
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointments.map((appt: any) => {
                    const commission = getCommissionForAppt(appt);
                    return (
                      <TableRow key={appt.id}>
                        <TableCell>{format(parseISO(appt.start_time), 'dd/MM', { locale: ptBR })}</TableCell>
                        <TableCell>{appt.client_name || '—'}</TableCell>
                        <TableCell>{getServiceNames(appt)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(Number(appt.total_price || 0))}</TableCell>
                        {metrics.isCommissioned && (
                          <TableCell className="text-right">{commission != null ? formatCurrency(commission) : '—'}</TableCell>
                        )}
                        <TableCell>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            Concluído
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProfessionalFinance;
