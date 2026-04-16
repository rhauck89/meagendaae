import { useMemo, useRef, useEffect } from 'react';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface TimelineAppointment {
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
  getDisplayStatus: (apt: any) => string;
}

const HOUR_HEIGHT = 60; // px per hour
const START_HOUR = 7;
const END_HOUR = 22;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const timelineStatusColors: Record<string, string> = {
  pending: 'bg-warning/80 border-warning text-warning-foreground',
  confirmed: 'bg-primary/80 border-primary text-primary-foreground',
  in_progress: 'bg-blue-500/80 border-blue-500 text-white',
  cancelled: 'bg-destructive/60 border-destructive text-white opacity-60',
  completed: 'bg-success/70 border-success text-white opacity-80',
  no_show: 'bg-muted border-border text-muted-foreground opacity-60',
  rescheduled: 'bg-orange-400/70 border-orange-500 text-white opacity-70',
  late: 'bg-warning/80 border-warning text-warning-foreground',
};

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

const getTimePosition = (timeStr: string): number => {
  const date = parseISO(timeStr);
  const hours = date.getHours() + date.getMinutes() / 60;
  return Math.max(0, (hours - START_HOUR) * HOUR_HEIGHT);
};

const getBlockHeight = (startStr: string, endStr: string): number => {
  const mins = differenceInMinutes(parseISO(endStr), parseISO(startStr));
  return Math.max(20, (mins / 60) * HOUR_HEIGHT);
};

export const AgendaTimelineView = ({
  appointments,
  blockedTimes,
  professionals,
  columnMode,
  onAppointmentClick,
  getDisplayStatus,
}: AgendaTimelineViewProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to current hour on mount
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
      return [{ id: 'all', name: 'Agenda', appointments, blockedTimes }];
    }
    return professionals.map(p => ({
      id: p.profile_id,
      name: (p.profile as any)?.full_name || 'Sem nome',
      appointments: appointments.filter(a => a.professional_id === p.profile_id),
      blockedTimes: blockedTimes.filter(bt => bt.professional_id === p.profile_id),
    }));
  }, [columnMode, professionals, appointments, blockedTimes]);

  const timeSlots = useMemo(() => {
    const slots: string[] = [];
    for (let h = START_HOUR; h < END_HOUR; h++) {
      slots.push(`${h.toString().padStart(2, '0')}:00`);
    }
    return slots;
  }, []);

  // Current time indicator
  const now = new Date();
  const currentTimePosition = now.getHours() >= START_HOUR && now.getHours() < END_HOUR
    ? ((now.getHours() + now.getMinutes() / 60) - START_HOUR) * HOUR_HEIGHT
    : null;

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Column headers for multi-professional mode */}
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

      {/* Timeline body */}
      <div ref={scrollRef} className="overflow-auto max-h-[600px] relative">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Time labels */}
          <div className="w-14 shrink-0 border-r relative bg-muted/10">
            {timeSlots.map((slot, i) => (
              <div
                key={slot}
                className="absolute w-full text-right pr-2"
                style={{ top: i * HOUR_HEIGHT }}
              >
                <span className="text-[11px] text-muted-foreground leading-none relative -top-2">{slot}</span>
              </div>
            ))}
          </div>

          {/* Columns */}
          {columns.map((col, colIdx) => (
            <div
              key={col.id}
              className={cn(
                "flex-1 min-w-[180px] relative",
                colIdx < columns.length - 1 && "border-r"
              )}
            >
              {/* Hour grid lines */}
              {timeSlots.map((_, i) => (
                <div
                  key={i}
                  className="absolute w-full border-t border-border/40"
                  style={{ top: i * HOUR_HEIGHT }}
                />
              ))}

              {/* Half-hour lines */}
              {timeSlots.map((_, i) => (
                <div
                  key={`half-${i}`}
                  className="absolute w-full border-t border-border/20 border-dashed"
                  style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }}
                />
              ))}

              {/* Blocked times */}
              {col.blockedTimes.map(bt => {
                // Convert HH:mm to fake ISO for positioning
                const today = format(new Date(), 'yyyy-MM-dd');
                const startISO = `${bt.block_date || today}T${bt.start_time}:00`;
                const endISO = `${bt.block_date || today}T${bt.end_time}:00`;
                const top = getTimePosition(startISO);
                const height = getBlockHeight(startISO, endISO);
                return (
                  <div
                    key={bt.id}
                    className="absolute left-1 right-1 rounded border border-destructive/30 bg-destructive/10 z-[1] flex items-center justify-center"
                    style={{ top, height }}
                  >
                    <span className="text-[10px] text-destructive font-medium truncate px-1">
                      🚫 {bt.reason || 'Bloqueado'}
                    </span>
                  </div>
                );
              })}

              {/* Appointments */}
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
                    className={cn(
                      "absolute left-1 right-1 rounded-md border cursor-pointer z-[2] overflow-hidden transition-all hover:shadow-md hover:z-[5] group",
                      colorClass
                    )}
                    style={{ top, height: Math.max(height, 24) }}
                    onClick={() => onAppointmentClick(apt)}
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
                    {/* Hover tooltip */}
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

              {/* Current time indicator */}
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
