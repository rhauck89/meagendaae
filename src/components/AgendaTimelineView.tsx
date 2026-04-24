import { useMemo, useRef, useEffect, useCallback } from 'react';
import { format, parseISO, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { 
  groupOverlappingItems, 
  calculateGroupPositions, 
  getProfessionalColor, 
  getStatusVisuals,
  getTimePosition,
  getBlockHeight
} from '@/utils/calendarLayout';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Scissors, Clock, MoreVertical, AlertCircle } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

const HOUR_HEIGHT = 80; // Larger for better visibility
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
      const groups = groupOverlappingItems(appointments);
      const positionedAppointments = groups.flatMap(group => 
        calculateGroupPositions(group, HOUR_HEIGHT, START_HOUR)
      );
      
      return [{ id: 'all', name: 'Agenda Geral', appointments: positionedAppointments, blockedTimes }];
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
    const target = e.target as HTMLElement;
    if (target.closest('[data-apt]') || target.closest('[data-blocked]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top + (e.currentTarget.parentElement?.parentElement?.scrollTop || 0);
    const time = positionToTime(y);
    const profId = colId === 'all' ? undefined : colId;
    onEmptySlotClick(time, profId);
  }, [onEmptySlotClick]);

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* Header with Professional Info & Stats */}
      {columnMode === 'professionals' && columns.length > 1 && (
        <div className="flex border-b bg-muted/20 backdrop-blur-sm sticky top-0 z-20">
          <div className="w-16 shrink-0 border-r bg-muted/10" />
          {columns.map(col => {
            const profColor = getProfessionalColor(col.id, col.name);
            return (
              <div key={col.id} className="flex-1 min-w-[200px] px-4 py-3 border-r last:border-r-0">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", profColor.border.replace('border', 'bg'))} />
                  <p className="text-sm font-bold truncate">{col.name}</p>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                    {col.appointments.length} Agendamentos
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Main Timeline View */}
      <div ref={scrollRef} className="overflow-auto max-h-[700px] relative scrollbar-thin scrollbar-thumb-muted">
        <div className="flex" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
          {/* Hour Labels */}
          <div className="w-16 shrink-0 border-r relative bg-muted/5 z-10">
            {timeSlots.map((slot, i) => (
              <div key={slot} className="absolute w-full text-right pr-3" style={{ top: i * HOUR_HEIGHT }}>
                <span className="text-[11px] font-bold text-muted-foreground/60 leading-none relative -top-2">{slot}</span>
              </div>
            ))}
          </div>

          {/* Columns */}
          {columns.map((col, colIdx) => (
            <div
              key={col.id}
              className={cn(
                "flex-1 min-w-[200px] relative cursor-pointer transition-colors duration-200",
                "hover:bg-primary/[0.01]",
                colIdx < columns.length - 1 && "border-r"
              )}
              onClick={(e) => handleColumnClick(e, col.id)}
            >
              {/* Hour Lines */}
              {timeSlots.map((_, i) => (
                <div key={i} className="absolute w-full border-t border-border/30" style={{ top: i * HOUR_HEIGHT }} />
              ))}
              {/* Half-Hour Lines */}
              {timeSlots.map((_, i) => (
                <div key={`half-${i}`} className="absolute w-full border-t border-border/10 border-dashed" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
              ))}

              {/* Blocked Times */}
              {col.blockedTimes.map(bt => {
                const today = format(new Date(), 'yyyy-MM-dd');
                const startISO = `${bt.block_date || today}T${bt.start_time}:00`;
                const endISO = `${bt.block_date || today}T${bt.end_time}:00`;
                const top = getTimePosition(startISO, HOUR_HEIGHT, START_HOUR);
                const height = getBlockHeight(startISO, endISO, HOUR_HEIGHT);
                return (
                  <motion.div
                    key={bt.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    data-blocked="true"
                    className="absolute left-1 right-1 rounded-lg border border-dashed border-destructive/30 bg-destructive/[0.03] z-[1] flex items-center justify-center group overflow-hidden"
                    style={{ top, height }}
                  >
                    <div className="absolute inset-0 bg-stripe-destructive opacity-10" />
                    <span className="text-[10px] text-destructive/70 font-bold truncate px-2 relative z-10 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {bt.reason || 'Bloqueado'}
                    </span>
                  </motion.div>
                );
              })}

              {/* Appointments */}
              <AnimatePresence>
                {col.appointments.map(posApt => {
                  const apt = posApt.item as TimelineAppointment;
                  const displayStatus = getDisplayStatus(apt);
                  const statusVisuals = getStatusVisuals(displayStatus);
                  const profColor = getProfessionalColor(apt.professional_id, (apt.professional as any)?.full_name);
                  
                  const clientName = apt.client_name || apt.client?.name || 'Cliente';
                  const serviceName = apt.appointment_services?.[0]?.service?.name || 'Serviço';
                  
                  return (
                    <motion.div
                      key={apt.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      id={`agenda-apt-${apt.id}`}
                      data-apt="true"
                      className={cn(
                        "absolute rounded-lg border shadow-sm cursor-pointer z-[2] overflow-hidden transition-all group",
                        "hover:shadow-md hover:z-[10] hover:ring-2 hover:ring-primary/20",
                        statusVisuals.bg,
                        statusVisuals.border
                      )}
                      style={{ 
                        top: posApt.top, 
                        height: Math.max(posApt.height, 28),
                        left: `${posApt.left + 1}%`,
                        width: `${posApt.width - 2}%`
                      }}
                      onClick={(e) => { e.stopPropagation(); onAppointmentClick(apt); }}
                    >
                      {/* Status Indicator Stripe */}
                      <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusVisuals.text.replace('text', 'bg'))} />
                      
                      <div className="px-2 py-1 h-full flex flex-col min-w-0">
                        <div className="flex items-center justify-between gap-1 min-w-0">
                          <p className={cn("text-[11px] font-bold truncate leading-tight", statusVisuals.text)}>
                            {clientName}
                          </p>
                          {apt.delay_minutes ? (
                            <span className="text-[9px] animate-pulse text-warning font-black">⏱️</span>
                          ) : null}
                        </div>

                        {posApt.height >= 40 && (
                          <p className="text-[10px] text-muted-foreground truncate leading-tight mt-0.5">
                            {serviceName}
                          </p>
                        )}

                        {posApt.height >= 60 && (
                          <div className="mt-auto flex items-center justify-between gap-1 opacity-70">
                            <span className="text-[9px] font-medium">
                              {format(parseISO(apt.start_time), 'HH:mm')}
                            </span>
                            {columnMode === 'day' && (
                              <Badge variant="outline" className={cn("text-[8px] h-3 px-1 border-none bg-transparent", profColor.text)}>
                                {apt.professional?.full_name?.split(' ')[0]}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Professional Color Bar at the bottom if in Day mode */}
                      {columnMode === 'day' && (
                        <div className={cn("absolute bottom-0 left-0 right-0 h-0.5 opacity-50", profColor.border.replace('border', 'bg'))} />
                      )}

                      {/* Tooltip content (custom implementation since rad-ui tooltip might be tricky in absolute) */}
                      <div className="absolute hidden group-hover:block left-full top-0 ml-2 z-50 bg-popover border rounded-xl shadow-xl p-3 min-w-[220px] pointer-events-none animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center gap-2 mb-2">
                          <div className={cn("w-2 h-2 rounded-full", statusVisuals.text.replace('text', 'bg'))} />
                          <p className="font-bold text-sm">{clientName}</p>
                        </div>
                        
                        <div className="space-y-1.5">
                          <p className="text-xs flex items-center gap-2 text-muted-foreground">
                            <Scissors className="h-3 w-3" /> {serviceName}
                          </p>
                          <p className="text-xs flex items-center gap-2">
                            <Clock className="h-3 w-3 text-primary" /> {format(parseISO(apt.start_time), 'HH:mm')} - {format(parseISO(apt.end_time), 'HH:mm')}
                          </p>
                          {apt.professional?.full_name && (
                            <p className="text-xs flex items-center gap-2 text-muted-foreground">
                              <User className="h-3 w-3" /> {apt.professional.full_name}
                            </p>
                          )}
                        </div>
                        
                        <div className="mt-3 pt-2 border-t flex items-center justify-between">
                          <Badge variant="outline" className={cn("text-[10px] uppercase font-bold tracking-tighter", statusVisuals.bg, statusVisuals.text)}>
                            {timelineStatusLabels[displayStatus] || displayStatus}
                          </Badge>
                          <span className="text-xs font-bold">R$ {Number(apt.total_price).toFixed(2)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {/* Current Time Indicator */}
              {currentTimePosition !== null && (
                <div
                  className="absolute left-0 right-0 z-[20] flex items-center pointer-events-none"
                  style={{ top: currentTimePosition }}
                >
                  <div className="w-2 h-2 rounded-full bg-destructive shrink-0 shadow-sm" />
                  <div className="flex-1 h-[2px] bg-destructive/50" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
