import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { getStatusVisuals, getProfessionalColor } from '@/utils/calendarLayout';
import { motion } from 'framer-motion';

interface MonthAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name?: string | null;
  client?: { name?: string } | null;
  professional_id: string;
  professional?: { full_name?: string } | null;
  total_price: number;
  appointment_services?: Array<{ service?: { name?: string } | null }>;
  delay_minutes?: number | null;
  promotion_id?: string | null;
  special_schedule?: boolean;
}

interface AgendaMonthViewProps {
  appointments: MonthAppointment[];
  currentDate: Date;
  onDayClick: (date: Date) => void;
  getDisplayStatus: (apt: any) => string;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE = 4;

export const AgendaMonthView = ({
  appointments,
  currentDate,
  onDayClick,
  getDisplayStatus,
}: AgendaMonthViewProps) => {
  const today = new Date();
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { locale: ptBR });

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let day = calendarStart;
    for (let w = 0; w < 6; w++) {
      const week: Date[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(day);
        day = addDays(day, 1);
      }
      result.push(week);
      if (day > monthEnd && w >= 4) break;
    }
    return result;
  }, [calendarStart, monthEnd]);

  const appointmentsByDay = useMemo(() => {
    const map = new Map<string, MonthAppointment[]>();
    appointments.forEach(apt => {
      const key = format(parseISO(apt.start_time), 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(apt);
    });
    return map;
  }, [appointments]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b bg-muted/20 backdrop-blur-sm">
        {DAY_NAMES.map(name => (
          <div key={name} className="px-1 py-3 text-center border-r last:border-r-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{name}</span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="flex flex-col">
        {weeks.map((week, wIdx) => (
          <div key={wIdx} className="grid grid-cols-7 border-b last:border-b-0 min-h-[100px] sm:min-h-[120px]">
            {week.map((day) => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const dayAppts = appointmentsByDay.get(dayKey) || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, today);
              const visibleAppts = dayAppts.slice(0, MAX_VISIBLE);
              const extraCount = dayAppts.length - MAX_VISIBLE;

              return (
                <div
                  key={dayKey}
                  className={cn(
                    "relative flex flex-col border-r last:border-r-0 p-1.5 cursor-pointer transition-all duration-200 group",
                    "hover:bg-primary/[0.02]",
                    !isCurrentMonth && "bg-muted/5 opacity-40",
                    isToday && "bg-primary/[0.03]"
                  )}
                  onClick={() => onDayClick(day)}
                >
                  {/* Day number */}
                  <div className="flex items-center justify-between mb-1.5 px-0.5">
                    <span className={cn(
                      "text-xs font-display font-black w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                      isToday ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground group-hover:text-foreground"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayAppts.length > 0 && (
                      <span className="text-[10px] font-bold text-muted-foreground/60">{dayAppts.length}</span>
                    )}
                  </div>

                  {/* Appointment pills */}
                  <div className="space-y-1 overflow-hidden">
                    {visibleAppts.map(apt => {
                      const displayStatus = getDisplayStatus(apt);
                      const statusVisuals = getStatusVisuals(displayStatus);
                      const profColor = getProfessionalColor(apt.professional_id, apt.professional?.full_name);
                      const clientName = apt.client_name || apt.client?.name || 'Cliente';
                      
                      return (
                        <div
                          key={apt.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-1.5 py-0.5 border shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all",
                            "hover:shadow-md hover:scale-[1.02]",
                            statusVisuals.bg,
                            statusVisuals.border
                          )}
                        >
                          {/* Small professional color dot */}
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", profColor.border.replace('border', 'bg'))} />
                          <span className={cn("text-[10px] font-bold truncate leading-tight flex-1 flex items-center gap-0.5", statusVisuals.text)}>
                            {format(parseISO(apt.start_time), 'HH:mm')} {clientName}
                            {apt.special_schedule && <span className="text-[9px] shrink-0">🟣</span>}
                          </span>
                        </div>
                      );
                    })}
                    {extraCount > 0 && (
                      <p className="text-[9px] font-bold text-muted-foreground/60 pl-1 py-0.5">
                        +{extraCount} outros
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};
