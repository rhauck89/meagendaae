import { useEffect, useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

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
import { Calendar as CalendarIcon, CalendarCheck, ChevronLeft, ChevronRight, Clock, DollarSign, Users, UserCheck, UserMinus, UserPlus, AlertTriangle, Bell, MailCheck, Cake, Ban, Trash2, Timer, RefreshCw, AlertCircle, TrendingUp, BarChart3, XCircle, Percent, Receipt, Send, List, LayoutGrid, ArrowLeftRight, MoreHorizontal, MessageSquare, Info, Scissors, User, CheckCircle2, Rocket, Crown } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { BlockTimeDialog } from '@/components/BlockTimeDialog';
import { Calendar as DatePickerCalendar } from '@/components/ui/calendar';
import { format, addDays, addMinutes, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isSameDay, parseISO, differenceInDays, eachDayOfInterval } from 'date-fns';
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
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ENABLE_PUSH_NOTIFICATIONS } from '@/lib/constants';

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
  const { isSubscribed, subscribe, permission, isSupported, loading: pushLoading } = usePushNotifications();
  const { isAdmin, profileId } = useUserRole();
  const isMobile = useIsMobile();
  const { maskValue } = useFinancialPrivacy();
  const formatCurrency = (v: number) => maskValue(v);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, revenue: 0, revenueCompleted: 0, clients: 0 });
  const [monthlyStats, setMonthlyStats] = useState({ revenue: 0, revenueCompleted: 0, clients: 0, completedAppointments: 0, cancellations: 0, occupancyRate: 0, avgTicket: 0, topClient: { name: '', count: 0 } });
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
  const [upcomingAppointments, setUpcomingAppointments] = useState<any[]>([]);
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
  const [onboardingKey, setOnboardingKey] = useState(0);
  const [timelineColumnMode, setTimelineColumnMode] = useState<'day' | 'professionals'>('day');

  const { data: serverStats } = useQuery({
    queryKey: ['dashboard-server-stats', companyId, filterProfessional, isAdmin, profileId],
    queryFn: async () => {
      if (!companyId) return null;
      const professionalId = (!isAdmin && profileId) ? profileId : (filterProfessional === 'all' ? null : filterProfessional);
      const { data, error } = await supabase.rpc('get_company_dashboard_stats', {
        p_company_id: companyId,
        p_professional_id: professionalId
      });
      if (error) throw error;
      return data[0];
    },
    enabled: !!companyId,
  });

  useEffect(() => {
    if (serverStats) {
      setMonthlyStats(prev => ({
        ...prev,
        clients: Number(serverStats.total_clients),
        topClient: {
          name: serverStats.top_client_name || '',
          count: Number(serverStats.top_client_count)
        }
      }));
    }
  }, [serverStats]);

  const reopenOnboarding = async () => {
    if (!user?.id) return;
    await supabase.from('profiles').update({ onboarding_hidden: false, onboarding_completed: false, onboarding_step: 0 }).eq('user_id', user.id);
    localStorage.removeItem(`onboarding_checklist_completed_hidden_${user.id}`);
    localStorage.removeItem(`onboarding_checklist_completed_completed_${user.id}`);
    setOnboardingKey(prev => prev + 1);
    toast.success('Primeiros passos reativados!');
  };

  useEffect(() => {
    if (!rescheduleDialogOpen) {
      const timer = setTimeout(() => {
        document.querySelectorAll('[data-radix-popper-content-wrapper]').forEach(el => el.remove());
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [rescheduleDialogOpen]);

  useEffect(() => {
    if (!companyId) return;
    fetchCollaborators();
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
  }, [companyId, currentDate, viewMode, filterProfessional, isAdmin, profileId]);

  const handleAgendaRefresh = useCallback(() => {
    if (companyId) {
      fetchAppointments();
      fetchMonthlyStats();
      fetchUpcomingAppointments();
    }
  }, [companyId, currentDate, viewMode, filterProfessional, isAdmin, profileId]);
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
      .limit(10);

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
  const toSpStart = (date: Date) => `${format(date, 'yyyy-MM-dd')}T00:00:00${SP_OFFSET}`;
  const toSpEnd = (date: Date) => `${format(date, 'yyyy-MM-dd')}T23:59:59${SP_OFFSET}`;

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
      const dailyClients = new Set(selectedAppts.filter((a) => validStatuses.includes(a.status)).map(a => a.client_id).filter(Boolean)).size;

      setStats({
        total: selectedAppts.length,
        revenue: selectedAppts.filter((a) => validStatuses.includes(a.status)).reduce((sum, a) => sum + Number(a.total_price), 0),
        revenueCompleted: selectedAppts.filter((a) => a.status === 'completed').reduce((sum, a) => sum + Number(a.total_price), 0),
        clients: dailyClients,
      });
    }
  };

  const fetchMonthlyStats = async () => {
    if (!companyId) return;
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());

    const [apptsRes, bizHoursRes, collaboratorsRes, companyRes] = await Promise.all([
      supabase
        .from('appointments')
        .select('status, total_price, client_id, start_time, client:clients!appointments_client_id_fkey(name)')
        .eq('company_id', companyId!)
        .gte('start_time', toSpStart(monthStart))
        .lte('start_time', toSpEnd(monthEnd)),
      supabase.from('business_hours').select('*').eq('company_id', companyId!),
      supabase.from('collaborators').select('profile_id, active').eq('company_id', companyId!).eq('active', true),
      supabase.from('companies').select('fixed_slot_interval').eq('id', companyId!).single()
    ]);

    const data = apptsRes.data;
    if (!data) return;

    const confirmed = data.filter(a => a.status === 'confirmed' || a.status === 'completed');
    const completed = data.filter(a => a.status === 'completed');
    const cancelled = data.filter(a => a.status === 'cancelled');
    const uniqueClients = new Set(data.filter(a => a.client_id && ['confirmed', 'completed', 'pending'].includes(a.status)).map(a => a.client_id)).size;
    const clientApptCount: Record<string, number> = {};
    confirmed.forEach(a => { if (a.client_id) clientApptCount[a.client_id] = (clientApptCount[a.client_id] || 0) + 1; });
    const topEntry = Object.entries(clientApptCount).sort((a, b) => b[1] - a[1])[0];
    const topClient = topEntry ? { name: data.find(a => a.client_id === topEntry[0])?.client?.name || 'Cliente', count: topEntry[1] } : { name: '', count: 0 };

    const safeNum = (v: any) => isNaN(Number(v)) ? 0 : Number(v);
    const revenue = safeNum(confirmed.reduce((sum, a) => sum + Number(a.total_price), 0));
    const revenueCompleted = safeNum(completed.reduce((sum, a) => sum + Number(a.total_price), 0));
    
    const slotDuration = companyRes.data?.fixed_slot_interval || 30;
    const bizHours = bizHoursRes.data || [];
    const collaborators = collaboratorsRes.data || [];
    const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    let totalCapacity = 0;
    daysInMonth.forEach(day => {
      const dayOfWeek = day.getDay();
      const hours = bizHours.find(h => h.day_of_week === dayOfWeek);
      if (!hours || hours.is_closed) return;
      const [oH, oM] = (hours.open_time || "08:00").split(':').map(Number);
      const [cH, cM] = (hours.close_time || "18:00").split(':').map(Number);
      let workingMinutes = (cH * 60 + cM) - (oH * 60 + oM);
      if (hours.lunch_start && hours.lunch_end) {
        const [lsH, lsM] = hours.lunch_start.split(':').map(Number);
        const [leH, leM] = hours.lunch_end.split(':').map(Number);
        workingMinutes -= (leH * 60 + leM) - (lsH * 60 + lsM);
      }
      const activeCollaboratorsCount = (!isAdmin && profileId) ? 1 : (filterProfessional !== 'all' ? 1 : (collaborators.length || 1));
      totalCapacity += Math.max(0, Math.floor(workingMinutes / slotDuration)) * activeCollaboratorsCount;
    });

    const occupancyRate = totalCapacity > 0 ? Math.round((confirmed.length / totalCapacity) * 100) : 0;
    
    setMonthlyStats({
      revenue, revenueCompleted, clients: safeNum(uniqueClients), completedAppointments: safeNum(confirmed.length),
      cancellations: safeNum(cancelled.length), occupancyRate: safeNum(occupancyRate),
      avgTicket: confirmed.length > 0 ? safeNum(revenue / confirmed.length) : 0, topClient
    });
  };

  const fetchDailyTrends = async () => {
    if (!companyId) return;
    const daysCount = 14;
    const startDate = addDays(new Date(), -daysCount + 1);
    const startDateStr = format(startDate, 'yyyy-MM-dd');

    const [apptsRes, bizHoursRes, collaboratorsRes, companyRes] = await Promise.all([
      supabase.from('appointments').select('start_time, status, total_price').eq('company_id', companyId).gte('start_time', `${startDateStr}T00:00:00`).order('start_time', { ascending: true }),
      supabase.from('business_hours').select('*').eq('company_id', companyId!),
      supabase.from('collaborators').select('profile_id, active').eq('company_id', companyId!).eq('active', true),
      supabase.from('companies').select('fixed_slot_interval').eq('id', companyId!).single()
    ]);

    const data = apptsRes.data;
    if (!data) return;

    const bizHours = bizHoursRes.data || [];
    const collaborators = collaboratorsRes.data || [];
    const slotDuration = companyRes.data?.fixed_slot_interval || 30;

    const map: Record<string, { revenue: number; clients: number; cancellations: number; confirmed: number; capacity: number }> = {};
    for (let i = 0; i < daysCount; i++) {
      const day = addDays(startDate, i);
      const d = format(day, 'yyyy-MM-dd');
      const dayOfWeek = day.getDay();
      const hours = bizHours.find(h => h.day_of_week === dayOfWeek);
      let dayCapacity = 0;
      if (hours && !hours.is_closed) {
        const [oH, oM] = hours.open_time.split(':').map(Number);
        const [cH, cM] = hours.close_time.split(':').map(Number);
        let workingMinutes = (cH * 60 + cM) - (oH * 60 + oM);
        if (hours.lunch_start && hours.lunch_end) {
          const [lsH, lsM] = hours.lunch_start.split(':').map(Number);
          const [leH, leM] = hours.lunch_end.split(':').map(Number);
          workingMinutes -= (leH * 60 + leM) - (lsH * 60 + lsM);
        }
        const activeCount = (!isAdmin && profileId) ? 1 : (filterProfessional !== 'all' ? 1 : collaborators.length);
        dayCapacity = Math.max(0, Math.floor(workingMinutes / slotDuration)) * activeCount;
      }
      map[d] = { revenue: 0, clients: 0, cancellations: 0, confirmed: 0, capacity: dayCapacity };
    }

    for (const a of data) {
      const d = format(parseISO(a.start_time), 'yyyy-MM-dd');
      if (!map[d]) continue;
      if (['confirmed', 'completed', 'in_progress'].includes(a.status)) {
        map[d].confirmed++;
        map[d].revenue += Number(a.total_price) || 0;
        map[d].clients++;
      } else if (a.status === 'cancelled' || a.status === 'no_show') {
        map[d].cancellations++;
      }
    }

    setDailyTrends(Object.entries(map).map(([date, v]) => ({
      date, revenue: v.revenue, clients: v.clients, cancellations: v.cancellations, occupancy: v.capacity > 0 ? Math.round((v.confirmed / v.capacity) * 100) : 0,
    })));
  };

  const fetchWaitlistCount = async () => {
    if (!companyId) return;
    const { count: wlCount } = await supabase.from('waiting_list').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('status', 'waiting');
    const { count: wCount } = await supabase.from('waitlist').select('*', { count: 'exact', head: true }).eq('company_id', companyId).eq('notified', false);
    setWaitlistCount((wlCount || 0) + (wCount || 0));
  };

  const fetchReminderCount = async () => {
    if (!companyId) return;
    const { count } = await supabase.from('webhook_events').select('*', { count: 'exact', head: true }).eq('company_id', companyId).in('event_type', ['appointment_reminder', 'appointment_reminder_24h', 'appointment_reminder_3h'] as any);
    setReminderCount(count || 0);
  };

  const fetchBirthdays = async () => {
    if (!companyId) return;
    const { data: clients } = await supabase.from('profiles').select('id, full_name, birth_date, whatsapp').eq('company_id', companyId).not('birth_date', 'is', null);
    if (!clients) return;
    const today = new Date();
    const upcoming: any[] = [];
    for (const c of clients) {
      if (!c.birth_date) continue;
      const bday = new Date(c.birth_date);
      const bdayThisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (bdayThisYear < today) bdayThisYear.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((bdayThisYear.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysUntil <= 7) upcoming.push({ ...c, daysUntil, bdayDisplay: format(bday, 'dd/MM') });
    }
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    setBirthdayClients(upcoming);
  };

  const updateStatus = async (id: string, status: string, paymentMethod?: string, manualDiscount = 0, customAmount?: number, promoDiscount = 0, cashbackUsed = 0) => {
    const apt = appointments.find((a) => a.id === id);
    const totalDiscount = manualDiscount + promoDiscount + cashbackUsed;
    if (status === 'cancelled' || status === 'no_show') {
      await supabase.from('appointments').update({ status: status as any }).eq('id', id);
    } else {
      await supabase.from('appointments').update({ 
        status: status as any, manual_discount: manualDiscount, promotion_discount: promoDiscount,
        cashback_used: cashbackUsed, final_price: (customAmount ?? Number(apt?.total_price || 0)) - totalDiscount,
        original_price: customAmount ?? Number(apt?.total_price || 0)
      }).eq('id', id);
    }
    if (status === 'completed' && apt && companyId) {
      const serviceNames = apt.appointment_services?.map((s: any) => s.service?.name).filter(Boolean).join(', ') || 'Serviço';
      const grossPrice = customAmount ?? Number(apt.total_price);
      const netPrice = Math.max(0, grossPrice - totalDiscount);
      const { data: catData } = await supabase.from('company_revenue_categories').select('id').eq('company_id', companyId).eq('name', 'Serviços').maybeSingle();
      await supabase.from('company_revenues').insert({
        company_id: companyId, appointment_id: apt.id, professional_id: apt.professional_id,
        description: `${apt.client_name || 'Cliente'} — ${serviceNames}`, client_name: apt.client_name || 'Cliente',
        professional_name: apt.professional?.full_name || collaboratorsList.find(c => c.profile_id === apt.professional_id)?.profile?.full_name || 'Profissional',
        service_name: serviceNames, amount: netPrice, revenue_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'),
        due_date: format(parseISO(apt.start_time), 'yyyy-MM-dd'), status: 'received', is_automatic: true,
        category_id: catData?.id || null, payment_method: paymentMethod || null, created_by: user?.id,
      });
    }
    fetchAppointments();
    fetchUpcomingAppointments();
    fetchMonthlyStats();
  };

  const handleCompleteClick = (apt: any) => {
    setCompleteTarget(apt);
    setCompleteDialogOpen(true);
  };

  const openRescheduleDialog = (apt: any) => {
    setRescheduleTarget(apt);
    setRescheduleDialogOpen(true);
  };

  const executeDelay = async (minutes: number, stopBeforeIso: string | null) => {
    if (!delayTargetId) return;
    setDelayLoading(true);
    try {
      const { data, error } = await supabase.rpc('register_delay', { p_appointment_id: delayTargetId, p_delay_minutes: minutes, p_stop_before: stopBeforeIso } as any);
      if (error) { toast.error(error.message || 'Erro ao registrar atraso'); return; }
      toast.success(`Atraso de ${minutes} min registrado.`);
      fetchAppointments();
    } catch (err) { toast.error('Erro ao registrar atraso'); } finally {
      setDelayLoading(false); setDelayDialogOpen(false); setDelayLunchDialogOpen(false);
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

  const executeReschedule = async (apt: any, date: Date, time: string, profId: string, keepPromoPrice = true) => {
    setRescheduleLoading(true);
    try {
      const totalDuration = apt.appointment_services?.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0) || 30;
      const [rh, rm] = time.split(':').map(Number);
      const startDt = new Date(date); startDt.setHours(rh, rm, 0, 0);
      const endDt = addMinutes(startDt, totalDuration);
      await supabase.rpc('reschedule_appointment', { p_appointment_id: apt.id, p_new_start: startDt.toISOString(), p_new_end: endDt.toISOString() });
      toast.success('Agendamento reagendado com sucesso');
      fetchAppointments();
    } catch { toast.error('Erro ao reagendar'); } finally {
      setRescheduleLoading(false); setRescheduleDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <TrialBanner />
      <OnboardingChecklist key={onboardingKey} />
      {isAdmin && <MarketplaceActivation />}
      <TutorialProgressWidget />

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
        onCreated={() => { fetchAppointments(); fetchUpcomingAppointments(); fetchMonthlyStats(); }}
      />

      <AdjustAppointmentDialog
        open={adjustDialogOpen}
        onOpenChange={setAdjustDialogOpen}
        appointment={adjustTarget}
        onAdjust={(type) => handleAdjustment(adjustTarget, type)}
        onApplySuggestion={handleApplyAISuggestion}
        onConverted={() => { fetchAppointments(); fetchUpcomingAppointments(); fetchMonthlyStats(); }}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-gradient-to-br from-card to-muted/30 border-primary/10 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 bg-primary/5">
            <CardTitle className="text-lg font-display flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Próximos atendimentos
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="space-y-3">
              {upcomingAppointments.length > 0 ? (
                upcomingAppointments.slice(0, 3).map((apt) => (
                  <UnifiedAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    variant="business"
                    referenceDate={currentDate}
                    isAdmin={isAdmin}
                    onComplete={handleCompleteClick}
                    onReschedule={openRescheduleDialog}
                    onAdjust={(apt) => { setAdjustTarget(apt); setAdjustDialogOpen(true); }}
                    onCancel={(apt) => { setCancelTarget(apt); setCancelDialogOpen(true); }}
                    onUpdateStatus={updateStatus}
                    onRegisterDelay={(apt) => { setDelayTargetId(apt.id); setDelayTargetApt(apt); setDelayDialogOpen(true); }}
                    onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, confirmando seu agendamento hoje às ${format(parseISO(apt.start_time), 'HH:mm')}`)}
                  />
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Nenhum agendamento próximo</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {appointments.filter(apt => {
          const ds = getDisplayStatus(apt);
          const isPast = new Date() > parseISO(apt.end_time);
          return (isPast && ds !== 'completed' && ds !== 'cancelled' && ds !== 'no_show');
        }).length > 0 && (
          <Card className="bg-gradient-to-br from-card to-orange-50/30 border-orange-500/20 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 bg-orange-500/5">
              <CardTitle className="text-lg font-display flex items-center justify-between text-orange-600">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" /> Finalizar atendimentos
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-3">
                {appointments.filter(apt => {
                  const ds = getDisplayStatus(apt);
                  const isPast = new Date() > parseISO(apt.end_time);
                  return (isPast && ds !== 'completed' && ds !== 'cancelled' && ds !== 'no_show');
                }).slice(0, 3).map((apt) => (
                  <UnifiedAppointmentCard
                    key={apt.id}
                    appointment={apt}
                    variant="business"
                    isAdmin={isAdmin}
                    onComplete={handleCompleteClick}
                    onReschedule={openRescheduleDialog}
                    onAdjust={(apt) => { setAdjustTarget(apt); setAdjustDialogOpen(true); }}
                    onCancel={(apt) => { setCancelTarget(apt); setCancelDialogOpen(true); }}
                    onUpdateStatus={updateStatus}
                    onRegisterDelay={(apt) => { setDelayTargetId(apt.id); setDelayTargetApt(apt); setDelayDialogOpen(true); }}
                    onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, confirmando seu agendamento hoje às ${format(parseISO(apt.start_time), 'HH:mm')}`)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-display font-bold flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" /> Resumo do Dia
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Receita Estimada</p>
                  <h3 className="text-2xl font-black text-primary mt-1">{formatCurrency(stats.revenue)}</h3>
                </div>
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Receita Realizada</p>
                  <h3 className="text-2xl font-black text-success mt-1">{formatCurrency(stats.revenueCompleted)}</h3>
                </div>
                <div className="h-10 w-10 bg-success/10 rounded-xl flex items-center justify-center">
                  <Receipt className="h-5 w-5 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Clientes Únicos</p>
                  <h3 className="text-2xl font-black text-foreground mt-1">{stats.clients}</h3>
                </div>
                <div className="h-10 w-10 bg-muted rounded-xl flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/50 backdrop-blur-sm border-primary/10">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Aguardando Vaga</p>
                  <h3 className="text-2xl font-black text-orange-600 mt-1">{waitlistCount}</h3>
                </div>
                <div className="h-10 w-10 bg-orange-100 rounded-xl flex items-center justify-center text-orange-600">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-display font-bold flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" /> Resumo do Mês
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white/50 border-primary/10">
            <CardContent className="pt-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Faturamento Mensal</p>
              <h3 className="text-xl font-black text-primary">{formatCurrency(monthlyStats.revenue)}</h3>
              <p className="text-[9px] text-muted-foreground mt-1">Estimado para o mês atual</p>
            </CardContent>
          </Card>
          <Card className="bg-white/50 border-primary/10">
            <CardContent className="pt-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Ticket Médio</p>
              <h3 className="text-xl font-black text-foreground">{formatCurrency(monthlyStats.avgTicket)}</h3>
              <p className="text-[9px] text-muted-foreground mt-1">Por atendimento confirmado</p>
            </CardContent>
          </Card>
          <Card className="bg-white/50 border-primary/10">
            <CardContent className="pt-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Taxa de Ocupação</p>
              <h3 className="text-xl font-black text-foreground">{monthlyStats.occupancyRate}%</h3>
              <p className="text-[9px] text-muted-foreground mt-1">Baseado em {monthlyStats.completedAppointments} agendamentos</p>
            </CardContent>
          </Card>
          <Card className="bg-white/50 border-primary/10">
            <CardContent className="pt-6">
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Cancelamentos</p>
              <h3 className="text-xl font-black text-destructive">{monthlyStats.cancellations}</h3>
              <p className="text-[9px] text-muted-foreground mt-1">No período mensal</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-display flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" /> Calendário de Agendamentos
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-muted p-1 rounded-lg">
                <Button 
                  variant={agendaDisplayMode === 'lista' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-[10px] font-bold"
                  onClick={() => {
                    setAgendaDisplayMode('lista');
                    localStorage.setItem('agenda_display_mode', 'lista');
                  }}
                >
                  <List className="h-3 w-3 mr-1" /> LISTA
                </Button>
                <Button 
                  variant={agendaDisplayMode === 'calendario' ? 'secondary' : 'ghost'} 
                  size="sm" 
                  className="h-7 text-[10px] font-bold"
                  onClick={() => {
                    setAgendaDisplayMode('calendario');
                    localStorage.setItem('agenda_display_mode', 'calendario');
                  }}
                >
                  <LayoutGrid className="h-3 w-3 mr-1" /> AGENDA
                </Button>
              </div>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as StatusTab)} className="mb-4">
            <TabsList className="w-full flex flex-wrap h-auto gap-1">
              <TabsTrigger value="all">Todos</TabsTrigger>
              <TabsTrigger value="confirmed">Confirmados</TabsTrigger>
              <TabsTrigger value="completed">Concluídos</TabsTrigger>
              <TabsTrigger value="cancelled">Cancelados</TabsTrigger>
              <TabsTrigger value="rescheduled">Reagendados</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="space-y-4">
            {appointments.filter(statusFilterMap[statusTab]).map((apt) => (
              <UnifiedAppointmentCard
                key={apt.id}
                appointment={apt}
                variant="business"
                isAdmin={isAdmin}
                onComplete={handleCompleteClick}
                onReschedule={openRescheduleDialog}
                onAdjust={(apt) => { setAdjustTarget(apt); setAdjustDialogOpen(true); }}
                onCancel={(apt) => { setCancelTarget(apt); setCancelDialogOpen(true); }}
                onUpdateStatus={updateStatus}
                onRegisterDelay={(apt) => { setDelayTargetId(apt.id); setDelayTargetApt(apt); setDelayDialogOpen(true); }}
                onWhatsApp={(apt) => openWhatsApp(apt.client?.whatsapp || '', `Olá ${apt.client?.name}, confirmando seu agendamento hoje às ${format(parseISO(apt.start_time), 'HH:mm')}`)}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={completeDialogOpen} onOpenChange={setCompleteDialogOpen}>
        <DialogContent className="w-[92vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Atendimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Button className="w-full bg-success hover:bg-success/90" onClick={() => {
              if (completeTarget) updateStatus(completeTarget.id, 'completed', 'pix');
              setCompleteDialogOpen(false);
            }}>Confirmar Conclusão</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
