import { useMemo, useRef, useEffect, useCallback } from 'react';
import { format, parseISO, startOfWeek, addDays, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  groupOverlappingItems, 
  calculateGroupPositions, 
  getProfessionalColor, 
  getStatusVisuals,
  getTimePosition,
  getBlockHeight
} from '@/utils/calendarLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';

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

const HOUR_HEIGHT = 65; // Slightly more compact than day view but still readable
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;
const SNAP_MINUTES = 30;

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

  const positionedAppointmentsByDay = useMemo(() => {
    const map = new Map<string, any[]>();
    days.forEach(day => {
      const dayKey = format(day, 'yyyy-MM-dd');
      const dayAppts = appointments.filter(apt => 
        format(parseISO(apt.start_time), 'yyyy-MM-dd') === dayKey
      );
      
      const groups = groupOverlappingItems(dayAppts);
      const positioned = groups.flatMap(group => 
        calculateGroupPositions(group, HOUR_HEIGHT, START_HOUR)
      );
      
      map.set(dayKey, positioned);
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
    const totalMinutes = (y / HOUR_HEIGHT) * 60 + START_HOUR * 60;
    const snapped = Math.round(totalMinutes / SNAP_MINUTES) * SNAP_MINUTES;
    const h = Math.floor(snapped / 60);
    const m = snapped % 60;
    const time = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    
    onEmptySlotClick(day, time);
  }, [onEmptySlotClick]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Day headers */}
      <div className="flex border-b bg-muted/20 backdrop-blur-sm sticky top-0 z-20">
        <div className="w-14 shrink-0 border-r bg-muted/10" />
        {days.map(day => {
          const isToday = isSameDay(day, now);
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex-1 min-w-[120px] px-1 py-3 text-center border-r last:border-r-0 cursor-pointer hover:bg-muted/40 transition-colors",
                isToday && "bg-primary/[0.03]"
              )}
              onClick={() => onDayClick(day)}
            >
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{format(day, 'EEE', { locale: ptBR })}</p>
              <p className={cn(
                "text-base font-display font-black leading-none mt-1",
                isToday ? "text-primary" : "text-foreground"
              )}>{format(day, 'dd')}</p>
            </div>
          );
        })}
      </div>

      {/* Timeline body */}
      <div ref={scrollRef} className="overflow-auto max-h-[600px] relative scrollbar-thin scrollbar-thumb-muted">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Hour labels */}
          <div className="w-14 shrink-0 border-r relative bg-muted/5 z-10">
            {timeSlots.map((slot, i) => (
              <div key={slot} className="absolute w-full text-right pr-2" style={{ top: i * HOUR_HEIGHT }}>
                <span className="text-[10px] font-bold text-muted-foreground/60 leading-none relative -top-2">{slot}</span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, colIdx) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const dayAppts = positionedAppointmentsByDay.get(dayKey) || [];
            const isToday = isSameDay(day, now);

            return (
              <div
                key={dayKey}
                className={cn(
                  "flex-1 min-w-[120px] relative cursor-pointer hover:bg-primary/[0.01] transition-colors duration-200",
                  colIdx < 6 && "border-r",
                  isToday && "bg-primary/[0.01]"
                )}
                onClick={(e) => handleColumnClick(e, day)}
              >
                {/* Grid lines */}
                {timeSlots.map((_, i) => (
                  <div key={i} className="absolute w-full border-t border-border/30" style={{ top: i * HOUR_HEIGHT }} />
                ))}
                {timeSlots.map((_, i) => (
                  <div key={`h-${i}`} className="absolute w-full border-t border-border/10 border-dashed" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
                ))}

                <AnimatePresence>
                  {dayAppts.map(posApt => {
                    const apt = posApt.item as WeekAppointment;
                    const displayStatus = getDisplayStatus(apt);
                    const statusVisuals = getStatusVisuals(displayStatus);
                    const profColor = getProfessionalColor(apt.professional_id, apt.professional?.full_name);
                    const clientName = apt.client_name || apt.client?.name || 'Cliente';

                    return (
                      <motion.div
                        key={apt.id}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        data-apt="true"
                        className={cn(
                          "absolute rounded-lg border cursor-pointer z-[2] overflow-hidden transition-all hover:shadow-md hover:z-[10] group",
                          statusVisuals.bg,
                          statusVisuals.border
                        )}
                        style={{ 
                          top: posApt.top, 
                          height: Math.max(posApt.height, 24),
                          left: `${posApt.left + 1}%`,
                          width: `${posApt.width - 2}%`
                        }}
                        onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                        title={`${clientName} - ${format(parseISO(apt.start_time), 'HH:mm')}`}
                      >
                        {/* Status Indicator Stripe */}
                        <div className={cn("absolute left-0 top-0 bottom-0 w-0.5", statusVisuals.text.replace('text', 'bg'))} />
                        
                        <div className="px-1.5 py-0.5 h-full flex flex-col justify-center min-w-0">
                          <p className={cn("text-[10px] font-bold truncate leading-tight", statusVisuals.text)}>
                            {clientName}
                          </p>
                          {posApt.height >= 35 && (
                            <p className="text-[9px] opacity-70 truncate leading-tight mt-0.5 font-medium">
                              {format(parseISO(apt.start_time), 'HH:mm')}
                            </p>
                          )}
                        </div>
                        
                        {/* Professional Color Bar */}
                        <div className={cn("absolute bottom-0 left-0 right-0 h-0.5 opacity-40", profColor.border.replace('border', 'bg'))} />
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {isToday && currentTimePosition !== null && (
                  <div className="absolute left-0 right-0 z-[15] flex items-center pointer-events-none" style={{ top: currentTimePosition }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0 shadow-sm" />
                    <div className="flex-1 h-[2px] bg-destructive/50" />
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
