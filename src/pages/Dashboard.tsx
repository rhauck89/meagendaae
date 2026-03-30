import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, AlertTriangle, Bell, Mail, Cake, Ban, Trash2, Timer } from 'lucide-react';
import { BlockTimeDialog } from '@/components/BlockTimeDialog';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatWhatsApp } from '@/lib/whatsapp';

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
  const { isAdmin, profileId } = useUserRole();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, revenueCompleted: 0, clients: 0 });
  const [returnStats, setReturnStats] = useState<ReturnStats>({ onTime: 0, approaching: 0, overdue: 0, approachingClients: [], overdueClients: [] });
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [reminderCount, setReminderCount] = useState(0);
  const [birthdayClients, setBirthdayClients] = useState<any[]>([]);
  const [filterProfessional, setFilterProfessional] = useState<string>('all');
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [collaboratorsList, setCollaboratorsList] = useState<any[]>([]);
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [delayTargetId, setDelayTargetId] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [delayLoading, setDelayLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    fetchCollaborators();
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetchAppointments();
    fetchReturnStats();
    fetchWaitlistCount();
    fetchReminderCount();
    fetchBirthdays();
    fetchBlockedTimes();
  }, [companyId, currentDate, viewMode, filterProfessional]);

  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, profile:profiles(full_name)')
      .eq('company_id', companyId!);
    if (data) setCollaboratorsList(data);
  };

  const fetchBlockedTimes = async () => {
    const { start, end } = getDateRange();
    let query = supabase
      .from('blocked_times' as any)
      .select('*')
      .eq('company_id', companyId!)
      .gte('block_date', format(start, 'yyyy-MM-dd'))
      .lte('block_date', format(end, 'yyyy-MM-dd'));

    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data } = await query;
    const blocks = (data as any[]) || [];

    // Enrich with professional names from collaborators list
    const enriched = blocks.map(bt => {
      const collab = collaboratorsList.find(c => c.profile_id === bt.professional_id);
      return { ...bt, professional: { full_name: (collab?.profile as any)?.full_name || '' } };
    });
    setBlockedTimes(enriched);
  };

  const deleteBlockedTime = async (id: string) => {
    const { error } = await supabase.from('blocked_times' as any).delete().eq('id', id);
    if (error) {
      toast.error('Erro ao remover bloqueio');
    } else {
      toast.success('Bloqueio removido');
      fetchBlockedTimes();
    }
  };

  const SP_OFFSET = '-03:00';

  const toSpStart = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return `${dateStr}T00:00:00${SP_OFFSET}`;
  };

  const toSpEnd = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return `${dateStr}T23:59:59${SP_OFFSET}`;
  };

  const getDateRange = () => {
    if (viewMode === 'day') return { start: currentDate, end: currentDate };
    if (viewMode === 'week') return { start: startOfWeek(currentDate, { locale: ptBR }), end: endOfWeek(currentDate, { locale: ptBR }) };
    return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
  };

  const fetchAppointments = async () => {
    const { start, end } = getDateRange();
    let query = supabase
      .from('appointments')
      .select(`
        *,
        client:clients!appointments_client_id_fkey(name, whatsapp),
        professional:profiles!appointments_professional_id_fkey(full_name),
        appointment_services(*, service:services(name))
      `)
      .eq('company_id', companyId!)
      .gte('start_time', toSpStart(start))
      .lte('start_time', toSpEnd(end))
      .order('start_time');

    // Non-admin sees only their own appointments
    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data } = await query;

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

  const fetchReminderCount = async () => {
    if (!companyId) return;
    const { count } = await supabase
      .from('webhook_events')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('event_type', ['appointment_reminder', 'appointment_reminder_24h', 'appointment_reminder_3h'] as any);
    setReminderCount(count || 0);
  };

  const fetchBirthdays = async () => {
    if (!companyId) return;
    const { data: clients } = await supabase
      .from('profiles')
      .select('id, full_name, birth_date, whatsapp')
      .eq('company_id', companyId)
      .not('birth_date', 'is', null);

    if (!clients) return;

    const today = new Date();
    const upcoming: any[] = [];

    for (const c of clients) {
      if (!c.birth_date) continue;
      const bday = new Date(c.birth_date);
      const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (bdayThisYear < today) bdayThisYear.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) {
        upcoming.push({ ...c, daysUntil, bdayDisplay: format(bday, 'dd/MM') });
      }
    }

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    setBirthdayClients(upcoming);
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

  const registerDelay = async (minutes: number) => {
    if (!delayTargetId) return;
    setDelayLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_delay', {
        p_appointment_id: delayTargetId,
        p_delay_minutes: minutes,
      });

      if (error) {
        toast.error(error.message || 'Erro ao registrar atraso');
        return;
      }

      toast.success(`Atraso de ${minutes} min registrado com sucesso`);

      // Send WhatsApp notifications to affected clients
      const affected = (data as any[]) || [];
      for (const a of affected) {
        if (a.client_whatsapp) {
          const msg = encodeURIComponent(
            `⚠️ Aviso de atraso\n\nOlá ${a.client_name || 'Cliente'}! 👋\n\nHouve um pequeno atraso no atendimento anterior.\n\nSeu horário foi ajustado para:\n🕐 ${a.new_start} - ${a.new_end}\n\nObrigado pela compreensão!`
          );
          const phone = formatWhatsApp(a.client_whatsapp);
          window.open(`https://wa.me/${phone}?text=${msg}`, '_blank');
        }
      }

      fetchAppointments();
    } catch (err) {
      toast.error('Erro ao registrar atraso');
    } finally {
      setDelayLoading(false);
      setDelayDialogOpen(false);
      setDelayTargetId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-secondary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Lembretes enviados</p>
              <p className="text-2xl font-display font-bold">{reminderCount}</p>
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

      {/* Birthday Indicator */}
      {birthdayClients.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-display flex items-center gap-2">
              <Cake className="h-5 w-5" /> Aniversários Próximos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {birthdayClients.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-primary/5 text-sm">
                  <div>
                    <span className="font-medium">{c.full_name}</span>
                    <span className="text-muted-foreground ml-2">({c.bdayDisplay})</span>
                    {c.whatsapp && <span className="text-muted-foreground ml-1">• {c.whatsapp}</span>}
                  </div>
                  <Badge variant="outline" className="text-xs border-primary text-primary">
                    {c.daysUntil === 0 ? '🎂 Hoje!' : `em ${c.daysUntil} dias`}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
            {isAdmin && (
              <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {collaboratorsList.map((c) => (
                    <SelectItem key={c.profile_id} value={c.profile_id}>
                      {(c.profile as any)?.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <BlockTimeDialog
              professionals={collaboratorsList.map(c => ({ profile_id: c.profile_id, full_name: (c.profile as any)?.full_name || 'Sem nome' }))}
              onCreated={fetchBlockedTimes}
            />
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
          {/* Blocked Times */}
          {blockedTimes.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-sm font-semibold text-muted-foreground flex items-center gap-1">
                <Ban className="h-4 w-4" /> Horários bloqueados
              </p>
              {blockedTimes.map((bt: any) => (
                <div
                  key={bt.id}
                  className="flex items-center justify-between p-3 rounded-xl border border-destructive/20 bg-destructive/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="text-center min-w-[60px]">
                      <p className="text-sm font-bold text-destructive">{bt.start_time?.slice(0, 5)}</p>
                      <p className="text-xs text-muted-foreground">{bt.end_time?.slice(0, 5)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-destructive">Bloqueado</p>
                      <p className="text-xs text-muted-foreground">
                        {bt.professional?.full_name || ''}{bt.reason ? ` • ${bt.reason}` : ''}
                      </p>
                      <p className="text-xs text-muted-foreground">{bt.block_date}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => deleteBlockedTime(bt.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
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
                      <p className="font-semibold">{apt.client_name || apt.client?.name || 'Cliente'}</p>
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
                  <div className="flex gap-1 flex-wrap">
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
                          onClick={() => {
                            setCompleteTarget(apt);
                            setCompleteDialogOpen(true);
                          }}
                        >
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setDelayTargetId(apt.id);
                            setDelayDialogOpen(true);
                          }}
                        >
                          <Timer className="h-4 w-4 mr-1" />
                          Atraso
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() => {
                            setCancelTarget(apt);
                            setCancelDialogOpen(true);
                          }}
                        >
                          Cancelar
                        </Button>
                      </>
                    )}
                    {apt.delay_minutes > 0 && (
                      <Badge variant="outline" className="text-xs border-warning text-warning">
                        <Timer className="h-3 w-3 mr-1" />
                        +{apt.delay_minutes}min
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delay Dialog */}
      <Dialog open={delayDialogOpen} onOpenChange={setDelayDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" /> Registrar Atraso
            </DialogTitle>
            <DialogDescription>
              Selecione o tempo de atraso. Todos os agendamentos seguintes serão ajustados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {[5, 10, 15, 20].map((min) => (
              <Button
                key={min}
                variant="outline"
                className="h-16 text-lg font-display"
                disabled={delayLoading}
                onClick={() => registerDelay(min)}
              >
                {min} min
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja cancelar este agendamento?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                {cancelTarget && (
                  <>
                    <p><strong>Cliente:</strong> {cancelTarget.client_name || 'N/A'}</p>
                    <p><strong>Serviço:</strong> {cancelTarget.appointment_services?.map((s: any) => s.service?.name).join(', ') || 'N/A'}</p>
                    <p><strong>Horário:</strong> {format(parseISO(cancelTarget.start_time), 'HH:mm')} - {format(parseISO(cancelTarget.end_time), 'HH:mm')}</p>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar ação</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (cancelTarget) updateStatus(cancelTarget.id, 'cancelled');
                setCancelDialogOpen(false);
                setCancelTarget(null);
              }}
            >
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete Confirmation Dialog */}
      <AlertDialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {completeTarget && new Date() < parseISO(completeTarget.start_time)
                ? 'Este atendimento ainda não começou'
                : 'Deseja concluir este atendimento?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {completeTarget && new Date() < parseISO(completeTarget.start_time)
                ? 'Deseja realmente concluir este serviço?'
                : `${completeTarget?.client_name || 'Cliente'} — ${format(parseISO(completeTarget?.start_time || new Date().toISOString()), 'HH:mm')}`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (completeTarget) {
                  updateStatus(completeTarget.id, 'completed');
                  toast.success('Serviço concluído com sucesso');
                }
                setCompleteDialogOpen(false);
                setCompleteTarget(null);
              }}
            >
              {completeTarget && new Date() < parseISO(completeTarget.start_time)
                ? 'Concluir mesmo assim'
                : 'Concluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Dashboard;
