import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MoreHorizontal, 
  MessageSquare, 
  Timer, 
  RefreshCw, 
  ArrowLeftRight, 
  XCircle, 
  CheckCircle2, 
  Scissors, 
  User, 
  CalendarCheck,
  Building2,
  Clock
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import { formatServicesWithDuration } from '@/lib/format-services';

export interface UnifiedAppointmentCardProps {
  appointment: any;
  variant?: 'compact' | 'default' | 'detailed' | 'business' | 'client';
  isAdmin?: boolean;
  onComplete?: (apt: any) => void;
  onReschedule?: (apt: any) => void;
  onAdjust?: (apt: any) => void;
  onCancel?: (apt: any) => void;
  onUpdateStatus?: (id: string, status: string) => void;
  onRegisterDelay?: (apt: any) => void;
  onWhatsApp?: (apt: any) => void;
  onClick?: (apt: any) => void;
  isHighlighted?: boolean;
  className?: string;
  showCompany?: boolean;
}

const statusColors: Record<string, string> = {
  pending: 'bg-warning',
  confirmed: 'bg-primary',
  in_progress: 'bg-blue-500',
  cancelled: 'bg-destructive',
  completed: 'bg-success',
  no_show: 'bg-muted-foreground',
  rescheduled: 'bg-orange-500',
  late: 'bg-warning',
};

const statusCardStyles: Record<string, string> = {
  pending: 'bg-warning/5 border-l-warning',
  confirmed: 'bg-[hsl(226,100%,98%)] border-l-primary',
  in_progress: 'bg-blue-50 border-l-blue-500',
  cancelled: 'bg-destructive/5 border-l-destructive opacity-60',
  completed: 'bg-success/5 border-l-success opacity-80',
  no_show: 'bg-muted/30 border-l-muted-foreground opacity-60',
  rescheduled: 'bg-orange-50 border-l-orange-500 opacity-60',
  late: 'bg-warning/10 border-l-warning',
};

