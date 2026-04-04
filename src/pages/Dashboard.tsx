import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useOnDataRefresh } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import TrialBanner from '@/components/TrialBanner';
import TutorialProgressWidget from '@/components/TutorialProgressWidget';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, AlertTriangle, Bell, Mail, Cake, Ban, Trash2, Timer, RefreshCw, AlertCircle, TrendingUp, BarChart3, XCircle, Percent, Receipt, Send } from 'lucide-react';
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
import { ManualAppointmentDialog } from '@/components/ManualAppointmentDialog';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

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
  all: (apt) => apt.status !== 'rescheduled',
  confirmed: (apt) => {
    const ds = getDisplayStatus(apt);
    return ds === 'confirmed' || ds === 'in_progress' || ds === 'late' || apt.status === 'pending';
  },
  completed: (apt) => apt.status === 'completed',
  cancelled: (apt) => apt.status === 'cancelled' || apt.status === 'no_show',
  rescheduled: (apt) => apt.status === 'rescheduled',
};


const Dashboard = () => {
  const { companyId, user } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, revenueCompleted: 0, clients: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ revenue: 0, revenueCompleted: 0, clients: 0, cancellations: 0, occupancyRate: 0, avgTicket: 0 });
  const [dailyTrends, setDailyTrends] = useState<{ date: string; revenue: number; clients: number; cancellations: number; occupancy: number }[]>([]);
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
  const [completePaymentMethod, setCompletePaymentMethod] = useState('pix');
  const [completeCustomAmount, setCompleteCustomAmount] = useState('');
  const [completeDiscount, setCompleteDiscount] = useState('');
  const [completeObservation, setCompleteObservation] = useState('');
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
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [companyBusinessType, setCompanyBusinessType] = useState('barbershop');
  const [statusTab, setStatusTab] = useState<StatusTab>('confirmed');
  const [manualAppointmentOpen, setManualAppointmentOpen] = useState(false);

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
    fetchDailyTrends();
    fetchWaitlistCount();
    fetchReminderCount();
    fetchBirthdays();
    fetchBlockedTimes();
    fetchMonthlyStats();
    fetchUpcomingAppointments();
  }, [companyId, currentDate, viewMode, filterProfessional]);

  // Listen for external refresh events (e.g. from other pages)
  const handleAgendaRefresh = useCallback(() => {
    if (companyId) {
      fetchAppointments();
      fetchMonthlyStats();
      fetchUpcomingAppointments();
    }
  }, [companyId, currentDate, viewMode, filterProfessional]);
  useOnDataRefresh('agenda', handleAgendaRefresh);

  const fetchUpcomingAppointments = async () => {
    const now = new Date().toISOString();
    let query = supabase
      .from('appointments')
      .select(`
        *,
        client:clients!appointments_client_id_fkey(name, whatsapp),
        professional:profiles!appointments_professional_id_fkey(full_name),
        appointment_services(*, service:services(name))
      `)
      .eq('company_id', companyId!)
      .in('status', ['confirmed', 'pending'])
      .gte('start_time', now)
      .order('start_time', { ascending: true })
      .limit(5);

    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data } = await query;
    setUpcomingAppointments(data || []);
  };

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

  const fetchDailyTrends = async () => {
    if (!companyId) return;
    const days = 14;
    const startDate = format(addDays(new Date(), -days + 1), 'yyyy-MM-dd');
    const { data } = await supabase
      .from('appointments')
      .select('start_time, status, total_price')
      .eq('company_id', companyId)
      .gte('start_time', `${startDate}T00:00:00`)
      .order('start_time', { ascending: true });

    if (!data) return;

    const map: Record<string, { revenue: number; clients: number; cancellations: number; total: number }> = {};
    for (let i = 0; i < days; i++) {
      const d = format(addDays(new Date(), -days + 1 + i), 'yyyy-MM-dd');
      map[d] = { revenue: 0, clients: 0, cancellations: 0, total: 0 };
    }
    for (const a of data) {
      const d = format(parseISO(a.start_time), 'yyyy-MM-dd');
      if (!map[d]) continue;
      map[d].total++;
      if (a.status === 'completed') {
        map[d].revenue += Number(a.total_price) || 0;
        map[d].clients++;
      } else if (a.status === 'cancelled' || a.status === 'no_show') {
        map[d].cancellations++;
      }
    }
    setDailyTrends(Object.entries(map).map(([date, v]) => ({
      date,
      revenue: v.revenue,
      clients: v.clients,
      cancellations: v.cancellations,
      occupancy: v.total > 0 ? Math.round((v.clients / v.total) * 100) : 0,
    })));
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

  const updateStatus = async (id: string, status: string, paymentMethod?: string) => {
    const apt = appointments.find((a) => a.id === id);
    await supabase.from('appointments').update({ status: status as any }).eq('id', id);

    // If completing, create automatic revenue with commission calculation
    if (status === 'completed' && apt && companyId) {
      const serviceNames = apt.appointment_services?.map((s: any) => s.service?.name).filter(Boolean).join(', ') || 'Serviço';
      const totalPrice = Number(apt.total_price);

      // Fetch collaborator commission settings
      let commissionAmount = 0;
      let professionalEarning = 0;
      let companyProfit = totalPrice;

      const { data: collab } = await supabase
        .from('collaborators')
        .select('collaborator_type, commission_type, commission_value')
        .eq('profile_id', apt.professional_id)
        .eq('company_id', companyId)
        .maybeSingle();

      if (collab) {
        const serviceCount = apt.appointment_services?.length || 1;
        const { calculateFinancials } = await import('@/lib/financial-engine');
        const breakdown = calculateFinancials(
          totalPrice,
          serviceCount,
          collab.collaborator_type,
          collab.commission_type,
          Number(collab.commission_value)
        );
        professionalEarning = breakdown.professionalValue;
        commissionAmount = breakdown.professionalValue;
        companyProfit = breakdown.companyValue;
      }

      await supabase.from('company_revenues').insert({
        company_id: companyId,
        appointment_id: apt.id,
        professional_id: apt.professional_id,
        description: `${apt.client_name || 'Cliente'} — ${serviceNames}`,
        amount: totalPrice,
        revenue_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
        due_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
        status: 'received',
        is_automatic: true,
        payment_method: paymentMethod || null,
        created_by: user?.id,
        notes: commissionAmount > 0 ? `Comissão: R$ ${commissionAmount.toFixed(2)} | Lucro: R$ ${companyProfit.toFixed(2)}` : null,
      });
    }

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
    fetchUpcomingAppointments();
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
      const [rh, rm] = rescheduleSelectedSlot.split(':').map(Number);
      const startDt = new Date(rescheduleDate);
      startDt.setHours(rh, rm, 0, 0);
      const endDt = addMinutes(startDt, totalDuration);
      const newStart = startDt.toISOString();
      const newEnd = endDt.toISOString();

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

  // Get IDs of upcoming appointments shown in the dedicated section (to exclude from agenda)
  const getUpcomingIds = (): Set<string> => {
    const now = new Date();
    const currentApt = appointments.find(
      a => a.status === 'confirmed' && now >= parseISO(a.start_time) && now <= parseISO(a.end_time)
    );
    const ids = new Set<string>();
    if (currentApt) ids.add(currentApt.id);
    const remaining = 3 - ids.size;
    upcomingAppointments.slice(0, remaining).forEach(a => {
      if (!ids.has(a.id)) ids.add(a.id);
    });
    return ids;
  };

  // Get delayed appointments: started but not completed/cancelled
  const getDelayedAppointments = () => {
    const now = new Date();
    return appointments.filter(apt => {
      const endTime = parseISO(apt.end_time);
      return now > endTime && !['completed', 'cancelled', 'no_show', 'rescheduled'].includes(apt.status);
    });
  };

  const renderActionButtons = (apt: any) => {
    const displayStatus = getDisplayStatus(apt);
    return (
      <div className="flex gap-1 flex-wrap mt-2">
        {(displayStatus === 'in_progress' || displayStatus === 'late') && (
          <Button size="sm" className="bg-success hover:bg-success/90 text-white text-xs" onClick={() => { setCompleteTarget(apt); setCompleteDialogOpen(true); }}>
            ✓ Concluir
          </Button>
        )}
        {apt.status === 'pending' && displayStatus !== 'late' && (
          <Button size="sm" className="text-xs" onClick={() => updateStatus(apt.id, 'confirmed')}>Confirmar</Button>
        )}
        {(apt.status === 'pending' || apt.status === 'confirmed') && displayStatus !== 'in_progress' && displayStatus !== 'late' && (
          <Button size="sm" variant="outline" className="text-xs" onClick={() => { setCompleteTarget(apt); setCompleteDialogOpen(true); }}>Concluir</Button>
        )}
        {(apt.status === 'pending' || apt.status === 'confirmed') && (
          <>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDelayTargetId(apt.id); setDelayDialogOpen(true); }}>
              <Timer className="h-3 w-3 mr-1" />Atraso
            </Button>
            {!apt.promotion_id && (
              <Button size="sm" variant="outline" className="text-xs" onClick={() => openRescheduleDialog(apt)}>
                <RefreshCw className="h-3 w-3 mr-1" />Reagendar
              </Button>
            )}
            <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => { setCancelTarget(apt); setCancelDialogOpen(true); }}>Cancelar</Button>
          </>
        )}
        {apt.delay_minutes > 0 && (
          <Badge variant="outline" className="text-xs border-warning text-warning">
            <Timer className="h-3 w-3 mr-1" />+{apt.delay_minutes}min
          </Badge>
        )}
      </div>
    );
  };

  const renderUpcomingAppointments = () => {
    const now = new Date();
    const currentApt = appointments.find(
      a => a.status === 'confirmed' && now >= parseISO(a.start_time) && now <= parseISO(a.end_time)
    );

    const items: { apt: any; label: string; icon: string; style: string }[] = [];
    if (currentApt) items.push({ apt: currentApt, label: 'Em atendimento', icon: '🔵', style: 'bg-primary/5 border-l-4 border-l-primary' });

    const remaining = 3 - items.length;
    upcomingAppointments.slice(0, remaining).forEach((a, i) => {
      if (currentApt && a.id === currentApt.id) return;
      items.push({
        apt: a,
        label: i === 0 && !currentApt ? 'Próximo' : 'Depois',
        icon: i === 0 && !currentApt ? '⏭' : '🕒',
        style: i === 0 && !currentApt ? 'bg-primary/5 border-l-4 border-l-primary' : 'bg-muted/50 border-l-4 border-l-muted-foreground',
      });
    });

    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Clock className="h-5 w-5" /> Próximos atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CalendarIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm text-center">Não há atendimentos agendados para os próximos dias.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map(({ apt, label, icon, style }) => (
                <div key={apt.id} className={cn('p-4 rounded-xl border transition-shadow', style)}>
                  <div className="flex items-center gap-4">
                    <div className="text-center min-w-[60px]">
                      <p className="text-lg font-display font-bold">{format(parseISO(apt.start_time), 'HH:mm')}</p>
                      <p className="text-[10px] text-muted-foreground">{format(parseISO(apt.start_time), 'dd/MM')}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{apt.client_name || apt.client?.name || 'Cliente'}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {apt.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                      </p>
                      {apt.promotion_id && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded bg-accent/10 text-accent-foreground mt-0.5">🔥 Promoção</span>
                      )}
                      <p className="text-xs text-muted-foreground">com {apt.professional?.full_name}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="font-display font-bold">R$ {Number(apt.total_price).toFixed(2)}</span>
                      <Badge variant="outline" className="text-xs whitespace-nowrap">
                        {icon} {label}
                      </Badge>
                    </div>
                  </div>
                  {renderActionButtons(apt)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderFinalizarAtendimentos = () => {
    const delayed = getDelayedAppointments();
    if (delayed.length === 0) return null;

    return (
      <Card className="border-orange-500/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2 text-orange-600">
            <AlertCircle className="h-5 w-5" /> Finalizar atendimentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {delayed.map(apt => (
              <div key={apt.id} className="p-4 rounded-xl border border-orange-500/30 bg-orange-50/50">
                <div className="flex items-center gap-1 mb-2">
                  <Badge variant="outline" className="text-xs border-orange-500 text-orange-600 bg-orange-50">
                    ⚠ Atendimento não finalizado
                  </Badge>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-lg font-display font-bold text-orange-600">{format(parseISO(apt.start_time), 'HH:mm')}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(apt.end_time), 'HH:mm')}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{apt.client_name || apt.client?.name || 'Cliente'}</p>
                    <p className="text-sm text-muted-foreground truncate">
                      {apt.appointment_services?.map((s: any) => s.service?.name).join(', ')}
                    </p>
                    <p className="text-xs text-muted-foreground">com {apt.professional?.full_name}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className="font-display font-bold">R$ {Number(apt.total_price).toFixed(2)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap mt-3">
                  <Button size="sm" className="bg-success hover:bg-success/90 text-white text-xs" onClick={() => { setCompleteTarget(apt); setCompleteDialogOpen(true); }}>
                    ✓ Concluir serviço
                  </Button>
                  {!apt.promotion_id && (
                    <Button size="sm" variant="outline" className="text-xs" onClick={() => openRescheduleDialog(apt)}>
                      <RefreshCw className="h-3 w-3 mr-1" />Reagendar
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive text-xs" onClick={() => { setCancelTarget(apt); setCancelDialogOpen(true); }}>
                    Cliente cancelou
                  </Button>
                </div>
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

      {/* Temporary test push notification button */}
      <Card className="border-dashed border-warning/50 bg-warning/5">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">🔔 Teste de Push Notification</p>
            <p className="text-xs text-muted-foreground">Clique para enviar uma notificação de teste para este dispositivo</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={async () => {
              try {
                toast.info('Enviando notificação de teste...');
                
                // First ensure we have a subscription
                const registration = await navigator.serviceWorker?.ready;
                const subscription = await registration?.pushManager?.getSubscription();
                
                if (!subscription) {
                  toast.error('Nenhuma inscrição push encontrada. Aceite as notificações primeiro.');
                  return;
                }

                console.log('Push subscription found:', subscription.endpoint);

                const { data, error } = await supabase.functions.invoke('send-push', {
                  body: {
                    user_id: user?.id,
                    title: 'Notificação de Teste',
                    body: 'Push notifications estão funcionando corretamente! 🎉',
                    url: '/dashboard',
                  },
                });

                console.log('Push response:', JSON.stringify(data, null, 2), 'Error:', error);

                if (error) {
                  toast.error('Erro ao enviar: ' + error.message);
                } else if (data?.results) {
                  data.results.forEach((r: any) => {
                    console.log(`[Push Result] id=${r.id} status=${r.status} endpoint=${r.endpoint} error=${r.error || 'none'}`);
                  });
                  toast.success(`Push: sent=${data.sent}, failed=${data.failed}. Veja console para detalhes.`);
                } else {
                  toast.success(`Push enviado! Sent: ${data?.sent}, Failed: ${data?.failed}`);
                }
              } catch (err: any) {
                console.error('Test push error:', err);
                toast.error('Erro: ' + err.message);
              }
            }}
          >
            <Send className="h-4 w-4" />
            Enviar Teste
          </Button>
        </CardContent>
      </Card>

      {/* Manual appointment button */}
      <div className="flex justify-end">
        <Button className="gap-2" onClick={() => setManualAppointmentOpen(true)}>
          <CalendarIcon className="h-4 w-4" /> Agendar manualmente
        </Button>
      </div>

      <ManualAppointmentDialog
        open={manualAppointmentOpen}
        onOpenChange={setManualAppointmentOpen}
        companyId={companyId!}
        userId={user?.id}
        isAdmin={isAdmin}
        profileId={profileId}
        onCreated={() => {
          fetchAppointments();
          fetchUpcomingAppointments();
          fetchMonthlyStats();
        }}
      />

      {/* 1. Próximos atendimentos */}
      {renderUpcomingAppointments()}

      {/* 2. Finalizar atendimentos */}
      {renderFinalizarAtendimentos()}

      {/* 3. Resumo do Dia */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">📊 Resumo do Dia</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Receita estimada</p>
              <p className="text-2xl font-semibold whitespace-nowrap">R$ {stats.revenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Receita realizada</p>
              <p className="text-2xl font-semibold whitespace-nowrap">R$ {stats.revenueCompleted.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Clientes hoje</p>
              <p className="text-2xl font-semibold">{stats.clients}</p>
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
              <CardContent className="p-4 flex items-center gap-2">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", hasOpenSlot ? "bg-warning/20" : "bg-warning/10")}>
                  <Bell className="h-5 w-5 text-warning" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground">Aguardando vaga</p>
                  <p className="text-2xl font-semibold">{waitlistCount}</p>
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
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-secondary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Lembretes enviados</p>
              <p className="text-2xl font-semibold">{reminderCount}</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* 4. Resumo do Mês */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">📈 Resumo do Mês</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">Receita estimada</p>
              </div>
              <p className="text-2xl font-semibold whitespace-nowrap">R$ {monthlyStats.revenue.toFixed(2)}</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="revenue" stroke="hsl(var(--success))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <TrendingUp className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">Receita realizada</p>
              </div>
              <p className="text-2xl font-semibold whitespace-nowrap">R$ {monthlyStats.revenueCompleted.toFixed(2)}</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">Clientes atendidos</p>
              </div>
              <p className="text-2xl font-semibold">{monthlyStats.clients}</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="clients" stroke="hsl(var(--accent))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-4 w-4 text-destructive" />
                </div>
                <p className="text-sm text-muted-foreground">Cancelamentos</p>
              </div>
              <p className="text-2xl font-semibold">{monthlyStats.cancellations}</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="cancellations" stroke="hsl(var(--destructive))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <BarChart3 className="h-4 w-4 text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Taxa de ocupação</p>
              </div>
              <p className="text-2xl font-semibold">{monthlyStats.occupancyRate}%</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="occupancy" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <Receipt className="h-4 w-4 text-warning" />
                </div>
                <p className="text-sm text-muted-foreground">Ticket médio</p>
              </div>
              <p className="text-2xl font-semibold whitespace-nowrap">R$ {monthlyStats.avgTicket.toFixed(2)}</p>
              {dailyTrends.length > 0 && (
                <div className="h-6 w-full opacity-70">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyTrends}><Line type="monotone" dataKey="revenue" stroke="hsl(var(--warning))" strokeWidth={1.5} dot={false} /></LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>


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

      {/* 5. Agenda do dia */}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="text-lg font-display font-semibold sm:min-w-[200px] text-center">
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
            // Exclude appointments shown in "Próximos" and "Em atraso" sections
            const upcomingIds = getUpcomingIds();
            const delayedIds = new Set(getDelayedAppointments().map(a => a.id));
            const excludedIds = new Set([...upcomingIds, ...delayedIds]);
            const agendaAppointments = appointments.filter(a => !excludedIds.has(a.id));

            const counts = {
              all: agendaAppointments.filter(a => a.status !== 'rescheduled').length,
              confirmed: agendaAppointments.filter(statusFilterMap.confirmed).length,
              completed: agendaAppointments.filter(statusFilterMap.completed).length,
              cancelled: agendaAppointments.filter(statusFilterMap.cancelled).length,
              rescheduled: agendaAppointments.filter(statusFilterMap.rescheduled).length,
            };
            const filteredAppts = agendaAppointments.filter(statusFilterMap[statusTab]);

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
                              {apt.rescheduled_from_id && apt.rescheduled_from?.start_time && (
                                <p className="text-xs text-muted-foreground italic mt-0.5">
                                  ↪ Reagendado de {format(parseISO(apt.rescheduled_from.start_time), 'HH:mm')}
                                </p>
                              )}
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

      {/* Complete Confirmation Dialog with Payment Method */}
      <Dialog open={completeDialogOpen} onOpenChange={(open) => { setCompleteDialogOpen(open); if (!open) { setCompleteTarget(null); setCompletePaymentMethod('pix'); setCompleteCustomAmount(''); setCompleteDiscount(''); setCompleteObservation(''); } }}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento recebido?</DialogTitle>
            <DialogDescription>
              {completeTarget && (
                <span className="block mt-1">
                  <strong>{completeTarget.client_name || 'Cliente'}</strong> — {format(parseISO(completeTarget.start_time), 'HH:mm')}
                  <br />
                  <span className="text-xs">R$ {Number(completeTarget.total_price).toFixed(2)}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Forma de pagamento</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                {[
                  { value: 'dinheiro', label: '💵 Dinheiro' },
                  { value: 'pix', label: '📱 Pix' },
                  { value: 'cartao_credito', label: '💳 Crédito' },
                  { value: 'cartao_debito', label: '💳 Débito' },
                  { value: 'transferencia', label: '🏦 Transf.' },
                  { value: 'outro', label: '📋 Outro' },
                ].map(pm => (
                  <Button
                    key={pm.value}
                    variant={completePaymentMethod === pm.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCompletePaymentMethod(pm.value)}
                    className="text-xs"
                  >
                    {pm.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Valor pago</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder={completeTarget ? Number(completeTarget.total_price).toFixed(2) : '0.00'}
                  value={completeCustomAmount}
                  onChange={(e) => setCompleteCustomAmount(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Desconto</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={completeDiscount}
                  onChange={(e) => setCompleteDiscount(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Observação</label>
              <textarea
                placeholder="Observação opcional..."
                value={completeObservation}
                onChange={(e) => setCompleteObservation(e.target.value)}
                rows={2}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1 resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button variant="outline" className="flex-1" onClick={() => { setCompleteDialogOpen(false); setCompleteTarget(null); }}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-success hover:bg-success/90 text-white"
                onClick={() => {
                  if (completeTarget) {
                    const discount = parseFloat(completeDiscount) || 0;
                    const customAmount = parseFloat(completeCustomAmount) || Number(completeTarget.total_price);
                    const finalAmount = customAmount - discount;
                    updateStatus(completeTarget.id, 'completed', completePaymentMethod);
                    if (completeObservation || discount > 0) {
                      // Update the appointment notes with discount/observation info
                      supabase.from('appointments').update({ 
                        notes: [
                          completeTarget.notes,
                          discount > 0 ? `Desconto: R$ ${discount.toFixed(2)}` : null,
                          completeObservation ? `Obs: ${completeObservation}` : null,
                        ].filter(Boolean).join(' | ')
                      }).eq('id', completeTarget.id).then(() => {});
                    }
                    toast.success('Serviço concluído com sucesso');
                  }
                  setCompleteDialogOpen(false);
                  setCompleteTarget(null);
                  setCompletePaymentMethod('pix');
                  setCompleteCustomAmount('');
                  setCompleteDiscount('');
                  setCompleteObservation('');
                }}
              >
                Confirmar pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
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
