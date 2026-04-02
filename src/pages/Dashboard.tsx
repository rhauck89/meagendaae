import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import TrialBanner from '@/components/TrialBanner';
import TutorialProgressWidget from '@/components/TutorialProgressWidget';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, AlertTriangle, Bell, Mail, Cake, Ban, Trash2, Timer, RefreshCw, AlertCircle, TrendingUp, BarChart3, XCircle, Percent, Receipt } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BlockTimeDialog } from '@/components/BlockTimeDialog';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { format, addDays, addMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatWhatsApp } from '@/lib/whatsapp';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

type ViewMode = 'day' | 'week' | 'month';
type StatusTab = 'all' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

const statusColors: Record<string, string> = {
  pending: 'bg-warning/10 text-warning border-warning/20',
  confirmed: 'bg-primary/10 text-primary border-primary/20',
  in_progress: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  completed: 'bg-success/10 text-success border-success/20',
  no_show: 'bg-muted text-muted-foreground border-border',
  rescheduled: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
  late: 'bg-warning/10 text-warning border-warning/20',
};

const statusCardStyles: Record<string, string> = {
  pending: 'bg-warning/5 border-l-4 border-l-warning',
  confirmed: 'bg-[hsl(226,100%,97%)] border-l-4 border-l-primary',
  in_progress: 'bg-blue-50 border-l-4 border-l-blue-500',
  cancelled: 'bg-destructive/5 border-l-4 border-l-destructive opacity-60',
  completed: 'bg-muted/50 border-l-4 border-l-success opacity-75',
  no_show: 'bg-muted/30 border-l-4 border-l-muted-foreground opacity-60',
  rescheduled: 'bg-orange-50 border-l-4 border-l-orange-500 opacity-60',
  late: 'bg-warning/10 border-l-4 border-l-warning',
};

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: '🔵 Em atendimento',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  rescheduled: 'Reagendado',
  late: '⚠️ Atrasado',
};

const getDisplayStatus = (apt: any): string => {
  if (['completed', 'cancelled', 'no_show', 'rescheduled'].includes(apt.status)) {
    return apt.status;
  }
  const now = new Date();
  const endTime = parseISO(apt.end_time);
  const startTime = parseISO(apt.start_time);
  if ((apt.status === 'confirmed' || apt.status === 'pending') && now > endTime) {
    return 'late';
  }
  if (apt.status === 'confirmed' && now >= startTime && now <= endTime) {
    return 'in_progress';
  }
  return apt.status;
};