export function UnifiedAppointmentCard({
  appointment: apt,
  variant = 'default',
  isAdmin = false,
  onComplete,
  onReschedule,
  onAdjust,
  onCancel,
  onUpdateStatus,
  onRegisterDelay,
  onWhatsApp,
  onClick,
  isHighlighted,
  className,
  showCompany = false
}: UnifiedAppointmentCardProps) {
  const startTime = parseISO(apt.start_time);
  const endTime = parseISO(apt.end_time);
  const now = new Date();
  
  const getDisplayStatus = () => {
    if (['completed', 'cancelled', 'no_show', 'rescheduled'].includes(apt.status)) {
      return apt.status;
    }
    if ((apt.status === 'confirmed' || apt.status === 'pending') && now > endTime) {
      return 'late';
    }
    if (apt.status === 'confirmed' && now >= startTime && now <= endTime) {
      return 'in_progress';
    }
    return apt.status;
  };

  const displayStatus = getDisplayStatus();
  const isPast = now > endTime;
  const isNow = now >= startTime && now <= endTime;
  
  const clientName = apt.client_name || apt.client?.name || 'Cliente';
  const professionalName = apt.professional?.full_name || apt.professional?.name || 'Profissional';
  const companyName = apt.company?.name || 'Empresa';
  
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(apt.final_price || apt.total_price));

  const originalPrice = Number(apt.original_price || apt.total_price || 0);
  const promoDiscount = Number(apt.promotion_discount || 0);
  const cashbackUsed = Number(apt.cashback_used || 0);
  const manualDiscount = Number(apt.manual_discount || 0);
  const totalDiscounts = promoDiscount + cashbackUsed + manualDiscount;

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);

  // --- COMPACT VARIANT (Used in "Next Appointments" and summaries) ---
  if (variant === 'compact') {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          "relative flex flex-col gap-2 p-3 rounded-xl border transition-all cursor-pointer shadow-sm",
          statusCardStyles[displayStatus] || 'bg-card',
          isHighlighted && 'ring-2 ring-primary shadow-lg',
          "group overflow-hidden",
          className
        )}
        onClick={() => onClick?.(apt)}
      >
        <div className={cn("absolute left-0 top-0 bottom-0 w-1", statusColors[displayStatus] || 'bg-muted')} />
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-center min-w-[60px] border-r pr-3">
              <p className="text-sm font-bold leading-tight">{format(startTime, 'HH:mm')}</p>
              <p className="text-[10px] font-bold text-primary uppercase">{format(startTime, "d 'DE' MMM", { locale: ptBR })}</p>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight capitalize">
                  {clientName}
                </p>
              </div>
              <p className="text-[10px] text-muted-foreground truncate font-medium">
                {formatServicesWithDuration(apt.appointment_services)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(apt.delay_minutes > 0 || displayStatus === 'late') && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-warning/10 text-warning border-warning/20 font-bold whitespace-nowrap animate-pulse">
                ⏱️ {apt.delay_minutes > 0 ? `+${apt.delay_minutes}m` : 'ATRASADO'}
              </Badge>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onWhatsApp?.(apt); }}>WhatsApp</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRegisterDelay?.(apt); }}>Atraso</DropdownMenuItem>
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel?.(apt); }}>Cancelar</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </motion.div>
    );
  }

  // --- BUSINESS / DEFAULT VARIANT ---
  return (
    <motion.div
      id={`agenda-apt-${apt.id}`}
      className={cn(
        "relative flex flex-col gap-4 p-4 rounded-2xl border transition-all",
        statusCardStyles[displayStatus] || 'bg-card',
        isHighlighted && 'ring-2 ring-primary shadow-xl',
        "group overflow-hidden",
        className
      )}
      onClick={() => onClick?.(apt)}
    >
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", statusColors[displayStatus] || 'bg-muted')} />

      <div className="flex justify-between items-start gap-3">
        <div className="flex gap-3 sm:gap-4 items-start">
          <div className="flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl px-2.5 py-1.5 min-w-[70px] border border-border/40 shadow-sm">
            <p className="text-lg font-display font-bold text-foreground tracking-tight">
              {format(startTime, 'HH:mm')}
            </p>
            {variant === 'business' && (
              <p className="text-[10px] text-muted-foreground font-medium -mt-1 mb-0.5">
                até {format(endTime, 'HH:mm')}
              </p>
            )}
            <p className="text-[10px] font-bold text-primary uppercase tracking-wider text-center">
              {format(startTime, "d 'de' MMM", { locale: ptBR })}
            </p>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-foreground leading-tight truncate capitalize text-sm sm:text-base">
                {variant === 'client' 
                  ? format(startTime, "d 'de' MMMM' - 'eeee", { locale: ptBR })
                  : clientName
                }
              </h3>
              {apt.promotion_id && <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 h-4 px-1 text-[9px] font-bold">🏷️ PROMO</Badge>}
              {cashbackUsed > 0 && <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 h-4 px-1 text-[9px] font-bold">💸 CASHBACK</Badge>}
            </div>
            
            <p className="font-medium text-muted-foreground/90 flex items-center gap-1.5 truncate text-xs sm:text-sm">
              <Scissors className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              {apt.appointment_services?.length > 0 ? formatServicesWithDuration(apt.appointment_services) : 'Serviço não informado'}
            </p>
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <p className="text-[11px] sm:text-xs font-semibold text-primary/80 flex items-center gap-1">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {professionalName}
              </p>
              {showCompany && (
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {companyName}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full border border-border/20">
                <MoreHorizontal className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onWhatsApp?.(apt); }}>WhatsApp</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onRegisterDelay?.(apt); }}>Atraso</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onReschedule?.(apt); }}>Reagendar</DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onCancel?.(apt); }}>Cancelar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="flex flex-col items-end">
            <span className="font-display font-black text-foreground text-sm sm:text-base">
              {formattedPrice}
            </span>
          </div>
        </div>
      </div>

      <div className="pt-2" onClick={(e) => e.stopPropagation()}>
        {isPast && displayStatus !== 'completed' && displayStatus !== 'cancelled' ? (
          <Button className="w-full bg-success hover:bg-success/90 font-bold" onClick={() => onComplete?.(apt)}>
            <CheckCircle2 className="mr-2 h-4 w-4" /> Concluir Atendimento
          </Button>
        ) : displayStatus === 'completed' ? (
          <div className="w-full h-10 flex items-center justify-center gap-2 rounded-xl bg-success/10 text-success border border-success/20 font-bold uppercase text-[10px]">
            Concluído
          </div>
        ) : (displayStatus === 'confirmed' || displayStatus === 'pending' || displayStatus === 'in_progress' || displayStatus === 'late') ? (
          <div className="flex gap-2 w-full">
            <div className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold uppercase text-[10px]">
              <CalendarCheck className="h-3.5 w-3.5" /> {isPast ? 'Passado' : 'Confirmado'}
            </div>
            {(isNow || (isPast && displayStatus !== 'completed')) && (
              <Button className="flex-1 bg-success hover:bg-success/90 font-bold" onClick={() => onComplete?.(apt)}>
                Concluir
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
