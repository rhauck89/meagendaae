import { useEffect, useState, useCallback } from 'react';
import { formatServicesWithDuration } from '@/lib/format-services';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useOnDataRefresh } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import TrialBanner from '@/components/TrialBanner';
import TutorialProgressWidget from '@/components/TutorialProgressWidget';
import OnboardingChecklist from '@/components/OnboardingChecklist';
import MarketplaceActivation from '@/components/MarketplaceActivation';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { isPromoActive } from '@/lib/promotion-period';
import { Calendar as CalendarIcon, CalendarCheck, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, AlertTriangle, Bell, MailCheck, Cake, Ban, Trash2, Timer, RefreshCw, AlertCircle, TrendingUp, BarChart3, XCircle, Percent, Receipt, Send, List, LayoutGrid, ArrowLeftRight, MoreHorizontal, MessageSquare, Info, Scissors, User, CheckCircle2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BlockTimeDialog } from '@/components/BlockTimeDialog';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { format, addDays, addMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { formatWhatsApp, openWhatsApp } from '@/lib/whatsapp';
import { useNavigate as useRouterNavigate } from 'react-router-dom';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ManualAppointmentDialog } from '@/components/ManualAppointmentDialog';
import { SwapAppointmentDialog } from '@/components/SwapAppointmentDialog';
import { AdjustAppointmentDialog } from '@/components/AdjustAppointmentDialog';
import { AgendaTimelineView } from '@/components/AgendaTimelineView';
import { AgendaWeekView } from '@/components/AgendaWeekView';
import { AgendaMonthView } from '@/components/AgendaMonthView';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { UnifiedAppointmentCard } from '@/components/appointments/UnifiedAppointmentCard';
import { useIsMobile } from '@/hooks/use-mobile';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import FinancialPrivacyToggle from '@/components/FinancialPrivacyToggle';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { motion, AnimatePresence } from 'framer-motion';
import { getProfessionalColor } from '@/utils/calendarLayout';
import { OccupancyDrawer } from '@/components/OccupancyDrawer';