const statusFilterMap: Record<StatusTab, (apt: any) => boolean> = {
  all: () => true,
  confirmed: (apt) => {
    const ds = getDisplayStatus(apt);
    return ds === 'confirmed' || ds === 'in_progress' || ds === 'late' || apt.status === 'pending';
  },
  completed: (apt) => apt.status === 'completed',
  cancelled: (apt) => apt.status === 'cancelled' || apt.status === 'no_show',
  rescheduled: (apt) => apt.status === 'rescheduled',
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
  const [monthlyStats, setMonthlyStats] = useState({ revenue: 0, revenueCompleted: 0, clients: 0, cancellations: 0, occupancyRate: 0, avgTicket: 0 });
  const [returnStats, setReturnStats] = useState<ReturnStats>({ onTime: 0, approaching: 0, overdue: 0, approachingClients: [], overdueClients: [] });
  const [waitlistCount, setWaitlistCount] = useState(0);
  const [waitlistServiceBreakdown, setWaitlistServiceBreakdown] = useState<Record<string, number>>({});
  const [hasOpenSlot, setHasOpenSlot] = useState(false);
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
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<string | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const routerNavigate = useRouterNavigate();
  const [waitlistClients, setWaitlistClients] = useState<string[]>([]);
  const [companySlug, setCompanySlug] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState('barbershop');
  const [statusTab, setStatusTab] = useState<StatusTab>('confirmed');

  // Cleanup orphan Radix portal elements when reschedule modal closes
  useEffect(() => {
    if (!rescheduleDialogOpen) {
      // Small delay to allow animation to complete
      const timer = setTimeout(() => {
        document.querySelectorAll('[data-radix-popper-content-wrapper]').forEach(el => el.remove());
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [rescheduleDialogOpen]);

  useEffect(() => {
    if (!companyId) return;
    fetchCollaborators();
    // Fetch company slug for booking links
    supabase.from('companies').select('slug, business_type').eq('id', companyId).single().then(({ data }) => {
      if (data) {
        setCompanySlug(data.slug);
        setCompanyBusinessType(data.business_type);
      }
    });
  }, [companyId]);

  useEffect(() => {
    if (!companyId) return;
    fetchAppointments();
    fetchReturnStats();
    fetchWaitlistCount();
    fetchReminderCount();
    fetchBirthdays();
    fetchBlockedTimes();
    fetchMonthlyStats();
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
        appointment_services(*, service:services(name)),
        rescheduled_from:appointments!rescheduled_from_id(start_time)
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
        revenue: todayAppts.filter((a) => a.status === 'confirmed' || a.status === 'completed').reduce((sum, a) => sum + Number(a.total_price), 0),
        revenueCompleted: todayAppts.filter((a) => a.status === 'completed').reduce((sum, a) => sum + Number(a.total_price), 0),
        clients: new Set(todayAppts.map((a) => a.client_id)).size,
      });
    }
  };

  const fetchMonthlyStats = async () => {
    if (!companyId) return;
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    let query = supabase
      .from('appointments')
      .select('status, total_price, client_id')
      .eq('company_id', companyId!)
      .gte('start_time', toSpStart(monthStart))
      .lte('start_time', toSpEnd(monthEnd));

    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data } = await query;
    if (!data) return;

    const confirmed = data.filter(a => a.status === 'confirmed' || a.status === 'completed');
    const completed = data.filter(a => a.status === 'completed');
    const cancelled = data.filter(a => a.status === 'cancelled');
    const uniqueClients = new Set(data.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').map(a => a.client_id)).size;

    const revenue = confirmed.reduce((sum, a) => sum + Number(a.total_price), 0);
    const revenueCompleted = completed.reduce((sum, a) => sum + Number(a.total_price), 0);
    const totalAppts = data.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length;

    // Rough occupancy: confirmed+completed vs total non-cancelled
    const occupancyRate = totalAppts > 0 ? Math.round((confirmed.length / Math.max(totalAppts, 1)) * 100) : 0;
    const avgTicket = uniqueClients > 0 ? revenue / uniqueClients : 0;

    setMonthlyStats({
      revenue,
      revenueCompleted,
      clients: uniqueClients,
      cancellations: cancelled.length,
      occupancyRate,
      avgTicket,
    });
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
    // Count from waiting_list
    const { count: wlCount } = await supabase
      .from('waiting_list')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('status', 'waiting');
    // Count from waitlist
    const { count: wCount } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('notified', false);
    setWaitlistCount((wlCount || 0) + (wCount || 0));

    // Fetch client names + service_ids for tooltip from both tables
    const { data: wlData } = await supabase
      .from('waiting_list')
      .select('client:profiles!waiting_list_client_id_fkey(full_name), service_ids')
      .eq('company_id', companyId)
      .eq('status', 'waiting')
      .limit(10);
    const { data: wData } = await supabase
      .from('waitlist')
      .select('client_name, service_ids')
      .eq('company_id', companyId)
      .eq('notified', false)
      .limit(10);
    const names = [
      ...(wlData?.map((d: any) => d.client?.full_name).filter(Boolean) || []),
      ...(wData?.map((d: any) => d.client_name).filter(Boolean) || []),
    ];
    setWaitlistClients(names.slice(0, 10));

    // Service breakdown
    const allServiceIds = [
      ...(wlData?.flatMap((d: any) => d.service_ids || []) || []),
      ...(wData?.flatMap((d: any) => d.service_ids || []) || []),
    ];
    if (allServiceIds.length > 0) {
      const uniqueIds = [...new Set(allServiceIds)];
      const { data: svcs } = await supabase.from('services').select('id, name').in('id', uniqueIds);
      const breakdown: Record<string, number> = {};
      for (const sid of allServiceIds) {
        const name = svcs?.find((s: any) => s.id === sid)?.name || 'Serviço';
        breakdown[name] = (breakdown[name] || 0) + 1;
      }
      setWaitlistServiceBreakdown(breakdown);
    } else {
      setWaitlistServiceBreakdown({});
    }

    // Check if there's an open slot today (simple heuristic: fewer than expected appointments)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const { count: todayApptCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .gte('start_time', `${todayStr}T00:00:00`)
      .lt('start_time', `${todayStr}T23:59:59`)
      .not('status', 'in', '("cancelled","no_show")');
    // If there are waitlist entries and fewer than 8 appointments today, hint availability
    setHasOpenSlot((wlCount || 0) + (wCount || 0) > 0 && (todayApptCount || 0) < 8);
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

  const openRescheduleDialog = (apt: any) => {
    setRescheduleTarget(apt);
    setRescheduleDate(undefined);
    setRescheduleSlots([]);
    setRescheduleSelectedSlot(null);
    setRescheduleDialogOpen(true);
  };

  const fetchRescheduleSlots = async (date: Date) => {
    if (!rescheduleTarget || !companyId) return;
    setRescheduleSlotsLoading(true);
    setRescheduleSelectedSlot(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const { data: profHours } = await supabase
        .from('professional_working_hours')
        .select('*')
        .eq('professional_id', rescheduleTarget.professional_id)
        .eq('company_id', companyId);
      const { data: bizHours } = await supabase
        .from('business_hours')
        .select('*')
        .eq('company_id', companyId);
      const { data: blocks } = await supabase
        .from('blocked_times')
        .select('*')
        .eq('professional_id', rescheduleTarget.professional_id)
        .eq('block_date', dateStr);
      const { data: exceptions } = await supabase
        .from('business_exceptions')
        .select('*')
        .eq('company_id', companyId)
        .eq('exception_date', dateStr);
      const { data: company } = await supabase
        .from('companies')
        .select('buffer_minutes')
        .eq('id', companyId)
        .single();

      const totalDuration = rescheduleTarget.appointment_services?.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      ) || 30;

      // Fetch all appointments for this date/professional, then exclude the one being rescheduled by ID
      const { data: allAppts } = await supabase
        .from('appointments')
        .select('id, start_time, end_time')
        .eq('professional_id', rescheduleTarget.professional_id)
        .eq('company_id', companyId)
        .gte('start_time', `${dateStr}T00:00:00`)
        .lt('start_time', `${dateStr}T23:59:59`)
        .not('status', 'in', '("cancelled","no_show")')
        .neq('id', rescheduleTarget.id);

      const { calculateAvailableSlots } = await import('@/lib/availability-engine');
      const slots = calculateAvailableSlots({
        date,
        totalDuration,
        businessHours: bizHours || [],
        exceptions: exceptions || [],
        existingAppointments: allAppts || [],
        bufferMinutes: company?.buffer_minutes || 0,
        professionalHours: profHours && profHours.length > 0 ? profHours : undefined,
        blockedTimes: blocks || [],
      });
      setRescheduleSlots(slots);
    } catch (err) {
      console.error('Failed to fetch reschedule slots:', err);
      toast.error('Erro ao buscar horários disponíveis');
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget || !rescheduleSelectedSlot || !rescheduleDate) return;
    setRescheduleLoading(true);
    try {
      const totalDuration = rescheduleTarget.appointment_services?.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      ) || 30;
      const dateStr = format(rescheduleDate, 'yyyy-MM-dd');
      const newStart = `${dateStr}T${rescheduleSelectedSlot}:00`;
      const newEndDate = addMinutes(new Date(`${dateStr}T${rescheduleSelectedSlot}:00`), totalDuration);
      const newEnd = `${dateStr}T${format(newEndDate, 'HH:mm')}:00`;

      const { error } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: rescheduleTarget.id,
        p_new_start: newStart,
        p_new_end: newEnd,
      });
      if (error) {
        toast.error(error.message || 'Erro ao reagendar');
        return;
      }
      toast.success('Agendamento reagendado com sucesso');
      const clientWhatsapp = rescheduleTarget.client_whatsapp;
      if (clientWhatsapp) {
        const msg = encodeURIComponent(
          `📋 Seu horário foi atualizado.\n\n📅 ${format(rescheduleDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}\n⏰ ${rescheduleSelectedSlot}\n\nSe precisar alterar novamente, utilize o link enviado anteriormente.`
        );
        window.open(`https://wa.me/${formatWhatsApp(clientWhatsapp)}?text=${msg}`, '_blank');
      }
      fetchAppointments();
    } catch {
      toast.error('Erro ao reagendar');
    } finally {
      setRescheduleLoading(false);
      setRescheduleDialogOpen(false);
      setRescheduleTarget(null);
    }
  };

  const renderUpcomingAppointments = () => {
    const now = new Date();
    const todayAppts = appointments
      .filter(a => a.status === 'confirmed' || a.status === 'completed')
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const currentApt = todayAppts.find(
      a => a.status === 'confirmed' && now >= parseISO(a.start_time) && now <= parseISO(a.end_time)
    );
    const futureAppts = todayAppts.filter(a => parseISO(a.start_time) > now && a.status === 'confirmed');
    const nextApt = futureAppts[0] || null;
    const followingAppts = futureAppts.slice(1, 3);

    const upcomingItems: { apt: any; label: string; icon: string; style: string }[] = [];
    if (currentApt) upcomingItems.push({ apt: currentApt, label: 'Em atendimento', icon: '🔵', style: 'bg-blue-50 border-l-4 border-l-blue-500' });
    if (nextApt) upcomingItems.push({ apt: nextApt, label: 'Próximo', icon: '⏭', style: 'bg-primary/5 border-l-4 border-l-primary' });
    followingAppts.forEach(a => upcomingItems.push({ apt: a, label: 'Depois', icon: '🕒', style: 'bg-muted/50 border-l-4 border-l-muted-foreground' }));

    if (upcomingItems.length === 0) return null;

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Clock className="h-5 w-5" /> Próximos atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {upcomingItems.map(({ apt, label, icon, style }) => (
              <div key={apt.id} className={cn('flex items-center gap-4 p-4 rounded-xl border transition-shadow', style)}>
                <div className="text-center min-w-[60px]">
                  <p className="text-lg font-display font-bold">{format(parseISO(apt.start_time), 'HH:mm')}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(apt.end_time), 'HH:mm')}</p>
                </div>
                <div className="flex-1">
                  <p className="font-semibold">{apt.client_name || apt.client?.name || 'Cliente'}</p>
                  <p className="text-sm text-muted-foreground">
                    {apt.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                  </p>
                  {apt.promotion_id && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 mt-0.5">🔥 Promoção</span>
                  )}
                  <p className="text-xs text-muted-foreground">com {apt.professional?.full_name}</p>
                </div>
                <Badge variant="outline" className="text-xs whitespace-nowrap">
                  {icon} {label}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <TrialBanner />
      <TutorialProgressWidget />
      {/* Próximos atendimentos - shown first on mobile only */}
      <div className="block lg:hidden">
        {renderUpcomingAppointments()}
      </div>

      {/* Daily Stats */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">📊 Resumo do Dia</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Hoje</p>
              <p className="text-2xl font-display font-bold">{stats.total}</p>
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Card
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                hasOpenSlot && "ring-2 ring-warning/50 bg-warning/5"
              )}
              onClick={() => routerNavigate('/dashboard/waitlist')}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", hasOpenSlot ? "bg-warning/20" : "bg-warning/10")}>
                  <Bell className="h-6 w-6 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Aguardando vaga</p>
                  <p className="text-2xl font-display font-bold">{waitlistCount}</p>
                  {hasOpenSlot && (
                    <p className="text-xs font-semibold text-warning">⚡ Vaga disponível</p>
                  )}
                  {Object.keys(waitlistServiceBreakdown).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {Object.entries(waitlistServiceBreakdown).slice(0, 3).map(([name, count]) => (
                        <Badge key={name} variant="outline" className="text-[10px] px-1.5 py-0">
                          {name} ({count})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-[220px]">
            {waitlistClients.length > 0 ? (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Primeiros na fila:</p>
                {waitlistClients.slice(0, 3).map((name, i) => (
                  <p key={i} className="text-sm">• {name}</p>
                ))}
                {waitlistCount > 3 && (
                  <p className="text-xs text-muted-foreground mt-1">+{waitlistCount - 3} mais</p>
                )}
              </div>
            ) : (
              <p className="text-sm">Nenhum cliente na fila</p>
            )}
          </TooltipContent>
        </Tooltip>
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
      </div>

      {/* Monthly Stats */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">📈 Resumo do Mês</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Clientes atendidos</p>
                <p className="text-2xl font-display font-bold">{monthlyStats.clients}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cancelamentos</p>
                <p className="text-2xl font-display font-bold">{monthlyStats.cancellations}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa de ocupação</p>
                <p className="text-2xl font-display font-bold">{monthlyStats.occupancyRate}%</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Receipt className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ticket médio</p>
                <p className="text-2xl font-display font-bold">R$ {monthlyStats.avgTicket.toFixed(2)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {isAdmin && (
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
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-destructive/5 text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{c.full_name}</span>
                  </div>
                  <Badge variant="destructive" className="text-xs shrink-0">
                    {c.daysOverdue}d atraso
                  </Badge>
                  {c.whatsapp && companySlug && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => {
                        const prefix = companyBusinessType === 'esthetic' ? 'estetica' : 'barbearia';
                        const bookingUrl = `${window.location.origin}/${prefix}/${companySlug}`;
                        const msg = encodeURIComponent(
                          `Olá ${c.full_name}! 👋\n\nJá faz ${c.daysOverdue} dias desde sua última visita.\n\nQue tal agendar seu próximo horário?\n\n📅 Agende aqui: ${bookingUrl}\n\nEsperamos você!`
                        );
                        window.open(`https://wa.me/${formatWhatsApp(c.whatsapp)}?text=${msg}`, '_blank');
                      }}
                    >
                      📲
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Approaching clients list */}
          {returnStats.approachingClients.length > 0 && (
            <div className="space-y-2 mt-3">
              <p className="text-sm font-semibold text-warning">Próximos do retorno</p>
              {returnStats.approachingClients.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-warning/5 text-sm gap-2">
                  <div className="min-w-0 flex-1">
                    <span className="font-medium">{c.full_name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs border-warning text-warning shrink-0">
                    {c.daysUntil === 0 ? 'Hoje' : `em ${c.daysUntil}d`}
                  </Badge>
                  {c.whatsapp && companySlug && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs shrink-0"
                      onClick={() => {
                        const prefix = companyBusinessType === 'esthetic' ? 'estetica' : 'barbearia';
                        const bookingUrl = `${window.location.origin}/${prefix}/${companySlug}`;
                        const msg = encodeURIComponent(
                          `Olá ${c.full_name}! 👋\n\nEstá chegando a hora do seu próximo atendimento.\n\n📅 Agende aqui: ${bookingUrl}\n\nEsperamos você!`
                        );
                        window.open(`https://wa.me/${formatWhatsApp(c.whatsapp)}?text=${msg}`, '_blank');
                      }}
                    >
                      📲
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      )}

      {/* Birthday Indicator - Admin only */}
      {isAdmin && birthdayClients.length > 0 && (
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

      {/* Próximos atendimentos - desktop only (already shown on mobile above) */}
      <div className="hidden lg:block">
        {renderUpcomingAppointments()}
      </div>

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

          {/* Status Tabs */}
          {(() => {
            const counts = {
              all: appointments.length,
              confirmed: appointments.filter(statusFilterMap.confirmed).length,
              completed: appointments.filter(statusFilterMap.completed).length,
              cancelled: appointments.filter(statusFilterMap.cancelled).length,
              rescheduled: appointments.filter(statusFilterMap.rescheduled).length,
            };
            const filteredAppts = appointments.filter(statusFilterMap[statusTab]);

            return (
              <>
                <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)} className="mb-4">
                  <TabsList className="w-full flex flex-wrap h-auto gap-1">
                    <TabsTrigger value="all" className="text-xs sm:text-sm">Todos ({counts.all})</TabsTrigger>
                    <TabsTrigger value="confirmed" className="text-xs sm:text-sm">Confirmados ({counts.confirmed})</TabsTrigger>
                    <TabsTrigger value="completed" className="text-xs sm:text-sm">Concluídos ({counts.completed})</TabsTrigger>
                    <TabsTrigger value="cancelled" className="text-xs sm:text-sm">Cancelados ({counts.cancelled})</TabsTrigger>
                    <TabsTrigger value="rescheduled" className="text-xs sm:text-sm">Reagendados ({counts.rescheduled})</TabsTrigger>
                  </TabsList>
                </Tabs>

                {filteredAppts.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhum agendamento neste período</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredAppts.map((apt) => {
                      const displayStatus = getDisplayStatus(apt);
                      return (
                        <div
                          key={apt.id}
                          className={cn("flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl border transition-shadow hover:shadow-md", statusCardStyles[displayStatus] || 'bg-card')}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <div className="text-center min-w-[60px]">
                              <p className="text-lg font-display font-bold">
                                {viewMode !== 'day'
                                  ? `${format(parseISO(apt.start_time), 'dd/MM')} • ${format(parseISO(apt.start_time), 'HH:mm')}`
                                  : format(parseISO(apt.start_time), 'HH:mm')}
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
                              {apt.promotion_id && (
                                <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 mt-0.5">🔥 Promoção</span>
                              )}
                              <p className="text-xs text-muted-foreground">
                                com {apt.professional?.full_name}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-bold text-lg">
                              R$ {Number(apt.total_price).toFixed(2)}
                            </span>
                            <Badge variant="outline" className={cn('text-xs', statusColors[displayStatus])}>
                              {statusLabels[displayStatus]}
                            </Badge>
                            {apt.rescheduled_from_id && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div>
                                    <Badge className="text-xs bg-orange-500 text-white border-orange-500 hover:bg-orange-600 cursor-help">
                                      🔁 Reagendado
                                    </Badge>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {apt.rescheduled_from?.start_time
                                    ? `Reagendado de ${format(parseISO(apt.rescheduled_from.start_time), "dd/MM/yyyy 'às' HH:mm")}`
                                    : 'Reagendado de horário anterior'}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                          <div className="flex gap-1 flex-wrap">
                            {(displayStatus === 'in_progress' || displayStatus === 'late') && (
                              <Button
                                size="sm"
                                className="bg-success hover:bg-success/90 text-white"
                                onClick={() => {
                                  setCompleteTarget(apt);
                                  setCompleteDialogOpen(true);
                                }}
                              >
                                ✓ Concluir atendimento
                              </Button>
                            )}
                            {apt.status === 'pending' && displayStatus !== 'late' && (
                              <Button size="sm" onClick={() => updateStatus(apt.id, 'confirmed')}>
                                Confirmar
                              </Button>
                            )}
                            {(apt.status === 'pending' || apt.status === 'confirmed') && displayStatus !== 'in_progress' && displayStatus !== 'late' && (
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
                            )}
                            {(apt.status === 'pending' || apt.status === 'confirmed') && (
                              <>
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
                                {!apt.promotion_id && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => openRescheduleDialog(apt)}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-1" />
                                    Reagendar
                                  </Button>
                                )}
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
                      );
                    })}
                  </div>
                )}
              </>
            );
          })()}
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

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => { setRescheduleDialogOpen(open); if (!open) { setRescheduleTarget(null); setRescheduleDate(undefined); setRescheduleSlots([]); setRescheduleSelectedSlot(null); } }}>
        {rescheduleDialogOpen && (
        <DialogContent className="sm:max-w-[720px] max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" /> Reagendar
            </DialogTitle>
            <DialogDescription>
              {rescheduleTarget && (
                <span className="block space-y-1 mt-1">
                  <span className="block"><strong>Cliente:</strong> {rescheduleTarget.client_name || 'Cliente'}</span>
                  <span className="block"><strong>Serviço:</strong> {rescheduleTarget.appointment_services?.map((s: any) => s.service?.name).join(', ')}</span>
                  <span className="block"><strong>Horário atual:</strong> {format(parseISO(rescheduleTarget.start_time), 'dd/MM/yyyy HH:mm')} - {format(parseISO(rescheduleTarget.end_time), 'HH:mm')}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-[320px_1fr] gap-6 pt-2">
            {/* Left: Calendar */}
            <div className="overflow-hidden">
              <p className="text-sm font-medium mb-2">Selecione a nova data</p>
              <DatePickerCalendar
                mode="single"
                selected={rescheduleDate}
                onSelect={(date) => {
                  if (date) {
                    setRescheduleDate(date);
                    fetchRescheduleSlots(date);
                  }
                }}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                className="rounded-md border pointer-events-auto"
                locale={ptBR}
              />
            </div>
            {/* Right: Slots */}
            <div className="flex flex-col">
              <p className="text-sm font-medium mb-2">Horários disponíveis</p>
              {!rescheduleDate ? (
                <p className="text-sm text-muted-foreground">Selecione uma data para ver os horários</p>
              ) : rescheduleSlotsLoading ? (
                <p className="text-sm text-muted-foreground">Carregando...</p>
              ) : rescheduleSlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum horário disponível nesta data</p>
              ) : (
                <div className="grid grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
                  {rescheduleSlots.map((slot) => (
                    <Button
                      key={slot}
                      size="sm"
                      variant={rescheduleSelectedSlot === slot ? 'default' : 'outline'}
                      onClick={() => setRescheduleSelectedSlot(slot)}
                    >
                      {slot}
                    </Button>
                  ))}
                </div>
              )}
              {rescheduleSelectedSlot && (
                <Button
                  className="w-full mt-4"
                  disabled={rescheduleLoading}
                  onClick={confirmReschedule}
                >
                  {rescheduleLoading ? 'Reagendando...' : `Confirmar às ${rescheduleSelectedSlot}`}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Dashboard;
