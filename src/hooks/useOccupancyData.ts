

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  format, 
  eachDayOfInterval, 
  isSameDay, 
  parseISO, 
  differenceInMinutes,
  parse,
  startOfHour
} from 'date-fns';

export type OccupancyPeriod = 'day' | 'week' | 'month' | 'custom';

interface UseOccupancyDataParams {
  companyId: string;
  professionalId?: string; // 'all' or specific ID
  dateRange: { start: Date; end: Date };
  period: OccupancyPeriod;
}

const safeNumber = (val: any) => {
  const num = Number(val);
  return isNaN(num) ? 0 : num;
};

export const useOccupancyData = ({ companyId, professionalId, dateRange, period }: UseOccupancyDataParams) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const startDateStr = format(dateRange.start, 'yyyy-MM-dd');
        const endDateStr = format(dateRange.end, 'yyyy-MM-dd');
        const startISO = `${startDateStr}T00:00:00`;
        const endISO = `${endDateStr}T23:59:59`;

        // 1. Fetch Working Hours
        const { data: bizHours } = await supabase
          .from('business_hours')
          .select('*')
          .eq('company_id', companyId);

        // 2. Fetch Professional Working Hours (overrides)
        let profHoursQuery = supabase
          .from('professional_working_hours')
          .select('*')
          .eq('company_id', companyId);
        
        if (professionalId && professionalId !== 'all') {
          profHoursQuery = profHoursQuery.eq('professional_id', professionalId);
        }
        const { data: profWorkingHours } = await profHoursQuery;

        // 3. Fetch Exceptions
        const { data: exceptions } = await supabase
          .from('business_exceptions')
          .select('*')
          .eq('company_id', companyId)
          .gte('exception_date', startDateStr)
          .lte('exception_date', endDateStr);

        // 4. Fetch Blocked Times
        let blocksQuery = supabase
          .from('blocked_times' as any)
          .select('*')
          .eq('company_id', companyId)
          .gte('block_date', startDateStr)
          .lte('block_date', endDateStr);

        if (professionalId && professionalId !== 'all') {
          blocksQuery = blocksQuery.eq('professional_id', professionalId);
        }
        const { data: blocksData } = await blocksQuery;
        const blocks = (blocksData || []) as any[];

        // 5. Fetch Appointments
        let apptsQuery = supabase
          .from('appointments')
          .select('*, appointment_services(service:services(duration_minutes))')
          .eq('company_id', companyId)
          .gte('start_time', startISO)
          .lte('start_time', endISO);

        if (professionalId && professionalId !== 'all') {
          apptsQuery = apptsQuery.eq('professional_id', professionalId);
        }
        const { data: apptsData } = await apptsQuery;
        const appts = (apptsData || []) as any[];

        // 6. Fetch Company Settings for slot interval
        const { data: company } = await supabase
          .from('companies')
          .select('fixed_slot_interval, booking_mode')
          .eq('id', companyId)
          .single();

        // 7. Fetch Collaborators
        let collaboratorsQuery = supabase
          .from('collaborators')
          .select('profile_id, active')
          .eq('company_id', companyId)
          .eq('active', true);
        
        const { data: collaborators } = await collaboratorsQuery;

        // PROCESS DATA
        const days = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });
        const slotDuration = company?.fixed_slot_interval || 30;

        let totalAvailableSlots = 0;
        let totalOccupiedSlots = 0;
        let totalCancelled = 0;
        let totalNoShow = 0;
        let totalRescheduled = 0;
        
        const dailyStats: any[] = [];
        const hourlyDistribution: Record<string, number> = {};
        
        days.forEach(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const dayOfWeek = day.getDay();
          const dayException = (exceptions || [])?.find(e => e.exception_date === dateStr);
          
          let dayAvailableSlots = 0;
          let dayOccupiedSlots = 0;
          
          const activeProfs = professionalId && professionalId !== 'all' 
            ? [{ profile_id: professionalId }] 
            : (collaborators || []);

          activeProfs.forEach(prof => {
            const customHours = (profWorkingHours || [])?.find(h => h.professional_id === prof.profile_id && h.day_of_week === dayOfWeek);
            const standardHours = (bizHours || [])?.find(h => h.day_of_week === dayOfWeek);
            const hours = customHours || standardHours;

            if (!hours || hours.is_closed || (dayException && dayException.is_closed)) return;

            const openTimeStr = dayException?.open_time || hours.open_time;
            const closeTimeStr = dayException?.close_time || hours.close_time;
            
            if (!openTimeStr || !closeTimeStr) return;

            const openTime = parse(openTimeStr, 'HH:mm', day);
            const closeTime = parse(closeTimeStr, 'HH:mm', day);
            
            let workingMinutes = differenceInMinutes(closeTime, openTime);
            
            if (hours.lunch_start && hours.lunch_end) {
              const lStart = parse(hours.lunch_start, 'HH:mm', day);
              const lEnd = parse(hours.lunch_end, 'HH:mm', day);
              workingMinutes -= differenceInMinutes(lEnd, lStart);
            }

            const dayBlocks = blocks?.filter(b => b.block_date === dateStr && b.professional_id === prof.profile_id);
            dayBlocks?.forEach(b => {
              const bStart = parse(b.start_time, 'HH:mm', day);
              const bEnd = parse(b.end_time, 'HH:mm', day);
              workingMinutes -= Math.max(0, differenceInMinutes(bEnd, bStart));
            });

            const profDayCapacity = Math.max(0, Math.floor(workingMinutes / slotDuration));
            dayAvailableSlots += profDayCapacity;
          });

          const dayAppts = appts?.filter(a => isSameDay(parseISO(a.start_time), day)) || [];
          dayAppts.forEach(a => {
            if (['confirmed', 'completed', 'in_progress'].includes(a.status)) {
              dayOccupiedSlots++;
              const hour = format(startOfHour(parseISO(a.start_time)), 'HH:00');
              hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
            } else if (a.status === 'cancelled') {
              totalCancelled++;
            } else if (a.status === 'no_show') {
              totalNoShow++;
            } else if (a.status === 'rescheduled') {
              totalRescheduled++;
            }
          });

          totalAvailableSlots += dayAvailableSlots;
          totalOccupiedSlots += dayOccupiedSlots;

          dailyStats.push({
            date: dateStr,
            available: dayAvailableSlots,
            occupied: dayOccupiedSlots,
            cancelled: dayAppts.filter(a => a.status === 'cancelled').length,
            free: Math.max(0, dayAvailableSlots - dayOccupiedSlots),
            rate: dayAvailableSlots > 0 ? Math.round((dayOccupiedSlots / dayAvailableSlots) * 100) : 0
          });
        });

        const occupancyRate = totalAvailableSlots > 0 ? Math.round((totalOccupiedSlots / totalAvailableSlots) * 100) : 0;
        const sortedHours = Object.entries(hourlyDistribution).sort((a, b) => b[1] - a[1]);
        
        // Detailed peaks with counts
        const peakHours = sortedHours.slice(0, 3).map(([h, count]) => ({ hour: h, count: safeNumber(count) }));
        const offPeakHours = sortedHours.filter(([_, count]) => count > 0).slice(-3).reverse().map(([h, count]) => ({ hour: h, count: safeNumber(count) }));

        let bestDay = null;
        let worstDay = null;
        if (dailyStats.length > 0) {
          const sortedDays = [...dailyStats].sort((a, b) => b.rate - a.rate);
          bestDay = sortedDays[0];
          worstDay = sortedDays[sortedDays.length - 1];
        }

        setData({
          summary: {
            occupancyRate: safeNumber(occupancyRate),
            totalAvailableSlots: safeNumber(totalAvailableSlots),
            totalOccupiedSlots: safeNumber(totalOccupiedSlots),
            freeSlots: Math.max(0, safeNumber(totalAvailableSlots) - safeNumber(totalOccupiedSlots)),
            cancelled: safeNumber(totalCancelled),
            noShow: safeNumber(totalNoShow),
            rescheduled: safeNumber(totalRescheduled),
            avgTimeBetween: 0,
          },
          dailyStats: dailyStats.map(ds => ({
            ...ds,
            rate: safeNumber(ds.rate),
            occupied: safeNumber(ds.occupied),
            available: safeNumber(ds.available)
          })),
          peaks: {
            mostRequested: peakHours,
            leastRequested: offPeakHours,
            neverRequested: []
          },
          highlights: {
            bestDay,
            worstDay
          }
        });
      } catch (error) {
        console.error('Error calculating occupancy:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, professionalId, dateRange, period]);

  return { loading, data };
};

