import { useMemo, useRef, useEffect, useCallback, useState } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { groupOverlappingItems, calculateGroupPositions, getProfessionalColor, getStatusVisuals } from '@/utils/calendarLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Clock, Scissors, MoreVertical } from 'lucide-react';

interface TimelineAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name?: string | null;
  client?: { name?: string; whatsapp?: string } | null;
  professional_id: string;
  professional?: { full_name?: string } | null;
  total_price: number;
  appointment_services?: Array<{ service?: { name?: string } | null; duration_minutes?: number }>;
  delay_minutes?: number | null;
  promotion_id?: string | null;
}

interface TimelineBlockedTime {
  id: string;
  start_time: string;
  end_time: string;
  block_date: string;
  professional_id: string;
  professional?: { full_name?: string } | null;
  reason?: string | null;
}

interface Professional {
  profile_id: string;
  profile: { full_name?: string } | null;
}

interface AgendaTimelineViewProps {
  appointments: TimelineAppointment[];
  blockedTimes: TimelineBlockedTime[];
  professionals: Professional[];
  columnMode: 'day' | 'professionals';
  onAppointmentClick: (apt: TimelineAppointment) => void;
  onEmptySlotClick?: (time: string, professionalId?: string) => void;
  getDisplayStatus: (apt: any) => string;
  isAdmin?: boolean;
}

const HOUR_HEIGHT = 70; // Slightly increased for better reading
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 30;

const timelineStatusLabels: Record<string, string> = {
  pending: 'Pendente',
  confirmed: 'Confirmado',
  in_progress: 'Em atendimento',
  cancelled: 'Cancelado',
  completed: 'Concluído',
  no_show: 'Não compareceu',
  rescheduled: 'Reagendado',
  late: 'Atrasado',
};

const snapToSlot = (rawMinutes: number): number => {
  return Math.round(rawMinutes / SNAP_MINUTES) * SNAP_MINUTES;
};

