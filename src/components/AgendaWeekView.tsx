import { useMemo, useRef, useEffect, useCallback } from 'react';
import { format, parseISO, differenceInMinutes, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface WeekAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name?: string | null;
  client?: { name?: string } | null;
  professional_id: string;
  professional?: { full_name?: string } | null;
  total_price: number;
  appointment_services?: Array<{ service?: { name?: string } | null; duration_minutes?: number }>;
  delay_minutes?: number | null;
  promotion_id?: string | null;
}

interface AgendaWeekViewProps {
  appointments: WeekAppointment[];
  currentDate: Date;
  onAppointmentClick: (apt: WeekAppointment) => void;
  onDayClick: (date: Date) => void;
  onEmptySlotClick?: (date: Date, time: string) => void;
  getDisplayStatus: (apt: any) => string;
}

const HOUR_HEIGHT = 56;
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 30;

const statusColors: Record<string, string> = {
  pending: 'bg-warning/80 border-warning text-warning-foreground',
  confirmed: 'bg-primary/80 border-primary text-primary-foreground',
  in_progress: 'bg-blue-500/80 border-blue-500 text-white',
  cancelled: 'bg-destructive/60 border-destructive text-white opacity-60',
  completed: 'bg-success/70 border-success text-white opacity-80',
  no_show: 'bg-muted border-border text-muted-foreground opacity-60',
  rescheduled: 'bg-orange-400/70 border-orange-500 text-white opacity-70',
  late: 'bg-warning/80 border-warning text-warning-foreground',
};

const getTimePosition = (timeStr: string): number => {
  const date = parseISO(timeStr);
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (hours - START_HOUR) * HOUR_HEIGHT);
};

const getBlockHeight = (startStr: string, endStr: string): number => {
  const mins = differenceInMinutes(parseISO(endStr), parseISO(startStr));
  return Math.max(18, (mins / 60) * HOUR_HEIGHT);
};

const positionToTime = (y: number): string => {
  const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
  const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  const h = Math.floor(snapped / 60);
  const m = snapped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

export const AgendaWeekView = ({
  appointments,
  currentDate,
  onAppointmentClick,
  onDayClick,
  onEmptySlotClick,
  getDisplayStatus,
}: AgendaWeekViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const weekStart = startOfWeek(currentDate, { locale: ptBR });
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  useEffect(() => {
    const now = new Date();
    if (scrollRef.current && now.getHours() >= START_HOUR) {
      scrollRef.current.scrollTop = Math.max(0, (now.getHours() - START_HOUR - 1) * HOUR_HEIGHT);
    }
  }, []);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, WeekAppointment[]>();
    days.forEach(d => map.set(format(d, 'yyyy-MM-dd'), []));
    appointments.forEach(apt => {
      const key = format(parseISO(apt.start_time), 'yyyy-MM-dd');
      map.get(key)?.push(apt);
    });
    return map;
  }, [appointments, days]);

  const now = new Date();
  const currentTimePosition = now.getHours() >= START_HOUR && now.getHours() < END_HOUR
    ? ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT
    : null;

  const handleColumnClick = useCallback((e: React.MouseEvent<HTMLDivElement>, day: Date) => {
    if (!onEmptySlotClick) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-apt]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (e.currentTarget.parentElement?.parentElement?.scrollTop || 0);
    const time = positionToTime(y);
    onEmptySlotClick(day, time);
  }, [onEmptySlotClick]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Day headers */}
      <div className="flex border-b bg-muted/30">
        <div className="w-12 shrink-0 border-r" />
        {days.map(day => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 min-w-[100px] px-1 py-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/50 transition-colors",
                isToday && "bg-primary/10"
              )}
              onClick={() => onDayClick(day)}
            >
              <p className="text-[10px] uppercase text-muted-foreground">{format(day, 'EEE', { locale: ptBR })}</p>
              <p className={cn(
                "text-sm font-semibold",
                isToday && "text-primary"
              )}>{format(day, 'dd')}</p>
            </div>
          );
        })}
      </div>

      {/* Timeline body */}
      <div ref={scrollRef} className="overflow-auto max-h-[550px] relative">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div className="w-12 shrink-0 border-r relative bg-muted/10">
            {timeSlots.map((slot, i) => (
              <div key={slot} className="absolute w-full text-right pr-1" style={{ top: i * HOUR_HEIGHT }}>
                <span className="text-[10px] text-muted-foreground leading-none relative -top-2">{slot}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayAppts = appointmentsByDay.get(dayKey) || [];
            const isToday = isSameDay(day, now);

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex-1 min-w-[100px] relative cursor-pointer hover:bg-primary/[0.02]",
                  colIdx < 6 && "border-r",
                  isToday && "bg-primary/5"
                )}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {timeSlots.map((_, i) => (
                  <div key={i} className="absolute w-full border-t border-border/40" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {timeSlots.map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full border-t border-border/20 border-dashed" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                {dayAppts.map(apt => {
                  const displayStatus = getDisplayStatus(apt);
                  const top = getTimePosition(apt.start_time);
                  const height = getBlockHeight(apt.start_time, apt.end_time);
                  const colorClass = statusColors[displayStatus] || 'bg-muted border-border';
                  const clientName = apt.client_name || apt.client?.name || 'Cliente';

                  return (
                    <div
                      key={apt.id}
                      data-apt="true"
                      className={cn(
                        "absolute left-0.5 right-0.5 rounded border cursor-pointer z-[2] overflow-hidden transition-all hover:shadow-md hover:z-[5]",
                        colorClass
                      )}
                      style={{ top, height: Math.max(height, 20) }}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                      title={`${clientName} - ${format(parseISO(apt.start_time), 'HH:mm')} a ${format(parseISO(apt.end_time), 'HH:mm')}`}
                    >
                      <div className="px-1 py-0.5 h-full flex flex-col justify-center">
                        <p className="text-[10px] font-semibold truncate leading-tight">{clientName}</p>
                        {height >= 30 && (
                          <p className="text-[9px] opacity-80 truncate leading-tight">
                            {format(parseISO(apt.start_time), 'HH:mm')}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {isToday && currentTimePosition !== null && (
                  <div className="absolute left-0 right-0 z-[10] flex items-center pointer-events-none" style={{ top: currentTimePosition }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                    <div className="flex-1 h-[2px] bg-destructive" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
