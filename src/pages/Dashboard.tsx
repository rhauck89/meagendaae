import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, AlertTriangle, Bell } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

type ViewMode = 'day' | 'week' | 'month';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  completed: 'bg-success/10 text-success border-success/20',
  no_show: 'bg-muted text-muted-foreground border-border',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
};

interface ReturnStats {
  onTime: number;
  approaching: number;
  overdue: number;
  approachingClients: any[];
  overdueClients: any[];
}

const Dashboard = () => {
  const { companyId } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, clients: 0 });
  const [returnStats, setReturnStats] = useState<ReturnStats>({ onTime: 0, approaching: 0, overdue: 0, approachingClients: [], overdueClients: [] });
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);

  useEffect(() => {
    if (!companyId) return;
    fetchAppointments();
    fetchReturnStats();
    fetchWaitlistCount();
  }, [companyId, currentDate, viewMode]);

  const getDateRange = () => {
    if (viewMode === 'day') return { start: currentDate, end: currentDate };
    if (viewMode === 'week') return { start: startOfWeek(currentDate, { locale: ptBR }), end: endOfWeek(currentDate, { locale: ptBR }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const fetchAppointments = async () => {
    const { start, end } = getDateRange();
    const { data } = await supabase
      .from('appointments')
      .select(`
        *,
        client:profiles!appointments_client_id_fkey(full_name, whatsapp),
        professional:profiles!appointments_professional_id_fkey(full_name),
        appointment_services(*, service:services(name))
      `)
      .eq('company_id', companyId!)
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString())
      .order('start_time');

    if (data) {
      setAppointments(data);
      const todayAppts = data.filter((a) => isSameDay(parseISO(a.start_time), new Date()));
      setStats({
        total: todayAppts.length,
        revenue: todayAppts.filter((a) => a.status !== 'cancelled').reduce((sum, a) => sum + Number(a.total_price), 0),
        clients: new Set(todayAppts.map((a) => a.client_id)).size,
      });
    }
  };

  const fetchReturnStats = async () => {
    if (!companyId) return;
    const { data: clients } = await supabase
      .from('profiles')
      .select('id, full_name, whatsapp, average_return_days, last_visit_date, expected_return_date')
      .eq('company_id', companyId)
      .not('expected_return_date', 'is', null);

    if (!clients) return;

    const today = new Date();
    let onTime = 0;
    let approaching = 0;
    let overdue = 0;
    const approachingClients: any[] = [];
    const overdueClients: any[] = [];

    for (const c of clients) {
      const expected = new Date(c.expected_return_date);
      const daysUntil = differenceInDays(expected, today);

      if (daysUntil < 0) {
        overdue++;
        overdueClients.push({ ...c, daysOverdue: Math.abs(daysUntil) });
      } else if (daysUntil <= 5) {
        approaching++;
        approachingClients.push({ ...c, daysUntil });
      } else {
        onTime++;
      }
    }

    setReturnStats({
      onTime,
      approaching,
      overdue,
      approachingClients: approachingClients.sort((a, b) => a.daysUntil - b.daysUntil),
      overdueClients: overdueClients.sort((a, b) => b.daysOverdue - a.daysOverdue),
    });
  };

  const fetchWaitlistCount = async () => {
    if (!companyId) return;
    const { count } = await supabase
      .from('waiting_list')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'waiting');
    setWaitlistCount(count || 0);
  };

  const navigate = (direction: number) => {
    const days = viewMode === 'day' ? 1 : viewMode === 'week' ? 7 : 30;
    setCurrentDate(addDays(currentDate, direction * days));
  };

  const updateStatus = async (id: string, status: string) => {
    const apt = appointments.find((a) => a.id === id);
    await supabase.from('appointments').update({ status: status as any }).eq('id', id);

    // If cancelling, trigger waitlist check
    if (status === 'cancelled' && apt) {
      try {
        await supabase.functions.invoke('check-waitlist', {
          body: {
            company_id: apt.company_id,
            professional_id: apt.professional_id,
            cancelled_start: apt.start_time,
            cancelled_end: apt.end_time,
            cancelled_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
          },
        });
      } catch (err) {
        console.error('Waitlist check failed:', err);
      }
    }

    fetchAppointments();
    fetchWaitlistCount();
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="text-2xl font-display font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Receita hoje</p>
              <p className="text-2xl font-display font-bold">
                R$ {stats.revenue.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Clientes hoje</p>
              <p className="text-2xl font-display font-bold">{stats.clients}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Bell className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aguardando vaga</p>
              <p className="text-2xl font-display font-bold">{waitlistCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Return Frequency Indicators */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display">Frequência de Retorno</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-success/5 border border-success/20">
              <UserCheck className="h-8 w-8 text-success" />
              <div>
                <p className="text-2xl font-display font-bold">{returnStats.onTime}</p>
                <p className="text-sm text-muted-foreground">Em dia</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-warning/5 border border-warning/20">
              <Clock className="h-8 w-8 text-warning" />
              <div>
                <p className="text-2xl font-display font-bold">{returnStats.approaching}</p>
                <p className="text-sm text-muted-foreground">Próx. do retorno</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/20">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-display font-bold">{returnStats.overdue}</p>
                <p className="text-sm text-muted-foreground">Atrasados</p>
              </div>
            </div>
          </div>

          {/* Overdue clients list */}
          {returnStats.overdueClients.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-destructive">Clientes atrasados</p>
              {returnStats.overdueClients.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 text-sm">
                  <div>
                    <span className="font-medium">{c.full_name}</span>
                    {c.whatsapp && <span className="text-muted-foreground ml-2">({c.whatsapp})</span>}
                  </div>
                  <Badge variant="destructive" className="text-xs">
                    {c.daysOverdue} dias atrasado
                  </Badge>
                </div>
              ))}
            </div>
          )}

          {/* Approaching clients list */}
          {returnStats.approachingClients.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-sm font-semibold text-warning">Próximos do retorno</p>
              {returnStats.approachingClients.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 text-sm">
                  <div>
                    <span className="font-medium">{c.full_name}</span>
                    {c.whatsapp && <span className="text-muted-foreground ml-2">({c.whatsapp})</span>}
                  </div>
                  <Badge variant="outline" className="text-xs border-warning text-warning">
                    {c.daysUntil === 0 ? 'Hoje' : `em ${c.daysUntil} dias`}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar Controls */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-display font-semibold min-w-[200px] text-center">
                {viewMode === 'day' && format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {viewMode === 'week' &&
                  `${format(startOfWeek(currentDate, { locale: ptBR }), 'dd/MM')} - ${format(endOfWeek(currentDate, { locale: ptBR }), 'dd/MM')}`}
                {viewMode === 'month' && format(currentDate, "MMMM 'de' yyyy", { locale: ptBR })}
              </h2>
              <Button variant="outline" size="icon" onClick={() => navigate(1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCurrentDate(new Date())}>
                Hoje
              </Button>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <Button
                  key={mode}
                  variant={viewMode === mode ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode(mode)}
                >
                  {mode === 'day' ? 'Dia' : mode === 'week' ? 'Semana' : 'Mês'}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-40" />
              <p>Nenhum agendamento neste período</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border bg-card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-display font-bold">
                        {format(parseISO(apt.start_time), 'HH:mm')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(apt.end_time), 'HH:mm')}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{apt.client?.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        com {apt.professional?.full_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-display font-bold text-lg">
                      R$ {Number(apt.total_price).toFixed(2)}
                    </span>
                    <Badge variant="outline" className={cn('text-xs', statusColors[apt.status])}>
                      {statusLabels[apt.status]}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    {apt.status === 'pending' && (
                      <Button size="sm" onClick={() => updateStatus(apt.id, 'confirmed')}>
                        Confirmar
                      </Button>
                    )}
                    {(apt.status === 'pending' || apt.status === 'confirmed') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => updateStatus(apt.id, 'completed')}
                        >
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => updateStatus(apt.id, 'cancelled')}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Dashboard;