type ViewMode = 'day' | 'week' | 'month';
type StatusTab = 'all' | 'confirmed' | 'completed' | 'cancelled' | 'rescheduled';

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
  const isMobile = useIsMobile();
  const { maskValue } = useFinancialPrivacy();
  const formatCurrency = (v: number) => maskValue(v);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, revenueCompleted: 0, clients: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ revenue: 0, revenueCompleted: 0, clients: 0, completedAppointments: 0, cancellations: 0, occupancyRate: 0, avgTicket: 0 });
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
  const [delayTargetApt, setDelayTargetApt] = useState<any>(null);
  // Lunch-aware delay confirmation
  const [delayLunchDialogOpen, setDelayLunchDialogOpen] = useState(false);
  const [delayPendingMinutes, setDelayPendingMinutes] = useState<number | null>(null);
  const [delayLunchStartIso, setDelayLunchStartIso] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<any>(null);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<any>(null);
  const [completePaymentMethod, setCompletePaymentMethod] = useState('pix');
  const [completeCustomAmount, setCompleteCustomAmount] = useState('');
  const [completePromoDiscount, setCompletePromoDiscount] = useState('');
  const [completeCashbackUsed, setCompleteCashbackUsed] = useState('');
  const [completeManualDiscount, setCompleteManualDiscount] = useState('');
  const [completeObservation, setCompleteObservation] = useState('');
  const [delayLoading, setDelayLoading] = useState(false);
  const [rescheduleTarget, setRescheduleTarget] = useState<any>(null);
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [adjustTarget, setAdjustTarget] = useState<any>(null);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [rescheduleMode, setRescheduleMode] = useState<'time' | 'professional' | 'both'>('time');
  const [rescheduleProfessionalId, setRescheduleProfessionalId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<Date | undefined>(undefined);
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [rescheduleSelectedSlot, setRescheduleSelectedSlot] = useState<string | null>(null);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [priceCheckOpen, setPriceCheckOpen] = useState(false);
  const [priceCheckData, setPriceCheckData] = useState<any>(null);
  const routerNavigate = useRouterNavigate();
  const [waitlistClients, setWaitlistClients] = useState<string[]>([]);
  const [companySlug, setCompanySlug] = useState('');
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
  const [companyBusinessType, setCompanyBusinessType] = useState('barbershop');
  const [statusTab, setStatusTab] = useState<StatusTab>('confirmed');
  const [manualAppointmentOpen, setManualAppointmentOpen] = useState(false);
  const [manualAppointmentPrefill, setManualAppointmentPrefill] = useState<{ date?: Date; time?: string; professionalId?: string }>({});
  const [highlightedAppointmentId, setHighlightedAppointmentId] = useState<string | null>(null);
  const [occupancyDrawerOpen, setOccupancyDrawerOpen] = useState(false);
  const [agendaDisplayMode, setAgendaDisplayMode] = useState<'lista' | 'calendario'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('agenda_display_mode') as 'lista' | 'calendario') || 'lista';
    }
    return 'lista';
  });

  const [timelineColumnMode, setTimelineColumnMode] = useState<'day' | 'professionals'>('day');
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
      const selectedAppts = data.filter((a) => isSameDay(parseISO(a.start_time), currentDate));
      const validStatuses = ['confirmed', 'completed', 'pending', 'in_progress'];
      setStats({
        total: selectedAppts.length,
        revenue: selectedAppts.filter((a) => validStatuses.includes(a.status)).reduce((sum, a) => sum + Number(a.total_price), 0),
        revenueCompleted: selectedAppts.filter((a) => a.status === 'completed').reduce((sum, a) => sum + Number(a.total_price), 0),
        clients: selectedAppts.filter((a) => validStatuses.includes(a.status)).length,
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
      completedAppointments: completed.length,
      cancellations: cancelled.length,
      occupancyRate,
      avgTicket,
    });
  };

  const fetchDailyTrends = async () => {
    if (!companyId) return;
    const days = 14;
    const startDate = format(addDays(new Date(), -days + 1), 'yyyy-MM-dd');
    let query = supabase
      .from('appointments')
      .select('start_time, status, total_price')
      .eq('company_id', companyId)
      .gte('start_time', `${startDate}T00:00:00`)
      .order('start_time', { ascending: true });

    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data } = await query;

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

  const updateStatus = async (
    id: string, 
    status: string, 
    paymentMethod?: string, 
    manualDiscount = 0, 
    customAmount?: number,
    promoDiscount = 0,
    cashbackUsed = 0
  ) => {
    const apt = appointments.find((a) => a.id === id);
    const totalDiscount = manualDiscount + promoDiscount + cashbackUsed;
    
    // If just cancelling, don't reset financial values to keep history/transparency
    if (status === 'cancelled' || status === 'no_show') {
      await supabase.from('appointments').update({ 
        status: status as any
      }).eq('id', id);
    } else {
      await supabase.from('appointments').update({ 
        status: status as any,
        manual_discount: manualDiscount,
        promotion_discount: promoDiscount,
        cashback_used: cashbackUsed,
        final_price: (customAmount ?? Number(apt?.total_price || 0)) - totalDiscount,
        original_price: customAmount ?? Number(apt?.total_price || 0)
      }).eq('id', id);
    }

    // If completing, create automatic revenue with commission calculation
    if (status === 'completed' && apt && companyId) {
      const serviceNames = apt.appointment_services?.map((s: any) => s.service?.name).filter(Boolean).join(', ') || 'Serviço';
      const grossPrice = customAmount ?? Number(apt.total_price);
      const netPrice = Math.max(0, grossPrice - totalDiscount);

      // Fetch collaborator commission settings
      let commissionAmount = 0;
      let professionalEarning = 0;
      let companyProfit = netPrice;

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
          netPrice,
          serviceCount,
          collab.collaborator_type,
          collab.commission_type,
          Number(collab.commission_value)
        );
        professionalEarning = breakdown.professionalValue;
        commissionAmount = breakdown.professionalValue;
        companyProfit = breakdown.companyValue;
      }

      const noteParts = [];
      if (totalDiscount > 0) noteParts.push(`Descontos: R$ ${totalDiscount.toFixed(2)}`);
      if (commissionAmount > 0) noteParts.push(`Comissão: R$ ${commissionAmount.toFixed(2)} | Lucro: R$ ${companyProfit.toFixed(2)}`);
      
      // Get category ID for "Serviços"
      const { data: catData } = await supabase
        .from('company_revenue_categories')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', 'Serviços')
        .maybeSingle();

      await supabase.from('company_revenues').insert({
        company_id: companyId,
        appointment_id: apt.id,
        professional_id: apt.professional_id,
        description: `${apt.client_name || 'Cliente'} — ${serviceNames}`,
        client_name: apt.client_name || 'Cliente',
        professional_name: apt.professional?.full_name || collaboratorsList.find(c => c.profile_id === apt.professional_id)?.profile?.full_name || 'Profissional',
        service_name: serviceNames,
        amount: netPrice,
        revenue_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
        due_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
        status: 'received',
        is_automatic: true,
        category_id: catData?.id || null,
        payment_method: paymentMethod || null,
        created_by: user?.id,
        notes: noteParts.length > 0 ? noteParts.join(' | ') : null,
      });

      // Generate cashback credits — AUTO-DETECT active cashback promotions
      if (apt.client_id) {
        try {
          const appointmentDate = format(parseISO(apt.start_time), 'yyyy-MM-dd');
          
          // Find all active cashback promotions for this company where date is in range
          const { data: cashbackPromos } = await supabase
            .from('promotions')
            .select('id, promotion_type, discount_type, discount_value, cashback_validity_days, cashback_cumulative, service_id, service_ids, professional_filter, professional_ids')
            .eq('company_id', companyId)
            .eq('promotion_type', 'cashback')
            .eq('status', 'active')
            .lte('start_date', appointmentDate)
            .gte('end_date', appointmentDate);

          if (cashbackPromos && cashbackPromos.length > 0) {
            const appointmentServiceIds = (apt.appointment_services || []).map((as: any) => as.service_id);
            
            for (const promo of cashbackPromos) {
              // Check professional eligibility
              if (promo.professional_filter === 'specific' && promo.professional_ids) {
                if (!promo.professional_ids.includes(apt.professional_id)) continue;
              }
              
              // Check service eligibility
              const promoServiceIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
              const hasEligibleService = promoServiceIds.length === 0 || appointmentServiceIds.some((sid: string) => promoServiceIds.includes(sid));
              if (!hasEligibleService) continue;

              // Calculate cashback amount
              let cashbackAmount = 0;
              if (promo.discount_type === 'percentage' && promo.discount_value) {
                cashbackAmount = netPrice * Number(promo.discount_value) / 100;
              } else if (promo.discount_type === 'fixed_amount' && promo.discount_value) {
                cashbackAmount = Number(promo.discount_value);
              }

              if (cashbackAmount <= 0) continue;

              // Check if cumulative is allowed
              if (!promo.cashback_cumulative) {
                const { data: existing } = await supabase
                  .from('client_cashback')
                  .select('id')
                  .eq('client_id', apt.client_id)
                  .eq('promotion_id', promo.id)
                  .eq('company_id', companyId)
                  .in('status', ['active'])
                  .limit(1);
                if (existing && existing.length > 0) continue;
              }

              const validityDays = promo.cashback_validity_days || 30;
              const expiresAt = new Date();
              expiresAt.setDate(expiresAt.getDate() + validityDays);

              await supabase.from('client_cashback').insert({
                client_id: apt.client_id,
                company_id: companyId,
                promotion_id: promo.id,
                appointment_id: apt.id,
                amount: cashbackAmount,
                status: 'active',
                expires_at: expiresAt.toISOString(),
              });

              // Transaction is now handled automatically by database trigger on client_cashback table
              toast.success(`Cashback de R$ ${cashbackAmount.toFixed(2)} gerado automaticamente!`);
            }
          }
        } catch (cashbackErr) {
          console.error('[Dashboard] Cashback auto-generation error:', cashbackErr);
        }
      }

      // === LOYALTY POINTS ===
      try {
        const { data: loyaltyConfig } = await supabase
          .from('loyalty_config' as any)
          .select('*')
          .eq('company_id', companyId)
          .eq('enabled', true)
          .maybeSingle();

        if (loyaltyConfig && apt.client_id) {
          const lc = loyaltyConfig as any;
          const profOk = lc.participating_professionals === 'all' || (lc.specific_professional_ids || []).includes(apt.professional_id);
          if (profOk) {
            const aptServices = apt.appointment_services || [];
            const eligibleServices = aptServices.filter((as: any) =>
              lc.participating_services === 'all' || (lc.specific_service_ids || []).includes(as.service_id)
            );
            if (eligibleServices.length > 0) {
              let pointsToAward = 0;
              if (lc.scoring_type === 'per_service') {
                pointsToAward = eligibleServices.length * (lc.points_per_service || 10);
              } else {
                const eligibleTotal = eligibleServices.reduce((sum: number, as: any) => sum + Number(as.price || 0), 0);
                pointsToAward = Math.floor(eligibleTotal * Number(lc.points_per_currency || 1));
              }
              if (pointsToAward > 0) {
                const { data: lastTx } = await supabase
                  .from('loyalty_points_transactions' as any)
                  .select('balance_after')
                  .eq('company_id', companyId)
                  .eq('client_id', apt.client_id)
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                const currentBalance = (lastTx as any)?.balance_after || 0;
                await supabase.from('loyalty_points_transactions' as any).insert({
                  company_id: companyId, client_id: apt.client_id, points: pointsToAward,
                  transaction_type: 'earn', reference_type: 'appointment', reference_id: apt.id,
                  description: `Serviço concluído — ${apt.client_name || 'Cliente'}`,
                  balance_after: currentBalance + pointsToAward,
                } as any);
                toast.success(`+${pointsToAward} pontos de fidelidade!`);
              }
            }
          }
        }
      } catch (loyaltyErr) {
        console.error('[Dashboard] Loyalty points error:', loyaltyErr);
      }
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

  /**
   * Entry point — called when the user picks a delay duration.
   * Decides whether to show the lunch-compensation modal or proceed directly.
   */
  const handleDelayChoice = async (minutes: number) => {
    if (!delayTargetId || !delayTargetApt) {
      // Fallback — proceed without lunch logic
      void executeDelay(minutes, null);
      return;
    }

    try {
      const aptStart = parseISO(delayTargetApt.start_time);
      const dow = aptStart.getDay(); // 0 (Sun) – 6 (Sat)
      const yyyyMmDd = format(aptStart, 'yyyy-MM-dd');

      // Fetch business hours row for that company / day-of-week
      const { data: bh } = await supabase
        .from('business_hours')
        .select('lunch_start, lunch_end, is_closed')
        .eq('company_id', delayTargetApt.company_id)
        .eq('day_of_week', dow)
        .maybeSingle();

      const lunchStart = bh?.lunch_start as string | null | undefined;

      if (lunchStart && !bh?.is_closed) {
        // Build full ISO of lunch start in local TZ
        const lunchStartIso = `${yyyyMmDd}T${lunchStart}`;
        const lunchStartDate = new Date(lunchStartIso);

        // Only ask if appointment STARTS before lunch begins
        if (aptStart < lunchStartDate) {
          setDelayPendingMinutes(minutes);
          setDelayLunchStartIso(lunchStartDate.toISOString());
          setDelayDialogOpen(false);
          setDelayLunchDialogOpen(true);
          return;
        }
      }
    } catch (err) {
      console.warn('[Dashboard] lunch check failed, proceeding default:', err);
    }

    // No lunch-related decision needed — propagate everything
    void executeDelay(minutes, null);
  };

  /**
   * Calls the register_delay RPC and dispatches the rescheduled webhook.
   * No WhatsApp tabs are opened — Make.com is the sole notification channel.
   */
  const executeDelay = async (minutes: number, stopBeforeIso: string | null) => {
    if (!delayTargetId) return;
    setDelayLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_delay', {
        p_appointment_id: delayTargetId,
        p_delay_minutes: minutes,
        p_stop_before: stopBeforeIso,
      } as any);

      if (error) {
        toast.error(error.message || 'Erro ao registrar atraso');
        return;
      }

      const result = (data as any) || {};
      const affected: any[] = result.affected || [];
      const sourceAppointmentId = delayTargetId;

      toast.success(
        `Atraso de ${minutes} min registrado. ${affected.length} agendamento(s) reajustado(s).`
      );

      const origin = typeof window !== 'undefined' ? window.location.origin : '';
      const { sendAppointmentRescheduledWebhook } = await import('@/lib/automations');

      // Fire reschedule webhooks (non-blocking) — NO WhatsApp tabs.
      for (const a of affected) {
        const rescheduleUrl = a.id ? `${origin}/reschedule/${a.id}` : null;

        sendAppointmentRescheduledWebhook({
          appointment_id: a.id,
          company_id: companyId || '',
          client_name: a.client_name ?? null,
          client_phone: a.client_whatsapp ?? null,
          professional_name: a.professional_name ?? null,
          appointment_date: a.new_start_iso
            ? format(parseISO(a.new_start_iso), 'yyyy-MM-dd')
            : null,
          appointment_time: a.new_time ?? null,
          datetime_iso: a.new_start_iso ?? null,
          origin: 'dashboard',
          old_time: a.old_time ?? null,
          new_time: a.new_time ?? null,
          delay_minutes: minutes,
          delay_source_appointment_id: sourceAppointmentId,
          reschedule_url: rescheduleUrl,
        } as any);
      }

      fetchAppointments();
    } catch (err) {
      console.error('[Dashboard] executeDelay error:', err);
      toast.error('Erro ao registrar atraso');
    } finally {
      setDelayLoading(false);
      setDelayDialogOpen(false);
      setDelayLunchDialogOpen(false);
      setDelayTargetId(null);
      setDelayTargetApt(null);
      setDelayPendingMinutes(null);
      setDelayLunchStartIso(null);
    }
  };

  const handleAdjustment = (apt: any, type: 'reschedule' | 'professional' | 'both' | 'normal') => {
    if (type === 'normal') return;
    setRescheduleMode(type === 'reschedule' ? 'time' : type === 'professional' ? 'professional' : 'both');
    setRescheduleProfessionalId(apt.professional_id);
    openRescheduleDialog(apt);
  };

  const handleApplyAISuggestion = (suggestion: any) => {
    setAdjustDialogOpen(false);
    executeReschedule(adjustTarget, suggestion.date, suggestion.slot, suggestion.professionalId);
  };

  const openRescheduleDialog = (apt: any) => {
    setRescheduleTarget(apt);
    if (rescheduleMode === 'professional') {
      const dt = parseISO(apt.start_time);
      setRescheduleDate(dt);
      setRescheduleSelectedSlot(format(dt, 'HH:mm'));
      fetchRescheduleSlots(dt, apt.professional_id);
    } else {
      setRescheduleDate(undefined);
      setRescheduleSlots([]);
      setRescheduleSelectedSlot(null);
    }
    setRescheduleDialogOpen(true);
  };

  const fetchRescheduleSlots = async (date: Date, professionalId?: string) => {
    if (!rescheduleTarget || !companyId) return;
    setRescheduleSlotsLoading(true);
    setRescheduleSelectedSlot(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const totalDuration = rescheduleTarget.appointment_services?.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      ) || 30;

      const profId = professionalId || rescheduleProfessionalId || rescheduleTarget.professional_id;

      const { getAvailableSlots } = await import('@/lib/availability-service');
      const { slots } = await getAvailableSlots({
        source: 'manual',
        companyId,
        professionalId: profId,
        date,
        totalDuration,
        filterPastForToday: true,
      });

      // Exclude the slot that belongs to the appointment being rescheduled itself,
      // because the unified service includes it as an existing appointment.
      const targetStart = new Date(rescheduleTarget.start_time);
      const targetHHmm = `${String(targetStart.getHours()).padStart(2, '0')}:${String(targetStart.getMinutes()).padStart(2, '0')}`;
      const filteredSlots = slots.filter((s) => s !== targetHHmm);

      console.log('[SLOTS SOURCE]', 'dashboard-reschedule', { count: filteredSlots.length });
      setRescheduleSlots(filteredSlots);
    } catch (err) {
      console.error('Failed to fetch reschedule slots:', err);
      toast.error('Erro ao buscar horários disponíveis');
    } finally {
      setRescheduleSlotsLoading(false);
    }
  };

  const confirmReschedule = async () => {
    if (!rescheduleTarget || !rescheduleSelectedSlot || !rescheduleDate) return;

    const profId = rescheduleProfessionalId || rescheduleTarget.professional_id;

    // Check if moving outside promo window
    if (rescheduleTarget.promotion_id) {
      const { data: promo } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', rescheduleTarget.promotion_id)
        .maybeSingle();

      if (promo) {
        const [rh, rm] = rescheduleSelectedSlot.split(':').map(Number);
        const startDt = new Date(rescheduleDate);
        startDt.setHours(rh, rm, 0, 0);

        if (!isPromoActive(promo, startDt)) {
          setPriceCheckData({
            promo,
            newStart: startDt,
            newProfessionalId: profId
          });
          setPriceCheckOpen(true);
          return;
        }
      }
    }

    executeReschedule(rescheduleTarget, rescheduleDate, rescheduleSelectedSlot, profId);
  };

  const executeReschedule = async (apt: any, date: Date, time: string, profId: string, keepPromoPrice = true) => {
    setRescheduleLoading(true);
    try {
      const totalDuration = apt.appointment_services?.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      ) || 30;
      const [rh, rm] = time.split(':').map(Number);
      const startDt = new Date(date);
      startDt.setHours(rh, rm, 0, 0);
      const endDt = addMinutes(startDt, totalDuration);
      const newStart = startDt.toISOString();
      const newEnd = endDt.toISOString();

      // Check if we need to update price
      let newPrice = apt.total_price;
      if (!keepPromoPrice && apt.promotion_id) {
        const { data: promo } = await supabase.from('promotions').select('original_price').eq('id', apt.promotion_id).maybeSingle();
        if (promo?.original_price) {
          newPrice = promo.original_price;
        }
      }

      const { error } = await supabase.rpc('reschedule_appointment', {
        p_appointment_id: apt.id,
        p_new_start: newStart,
        p_new_end: newEnd,
      });

      if (error) {
        toast.error(error.message || 'Erro ao reagendar');
        return;
      }

      // If price changed or professional changed, update the appointment record
      if (newPrice !== apt.total_price || profId !== apt.professional_id) {
        await supabase.from('appointments').update({
          total_price: newPrice,
          professional_id: profId,
          notes: (apt.notes || '') + (newPrice !== apt.total_price ? `\n[Preço atualizado para R$ ${newPrice}]` : '')
        } as any).eq('id', apt.id);
      }
      if (error) {
        toast.error(error.message || 'Erro ao reagendar');
        return;
      }
      toast.success('Agendamento reagendado com sucesso');
      const clientWhatsapp = rescheduleTarget.client_whatsapp;
      if (clientWhatsapp) {
        openWhatsApp(clientWhatsapp, { source: 'dashboard', message: `📋 Seu horário foi atualizado.\n\n📅 ${format(rescheduleDate, "dd 'de' MMMM, yyyy", { locale: ptBR })}\n⏰ ${rescheduleSelectedSlot}\n\nSe precisar alterar novamente, utilize o link enviado anteriormente.` });
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
            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setDelayTargetId(apt.id); setDelayTargetApt(apt); setDelayDialogOpen(true); }}>
              <Timer className="h-3 w-3 mr-1" />Atraso
            </Button>
            {!apt.promotion_id && (
              <Button size="sm" variant="outline" className="text-xs" onClick={() => openRescheduleDialog(apt)}>
                <RefreshCw className="h-3 w-3 mr-1" />Reagendar
              </Button>
            )}
            <Button size="sm" variant="outline" className="text-xs" onClick={() => { setAdjustTarget(apt); setAdjustDialogOpen(true); }}>
              <ArrowLeftRight className="h-3 w-3 mr-1" />Ajustar
            </Button>
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

    const items: any[] = [];
    if (currentApt) items.push(currentApt);

    const remaining = 3 - items.length;
    upcomingAppointments.slice(0, remaining).forEach((a) => {
      if (currentApt && a.id === currentApt.id) return;
      items.push(a);
    });

    return (
      <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-primary/5">
          <CardTitle className="text-lg font-display flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" /> Próximos atendimentos
            </div>
            {items.length > 0 && (
              <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider px-2">
                {items.length} agendamento{items.length > 1 ? 's' : ''}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <CalendarIcon className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm text-center">Não há atendimentos agendados para os próximos dias.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((apt) => (
                <UnifiedAppointmentCard
                  key={apt.id}
                  appointment={apt}
                  variant="compact"
                  isAdmin={isAdmin}
                  onComplete={(apt) => {
                    setCompleteTarget(apt);
                    setCompleteDialogOpen(true);
                  }}
                  onReschedule={openRescheduleDialog}
                  onAdjust={(apt) => {
                    setAdjustTarget(apt);
                    setAdjustDialogOpen(true);
                  }}
                  onCancel={(apt) => {
                    setCancelTarget(apt);
                    setCancelDialogOpen(true);
                  }}
                  onUpdateStatus={updateStatus}
                  onRegisterDelay={(apt) => {
                    setDelayTargetId(apt.id);
                    setDelayTargetApt(apt);
                    setDelayDialogOpen(true);
                  }}
                  onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, tudo bem?`)}
                  onClick={(apt) => {
                    setHighlightedAppointmentId(apt.id);
                    const el = document.getElementById(`agenda-apt-${apt.id}`);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    setTimeout(() => setHighlightedAppointmentId(null), 3000);
                  }}
                />
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
      <Card className="bg-gradient-to-br from-card to-orange-50/30 border-orange-500/20 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 bg-orange-500/5">
          <CardTitle className="text-lg font-display flex items-center justify-between text-orange-600">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" /> Finalizar atendimentos
            </div>
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-[10px] uppercase font-bold tracking-wider px-2">
              {delayed.length} pendente{delayed.length > 1 ? 's' : ''}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="space-y-3">
            {delayed.map(apt => (
              <UnifiedAppointmentCard
                key={apt.id}
                appointment={apt}
                variant="compact"
                isAdmin={isAdmin}
                onComplete={(apt) => {
                  setCompleteTarget(apt);
                  setCompleteDialogOpen(true);
                }}
                onReschedule={openRescheduleDialog}
                onAdjust={(apt) => {
                  setAdjustTarget(apt);
                  setAdjustDialogOpen(true);
                }}
                onCancel={(apt) => {
                  setCancelTarget(apt);
                  setCancelDialogOpen(true);
                }}
                onUpdateStatus={updateStatus}
                onRegisterDelay={(apt) => {
                  setDelayTargetId(apt.id);
                  setDelayTargetApt(apt);
                  setDelayDialogOpen(true);
                }}
                onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, tudo bem?`)}
              />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      <TrialBanner />
      <OnboardingChecklist />
      {isAdmin && <MarketplaceActivation />}
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
        onOpenChange={(open) => {
          setManualAppointmentOpen(open);
          if (!open) setManualAppointmentPrefill({});
        }}
        companyId={companyId!}
        userId={user?.id}
        isAdmin={isAdmin}
        profileId={profileId}
        initialDate={manualAppointmentPrefill.date}
        initialTime={manualAppointmentPrefill.time}
        initialProfessionalId={manualAppointmentPrefill.professionalId}
        onCreated={() => {
          fetchAppointments();
          fetchUpcomingAppointments();
          fetchMonthlyStats();
        }}
      />

      <AdjustAppointmentDialog
        open={adjustDialogOpen}
        onOpenChange={(open) => {
          setAdjustDialogOpen(open);
          if (!open) setAdjustTarget(null);
        }}
        appointment={adjustTarget}
        onAdjust={(type) => handleAdjustment(adjustTarget, type)}
        onApplySuggestion={handleApplyAISuggestion}
        onConverted={() => {
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
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-display font-semibold">📊 Resumo do Dia</h3>
            <p className="text-sm text-muted-foreground capitalize">
              {format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
          <FinancialPrivacyToggle />
        </div>
        <div className="metrics-grid">
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Receita estimada</p>
              <p className="metric-value">{formatCurrency(stats.revenue)}</p>
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
              <p className="metric-value">{formatCurrency(stats.revenueCompleted)}</p>
              {currentDate > new Date() && (
                <p className="text-xs text-muted-foreground">(Ainda não realizado)</p>
              )}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-accent" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Atendimentos</p>
              <p className="metric-value">{stats.clients}</p>
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
                  <p className="metric-value">{waitlistCount}</p>
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
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <MailCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Lembretes enviados</p>
              <p className="metric-value">{reminderCount}</p>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>

      {/* 4. Resumo do Mês */}
      <div>
        <h3 className="text-lg font-display font-semibold mb-3">📈 Resumo do Mês</h3>
        <div className="metrics-grid">
          <Card>
            <CardContent className="p-4 space-y-1">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-4 w-4 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">Receita estimada</p>
              </div>
              <p className="metric-value">{formatCurrency(monthlyStats.revenue)}</p>
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
              <p className="metric-value">{formatCurrency(monthlyStats.revenueCompleted)}</p>
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
                  <CalendarCheck className="h-4 w-4 text-accent" />
                </div>
                <p className="text-sm text-muted-foreground">Agendamentos feitos</p>
              </div>
              <p className="metric-value">{monthlyStats.completedAppointments}</p>
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
              <p className="metric-value">{monthlyStats.cancellations}</p>
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
              <p className="metric-value">{monthlyStats.occupancyRate}%</p>
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
              <p className="metric-value">{formatCurrency(monthlyStats.avgTicket)}</p>
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

      {/* 5. Calendário de Agendamentos */}

      <Card id="agenda-completa">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center gap-2 mb-3">
            <CalendarIcon className="h-5 w-5" /> Calendário de Agendamentos
          </CardTitle>
          <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
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
                <SelectTrigger className="w-full sm:w-[180px] max-w-full">
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
            {/* Display mode toggle: Lista / Calendário */}
            {!isMobile && (
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={agendaDisplayMode === 'lista' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setAgendaDisplayMode('lista'); localStorage.setItem('agenda_display_mode', 'lista'); }}
                >
                  <List className="h-3.5 w-3.5" /> Lista
                </Button>
                <Button
                  variant={agendaDisplayMode === 'calendario' ? 'default' : 'ghost'}
                  size="sm"
                  className="gap-1.5"
                  onClick={() => { setAgendaDisplayMode('calendario'); localStorage.setItem('agenda_display_mode', 'calendario'); }}
                >
                  <LayoutGrid className="h-3.5 w-3.5" /> Calendário
                </Button>
              </div>
            )}
            {/* Column mode toggle for calendar view */}
            {!isMobile && agendaDisplayMode === 'calendario' && viewMode === 'day' && isAdmin && collaboratorsList.length > 1 && (
              <div className="flex gap-1 bg-muted rounded-lg p-1">
                <Button
                  variant={timelineColumnMode === 'day' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimelineColumnMode('day')}
                >
                  Dia
                </Button>
                <Button
                  variant={timelineColumnMode === 'professionals' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setTimelineColumnMode('professionals')}
                >
                  Profissionais
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Professional Legend & Day Stats */}
          {agendaDisplayMode === 'calendario' && isAdmin && (
            <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 rounded-xl bg-muted/20 border border-border/10">
              <div className="flex flex-wrap items-center gap-4">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mr-2">Profissionais:</p>
                {collaboratorsList.map(c => {
                  const profColor = getProfessionalColor(c.profile_id, (c.profile as any)?.full_name);
                  const isActive = filterProfessional === 'all' || filterProfessional === c.profile_id;
                  return (
                    <button 
                      key={c.profile_id}
                      onClick={() => setFilterProfessional(isActive && filterProfessional !== 'all' ? 'all' : c.profile_id)}
                      className={cn(
                        "flex items-center gap-2 px-2.5 py-1 rounded-full border transition-all hover:scale-105 active:scale-95",
                        isActive ? cn(profColor.bg, profColor.border) : "bg-transparent border-transparent opacity-40 grayscale"
                      )}
                    >
                      <div className={cn("w-2 h-2 rounded-full", profColor.border.replace('border', 'bg'))} />
                      <span className={cn("text-xs font-bold", profColor.text)}>
                        {(c.profile as any)?.full_name?.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>

              {viewMode === 'day' && (
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Ocupação</p>
                    <p className="text-sm font-black text-primary">
                      {Math.round((appointments.filter(a => a.status === 'completed' || a.status === 'confirmed').length / (collaboratorsList.length * 8 || 1)) * 100)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Hoje</p>
                    <p className="text-sm font-black">
                      {appointments.filter(a => a.status !== 'cancelled' && a.status !== 'no_show').length} Atend.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

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

          {/* Calendar Views */}
          {agendaDisplayMode === 'calendario' && !isMobile ? (
            <>
              {viewMode === 'day' && (
                appointments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarIcon className="h-12 w-12 mx-auto mb-3 opacity-40" />
                    <p>Nenhum agendamento neste período</p>
                    <Button className="mt-4 gap-2" variant="outline" onClick={() => setManualAppointmentOpen(true)}>
                      <CalendarIcon className="h-4 w-4" /> Agendar manualmente
                    </Button>
                  </div>
                ) : (
                  <AgendaTimelineView
                    isAdmin={isAdmin}

                    appointments={appointments.filter(a => a.status !== 'rescheduled')}
                    blockedTimes={blockedTimes}
                    professionals={collaboratorsList}
                    columnMode={timelineColumnMode}
                    getDisplayStatus={getDisplayStatus}
                    onAppointmentClick={(apt) => {
                      const ds = getDisplayStatus(apt);
                      if (ds === 'in_progress' || ds === 'late' || apt.status === 'pending' || apt.status === 'confirmed') {
                        setCompleteTarget(apt);
                        setCompleteDialogOpen(true);
                      }
                    }}
                    onEmptySlotClick={(time, professionalId) => {
                      setManualAppointmentPrefill({ date: currentDate, time, professionalId });
                      setManualAppointmentOpen(true);
                    }}
                  />
                )
              )}
              {viewMode === 'week' && (
                <AgendaWeekView
                  appointments={appointments.filter(a => a.status !== 'rescheduled')}
                  currentDate={currentDate}
                  getDisplayStatus={getDisplayStatus}
                  onDayClick={(date) => {
                    setCurrentDate(date);
                    setViewMode('day');
                  }}
                  onAppointmentClick={(apt) => {
                    const ds = getDisplayStatus(apt);
                    if (ds === 'in_progress' || ds === 'late' || apt.status === 'pending' || apt.status === 'confirmed') {
                      setCompleteTarget(apt);
                      setCompleteDialogOpen(true);
                    }
                  }}
                  onEmptySlotClick={(date, time) => {
                    setManualAppointmentPrefill({ date, time });
                    setManualAppointmentOpen(true);
                  }}
                />
              )}
              {viewMode === 'month' && (
                <AgendaMonthView
                  appointments={appointments.filter(a => a.status !== 'rescheduled')}
                  currentDate={currentDate}
                  getDisplayStatus={getDisplayStatus}
                  onDayClick={(date) => {
                    setCurrentDate(date);
                    setViewMode('day');
                  }}
                />
              )}
            </>
          ) : (
            /* List View */
            (() => {
              const agendaAppointments = appointments;
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
                      <Button className="mt-4 gap-2" variant="outline" onClick={() => setManualAppointmentOpen(true)}>
                        <CalendarIcon className="h-4 w-4" /> Agendar manualmente
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <AnimatePresence initial={false}>
                        {filteredAppts.map((apt) => (
                          <UnifiedAppointmentCard
                            key={apt.id}
                            appointment={apt}
                            isAdmin={isAdmin}
                            onComplete={(apt) => {
                              setCompleteTarget(apt);
                              setCompleteDialogOpen(true);
                            }}
                            onReschedule={openRescheduleDialog}
                            onAdjust={(apt) => {
                              setAdjustTarget(apt);
                              setAdjustDialogOpen(true);
                            }}
                            onCancel={(apt) => {
                              setCancelTarget(apt);
                              setCancelDialogOpen(true);
                            }}
                            onUpdateStatus={updateStatus}
                            onRegisterDelay={(apt) => {
                              setDelayTargetId(apt.id);
                              setDelayTargetApt(apt);
                              setDelayDialogOpen(true);
                            }}
                            onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, confirmando seu agendamento hoje às ${format(parseISO(apt.start_time), 'HH:mm')}`)}
                            isHighlighted={highlightedAppointmentId === apt.id}
                            onClick={(apt) => {
                              // If they click the card, we could highlight it or show details
                              // For now, let's keep the highlighting logic
                              setHighlightedAppointmentId(apt.id);
                              setTimeout(() => setHighlightedAppointmentId(null), 3000);
                            }}
                          />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              );
            })()
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
          <DialogBody>
            <div className="grid grid-cols-2 gap-3">
              {[5, 10, 15, 20].map((min) => (
                <Button
                  key={min}
                  variant="outline"
                  className="h-16 text-lg font-display"
                  disabled={delayLoading}
                  onClick={() => handleDelayChoice(min)}
                >
                  {min} min
                </Button>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDelayDialogOpen(false); setDelayTargetApt(null); }} disabled={delayLoading}>
              Cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lunch-aware confirmation dialog */}
      <AlertDialog open={delayLunchDialogOpen} onOpenChange={setDelayLunchDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Timer className="h-5 w-5" /> Atraso antes do almoço
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este atraso ocorre antes do horário de almoço configurado.
              Os horários após o almoço também serão afetados?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              disabled={delayLoading}
              onClick={() => {
                if (delayPendingMinutes != null) {
                  void executeDelay(delayPendingMinutes, delayLunchStartIso);
                }
              }}
            >
              Não, compensar no almoço
            </Button>
            <Button
              disabled={delayLoading}
              onClick={() => {
                if (delayPendingMinutes != null) {
                  void executeDelay(delayPendingMinutes, null);
                }
              }}
            >
              Sim, propagar tudo
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
                    <p><strong>Serviço:</strong> {formatServicesWithDuration(cancelTarget.appointment_services) || 'N/A'}</p>
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
      <Dialog open={completeDialogOpen} onOpenChange={(open) => { 
        setCompleteDialogOpen(open); 
        if (!open) { 
          setCompleteTarget(null); 
          setCompletePaymentMethod('pix'); 
          setCompleteCustomAmount(''); 
          setCompletePromoDiscount(''); 
          setCompleteCashbackUsed(''); 
          setCompleteManualDiscount(''); 
          setCompleteObservation(''); 
        } 
      }}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Pagamento recebido?</DialogTitle>
            <DialogDescription>
              {completeTarget && (
                <span className="block mt-1">
                  <strong>{completeTarget.client_name || 'Cliente'}</strong> — {format(parseISO(completeTarget.start_time), 'HH:mm')}
                  <br />
                  <span className="text-xs">{formatCurrency(Number(completeTarget.total_price))}</span>
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
                <label className="text-sm font-medium">Valor original</label>
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
                <label className="text-sm font-medium">✍️ Desc. manual</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={completeManualDiscount}
                  onChange={(e) => setCompleteManualDiscount(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">🏷️ Promoção</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={completePromoDiscount}
                  onChange={(e) => setCompletePromoDiscount(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">💸 Cashback</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={completeCashbackUsed}
                  onChange={(e) => setCompleteCashbackUsed(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring mt-1"
                />
              </div>
            </div>

            {/* Net amount preview */}
            {completeTarget && (() => {
              const gross = parseFloat(completeCustomAmount) || Number(completeTarget.total_price);
              const discM = parseFloat(completeManualDiscount) || 0;
              const discP = parseFloat(completePromoDiscount) || 0;
              const discC = parseFloat(completeCashbackUsed) || 0;
              const net = Math.max(0, gross - discM - discP - discC);
              return (
                <div className="bg-muted/50 rounded-md p-3 text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Valor bruto</span><span>R$ {gross.toFixed(2)}</span></div>
                  {discP > 0 && <div className="flex justify-between text-orange-600"><span>- Promoção</span><span>R$ {discP.toFixed(2)}</span></div>}
                  {discC > 0 && <div className="flex justify-between text-blue-600"><span>- Cashback</span><span>R$ {discC.toFixed(2)}</span></div>}
                  {discM > 0 && <div className="flex justify-between text-purple-600"><span>- Desc. Manual</span><span>R$ {discM.toFixed(2)}</span></div>}
                  <div className="flex justify-between font-bold border-t pt-1"><span>Valor líquido (A pagar)</span><span>R$ {net.toFixed(2)}</span></div>
                </div>
              );
            })()}

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
                    const dManual = parseFloat(completeManualDiscount) || 0;
                    const dPromo = parseFloat(completePromoDiscount) || 0;
                    const dCashback = parseFloat(completeCashbackUsed) || 0;
                    const customAmount = parseFloat(completeCustomAmount) || Number(completeTarget.total_price);
                    
                    updateStatus(completeTarget.id, 'completed', completePaymentMethod, dManual, customAmount, dPromo, dCashback);
                    
                    if (completeObservation) {
                      supabase.from('appointments').update({ 
                        notes: [
                          completeTarget.notes,
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
                  setCompletePromoDiscount('');
                  setCompleteCashbackUsed('');
                  setCompleteManualDiscount('');
                  setCompleteObservation('');
                }}
              >
                Confirmar pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Price Confirmation Dialog */}
      <AlertDialog open={priceCheckOpen} onOpenChange={setPriceCheckOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Fora do horário promocional
            </AlertDialogTitle>
            <AlertDialogDescription>
              Este novo horário está fora da janela da promoção <strong>{priceCheckData?.promo?.title}</strong>.
              Como deseja proceder com o preço?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setPriceCheckOpen(false);
                executeReschedule(rescheduleTarget, rescheduleDate!, rescheduleSelectedSlot!, priceCheckData.newProfessionalId, true);
              }}
            >
              Manter preço promocional
            </Button>
            <AlertDialogAction
              onClick={() => {
                setPriceCheckOpen(false);
                executeReschedule(rescheduleTarget, rescheduleDate!, rescheduleSelectedSlot!, priceCheckData.newProfessionalId, false);
              }}
            >
              Cobrar preço normal (R$ {priceCheckData?.promo?.original_price})
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reschedule Dialog */}
      <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => { setRescheduleDialogOpen(open); if (!open) { setRescheduleTarget(null); setRescheduleDate(undefined); setRescheduleSlots([]); setRescheduleSelectedSlot(null); setRescheduleMode('time'); setRescheduleProfessionalId(null); } }}>
        {rescheduleDialogOpen && (
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5" /> Reagendar
            </DialogTitle>
            <DialogDescription>
              {rescheduleTarget && (
                <span className="block space-y-1 mt-1">
                  <span className="block"><strong>Cliente:</strong> {rescheduleTarget.client_name || 'Cliente'}</span>
                  <span className="block"><strong>Serviço:</strong> {formatServicesWithDuration(rescheduleTarget.appointment_services)}</span>
                  <span className="block"><strong>Horário atual:</strong> {format(parseISO(rescheduleTarget.start_time), 'dd/MM/yyyy HH:mm')} - {format(parseISO(rescheduleTarget.end_time), 'HH:mm')}</span>
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-6">
            {(rescheduleMode === 'professional' || rescheduleMode === 'both') && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Profissional</label>
                <div className="flex gap-2 flex-wrap">
                  {collaboratorsList.map(c => (
                    <Button
                      key={c.profile_id}
                      variant={rescheduleProfessionalId === c.profile_id || (!rescheduleProfessionalId && rescheduleTarget?.professional_id === c.profile_id) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setRescheduleProfessionalId(c.profile_id);
                        if (rescheduleDate) fetchRescheduleSlots(rescheduleDate, c.profile_id);
                      }}
                      className="text-xs"
                    >
                      {c.profile?.full_name}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-[320px_1fr] gap-6">
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
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRescheduleDialogOpen(false)} disabled={rescheduleLoading}>
              Cancelar
            </Button>
            <Button
              disabled={!rescheduleSelectedSlot || rescheduleLoading}
              onClick={confirmReschedule}
            >
              {rescheduleLoading ? 'Reagendando...' : (rescheduleSelectedSlot ? `Confirmar às ${rescheduleSelectedSlot}` : 'Confirmar')}
            </Button>
          </DialogFooter>
        </DialogContent>
        )}
      </Dialog>
    </div>
  );
};

export default Dashboard;
