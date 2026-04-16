import { useMemo } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, addDays, isSameDay, isSameMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface MonthAppointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  client_name?: string | null;
  client?: { name?: string } | null;
  professional_id: string;
  total_price: number;
  appointment_services?: Array<{ service?: { name?: string } | null }>;
  delay_minutes?: number | null;
  promotion_id?: string | null;
}

interface AgendaMonthViewProps {
  appointments: MonthAppointment[];
  currentDate: Date;
  onDayClick: (date: Date) => void;
  getDisplayStatus: (apt: any) => string;
}

const statusDotColors: Record<string, string> = {
  pending: 'bg-warning',
  confirmed: 'bg-primary',
  in_progress: 'bg-blue-500',
  cancelled: 'bg-destructive',
  completed: 'bg-success',
  no_show: 'bg-muted-foreground',
  rescheduled: 'bg-orange-400',
  late: 'bg-warning',
};

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MAX_VISIBLE = 3;

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

  // Build 6 weeks of days
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
      // Stop if we've passed the month end
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
    <div className="border rounded-lg overflow-hidden">
      {/* Day name headers */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {DAY_NAMES.map(name => (
          <div key={name} className="px-1 py-2 text-center border-r last:border-r-0">
            <span className="text-[11px] font-medium text-muted-foreground uppercase">{name}</span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      {weeks.map((week, wIdx) => (
        <div key={wIdx} className="grid grid-cols-7 border-b last:border-b-0">
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
                  "min-h-[80px] sm:min-h-[100px] border-r last:border-r-0 p-1 cursor-pointer hover:bg-muted/40 transition-colors",
                  !isCurrentMonth && "opacity-40 bg-muted/10",
                  isToday && "bg-primary/5"
                )}
                onClick={() => onDayClick(day)}
              >
                {/* Day number */}
                <div className="flex items-center justify-between mb-0.5">
                  <span className={cn(
                    "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                    isToday && "bg-primary text-primary-foreground font-bold"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayAppts.length > 0 && (
                    <span className="text-[9px] text-muted-foreground">{dayAppts.length}</span>
                  )}
                </div>

                {/* Appointment pills */}
                <div className="space-y-0.5">
                  {visibleAppts.map(apt => {
                    const displayStatus = getDisplayStatus(apt);
                    const dotColor = statusDotColors[displayStatus] || 'bg-muted-foreground';
                    const clientName = apt.client_name || apt.client?.name || 'Cliente';
                    return (
                      <div
                        key={apt.id}
                        className="flex items-center gap-1 rounded px-1 py-0.5 bg-muted/50 hover:bg-muted transition-colors"
                        onClick={(e) => { e.stopPropagation(); }}
                      >
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", dotColor)} />
                        <span className="text-[9px] sm:text-[10px] truncate leading-tight">
                          {format(parseISO(apt.start_time), 'HH:mm')} {clientName}
                        </span>
                      </div>
                    );
                  })}
                  {extraCount > 0 && (
                    <p className="text-[9px] text-muted-foreground pl-1">+{extraCount} mais</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};