const positionToTime = (y: number): string => {
  const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
  const snapped = snapToSlot(totalMinutes);
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const AgendaTimelineView = ({
  appointments,
  blockedTimes,
  professionals,
  columnMode,
  onAppointmentClick,
  onEmptySlotClick,
  getDisplayStatus,
  isAdmin = false,
}: AgendaTimelineViewProps) => {

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const now = new Date();
    const currentHour = now.getHours();
    if (scrollRef.current && currentHour >= START_HOUR) {
      const offset = (currentHour - START_HOUR - 1) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, offset);
    }
  }, []);

  const columns = useMemo(() => {
    if (columnMode === 'day' || professionals.length <= 1) {
      // For all mode, we need to group by collision
      const groups = groupOverlappingItems(appointments);
      const positionedAppointments = groups.flatMap(group => 
        calculateGroupPositions(group, HOUR_HEIGHT, START_HOUR)
      );
      
      return [{ id: 'all', name: 'Agenda', appointments: positionedAppointments, blockedTimes }];
    }
    
    return professionals.map(p => {
      const profAppts = appointments.filter(a => a.professional_id === p.profile_id);
      const groups = groupOverlappingItems(profAppts);
      const positionedAppointments = groups.flatMap(group => 
        calculateGroupPositions(group, HOUR_HEIGHT, START_HOUR)
      );
      
      return {
        id: p.profile_id,
        name: (p.profile as any)?.full_name || 'Sem nome',
        appointments: positionedAppointments,
        blockedTimes: blockedTimes.filter(bt => bt.professional_id === p.profile_id),
      };
    });
  }, [columnMode, professionals, appointments, blockedTimes]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);


  const now = new Date();
  const currentTimePosition = now.getHours() >= START_HOUR && now.getHours() < END_HOUR
    ? ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT
    : null;

  const handleColumnClick = useCallback((e: React.MouseEvent<HTMLDivElement>, colId: string) => {
    if (!onEmptySlotClick) return;
    // Only fire if clicking on the column bg, not on an appointment or blocked time
    const target = e.target as HTMLElement;
    if (target.closest('[data-apt]') || target.closest('[data-blocked]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (e.currentTarget.parentElement?.parentElement?.scrollTop || 0);
    const time = positionToTime(y);
    const profId = colId === 'all' ? undefined : colId;
    onEmptySlotClick(time, profId);
  }, [onEmptySlotClick]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {columnMode === 'professionals' && columns.length > 1 && (
        <div className="flex border-b bg-muted/30">
          <div className="w-14 shrink-0 border-r" />
          {columns.map(col => (
            <div key={col.id} className="flex-1 min-w-[180px] px-3 py-2 text-center border-r last:border-r-0">
              <p className="text-sm font-semibold truncate">{col.name}</p>
              <p className="text-xs text-muted-foreground">{col.appointments.length} agendamento{col.appointments.length !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}

      <div ref={scrollRef} className="overflow-auto max-h-[600px] relative">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          <div className="w-14 shrink-0 border-r relative bg-muted/10">
            {timeSlots.map((slot, i) => (
              <div key={slot} className="absolute w-full text-right pr-2" style={{ top: i * HOUR_HEIGHT }}>
                <span className="text-[11px] text-muted-foreground leading-none relative -top-2">{slot}</span>
              </div>
            ))}
          </div>

          {columns.map((col, colIdx) => (
            <div
              key={col.id}
              className={cn(
                "flex-1 min-w-[180px] relative cursor-pointer hover:bg-primary/[0.02]",
                colIdx < columns.length - 1 && "border-r"
              )}
              onClick={(e) => handleColumnClick(e, col.id)}
            >
              {timeSlots.map((_, i) => (
                <div key={i} className="absolute w-full border-t border-border/40" style={{ top: i * HOUR_HEIGHT }} />
              ))}
              {timeSlots.map((_, i) => (
                <div key={`half-${i}`} className="absolute w-full border-t border-border/20 border-dashed" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
              ))}

              {col.blockedTimes.map(bt => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const startISO = `${bt.block_date || today}T${bt.start_time}:00`;
                const endISO = `${bt.block_date || today}T${bt.end_time}:00`;
                const top = getTimePosition(startISO);
                const height = getBlockHeight(startISO, endISO);
                return (
                  <div
                    key={bt.id}
                    data-blocked="true"
                    className="absolute left-1 right-1 rounded border border-destructive/30 bg-destructive/10 z-[1] flex items-center justify-center"
                    style={{ top, height }}
                  >
                    <span className="text-[10px] text-destructive font-medium truncate px-1">
                      🚫 {bt.reason || 'Bloqueado'}
                    </span>
                  </div>
                );
              })}

              {col.appointments.map(apt => {
                const displayStatus = getDisplayStatus(apt);
                const top = getTimePosition(apt.start_time);
                const height = getBlockHeight(apt.start_time, apt.end_time);
                const colorClass = timelineStatusColors[displayStatus] || 'bg-muted border-border';
                const clientName = apt.client_name || apt.client?.name || 'Cliente';
                const serviceName = apt.appointment_services?.[0]?.service?.name || '';

                return (
                  <div
                    key={apt.id}
                    id={`agenda-apt-${apt.id}`}
                    data-apt="true"
                    className={cn(
                      "absolute left-1 right-1 rounded-md border cursor-pointer z-[2] overflow-hidden transition-all hover:shadow-md hover:z-[5] group",
                      colorClass
                    )}
                    style={{ top, height: Math.max(height, 24) }}
                    onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                  >
                    <div className="px-1.5 py-0.5 h-full flex flex-col justify-center">
                      <p className="text-[11px] font-semibold truncate leading-tight">{clientName}</p>
                      {height >= 36 && (
                        <p className="text-[10px] opacity-90 truncate leading-tight">{serviceName}</p>
                      )}
                      {height >= 48 && (
                        <p className="text-[10px] opacity-80 leading-tight">
                          {format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}
                        </p>
                      )}
                      {height >= 60 && (
                        <p className="text-[10px] opacity-70 truncate leading-tight">
                          R$ {Number(apt.total_price).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="absolute hidden group-hover:block left-full top-0 ml-1 z-50 bg-popover border rounded-lg shadow-lg p-3 min-w-[200px] text-popover-foreground">
                      <p className="font-semibold text-sm">{clientName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{serviceName}</p>
                      <p className="text-xs mt-1">{format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}</p>
                      {columnMode === 'day' && apt.professional?.full_name && (
                        <p className="text-xs text-muted-foreground mt-1">com {apt.professional.full_name}</p>
                      )}
                      <Badge variant="outline" className="mt-2 text-[10px]">
                        {timelineStatusLabels[displayStatus] || displayStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })}

              {currentTimePosition !== null && (
                <div
                  className="absolute left-0 right-0 z-[10] flex items-center pointer-events-none"
                  style={{ top: currentTimePosition }}
                >
                  <div className="w-2 h-2 rounded-full bg-destructive shrink-0" />
                  <div className="flex-1 h-[2px] bg-destructive" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
