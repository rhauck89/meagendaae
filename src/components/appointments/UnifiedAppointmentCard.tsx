import { format, parseISO, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toZonedTime } from 'date-fns-tz';
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
  const timezone = 'America/Sao_Paulo';
  const startTime = toZonedTime(parseISO(apt.start_time), timezone);
  const endTime = toZonedTime(parseISO(apt.end_time), timezone);
  const now = toZonedTime(new Date(), timezone);
  const isToday = isSameDay(startTime, now);

  const displayDateShort = isToday 
    ? 'HOJE' 
    : format(startTime, "d 'DE' MMM", { locale: ptBR }).toUpperCase();
  
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
  const professionalName = apt.professional?.full_name || apt.professional?.name || '';
  const companyName = apt.company?.name || 'Empresa';
  
  const formattedPrice = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(apt.final_price || apt.total_price));

  const originalPrice = Number(apt.original_price || apt.total_price || 0);
  const finalPrice = Number(apt.final_price || apt.total_price || 0);
  const promoDiscount = Number(apt.promotion_discount || 0);
  const cashbackUsed = Number(apt.cashback_used || 0);
  const manualDiscount = Number(apt.manual_discount || 0);
  const totalDiscounts = promoDiscount + cashbackUsed + manualDiscount;

  const formatBRL = (val: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(val);

  // --- COMPACT VARIANT (Used in "Next Appointments" and summaries) ---
  const servicesText = formatServicesWithDuration(apt.appointment_services, 2);

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
        {/* Left Indicator Stripe */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-1",
          statusColors[displayStatus] || 'bg-muted'
        )} />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="text-center min-w-[70px] border-r pr-3">
              <p className="text-sm font-bold leading-tight">{format(startTime, 'HH:mm')}</p>
              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">até {format(endTime, 'HH:mm')}</p>
              <p className="text-[10px] font-bold text-primary uppercase mt-1">{displayDateShort}</p>
            </div>
            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1 min-w-0">
                <p className="text-sm font-bold truncate leading-tight capitalize max-w-[140px] sm:max-w-none">
                  {clientName}
                </p>
                <div className="flex gap-0.5 ml-1">
                  {apt.promotion_id && (
                    <span className="text-[10px]" title="Promoção">🏷️</span>
                  )}
                  {cashbackUsed > 0 && apt.status !== 'cancelled' && apt.status !== 'no_show' && (
                    <span className="text-[10px]" title="Cashback">💸</span>
                  )}
                  {(apt.status === 'cancelled' || apt.status === 'no_show') && cashbackUsed > 0 && (
                    <span className="text-[10px]" title="Cashback Estornado">💸↩️</span>
                  )}
                  {apt.client?.is_vip && (
                    <span className="text-[10px]" title="VIP">⭐</span>
                  )}
                  {apt.special_schedule && (
                    <span className="text-[10px]" title="Horário Especial">🟣</span>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground truncate font-medium max-w-[180px] sm:max-w-none" title={formatServicesWithDuration(apt.appointment_services)}>
                {servicesText}
              </p>
              {professionalName && (
                <p className="text-[10px] text-primary/80 truncate font-semibold flex items-center gap-1 mt-0.5">
                  <User className="h-2.5 w-2.5" />
                  {professionalName}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Inline Delay Badge */}
            {(apt.delay_minutes > 0 || displayStatus === 'late') && (
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-warning/10 text-warning border-warning/20 font-bold whitespace-nowrap animate-pulse">
                ⏱️ {apt.delay_minutes > 0 ? `+${apt.delay_minutes}m` : 'ATRASADO'}
              </Badge>
            )}
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-background/80 border border-border/10">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-2 rounded-xl shadow-xl border-border/40">
                <DropdownMenuItem 
                  className="gap-2 p-2.5 cursor-pointer rounded-lg text-xs"
                  onClick={(e) => { e.stopPropagation(); onWhatsApp?.(apt); }}
                >
                  <MessageSquare className="h-3.5 w-3.5 text-green-600" /> WhatsApp
                </DropdownMenuItem>
                
                <DropdownMenuItem 
                  className="gap-2 p-2.5 cursor-pointer rounded-lg text-xs"
                  onClick={(e) => { e.stopPropagation(); onRegisterDelay?.(apt); }}
                >
                  <Timer className="h-3.5 w-3.5 text-warning" /> Registrar Atraso
                </DropdownMenuItem>
                
                {!apt.promotion_id && (
                  <DropdownMenuItem 
                    className="gap-2 p-2.5 cursor-pointer rounded-lg text-xs"
                    onClick={(e) => { e.stopPropagation(); onReschedule?.(apt); }}
                  >
                    <RefreshCw className="h-3.5 w-3.5 text-blue-500" /> Reagendar
                  </DropdownMenuItem>
                )}

                <DropdownMenuItem 
                  className="gap-2 p-2.5 cursor-pointer rounded-lg text-xs font-medium"
                  onClick={(e) => { e.stopPropagation(); onAdjust?.(apt); }}
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-purple-500" /> Ajustar (IA)
                </DropdownMenuItem>

                <DropdownMenuSeparator />
                
                <DropdownMenuItem 
                  className="gap-2 p-2.5 cursor-pointer rounded-lg text-xs text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onClick={(e) => { e.stopPropagation(); onCancel?.(apt); }}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancelar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Action Button for Compact Variant */}
        <div className="pt-1 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-col">
              {totalDiscounts > 0 && (
                <span className="text-[9px] text-muted-foreground line-through decoration-muted-foreground/50">
                  {formatBRL(originalPrice)}
                </span>
              )}
              <span className="text-xs font-bold text-foreground/80">{formattedPrice}</span>
            </div>
          
          <div className="flex-1 flex justify-end">
            {isPast && displayStatus !== 'completed' && displayStatus !== 'cancelled' ? (
              <Button
                size="sm"
                className="h-8 rounded-lg bg-success hover:bg-success/90 text-white font-bold text-[10px] px-3 shadow-sm active:scale-[0.98]"
                onClick={() => onComplete?.(apt)}
              >
                <CheckCircle2 className="mr-1.5 h-3 w-3" />
                Concluir Atendimento
              </Button>
            ) : displayStatus === 'completed' ? (
              <Badge variant="outline" className="h-6 bg-success/10 text-success border-success/20 font-bold uppercase tracking-wider text-[8px] px-2">
                Concluído
              </Badge>
            ) : displayStatus === 'confirmed' || displayStatus === 'pending' || displayStatus === 'in_progress' || displayStatus === 'late' ? (
              <div className="flex gap-2 w-full justify-end">
                {displayStatus === 'pending' && !isPast ? (
                  <Button 
                    size="sm"
                    className="h-8 rounded-lg font-bold text-[10px] px-3 shadow-sm active:scale-[0.98]"
                    onClick={() => onUpdateStatus?.(apt.id, 'confirmed')}
                  >
                    Confirmar
                  </Button>
                ) : (
                  <div className="h-8 flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[8px] px-2.5">
                    <CalendarCheck className="h-3 w-3" />
                    {isPast ? 'Passado' : 'Confirmado'}
                  </div>
                )}
                
                {(isNow || (isPast && displayStatus !== 'completed')) && (
                  <Button
                    size="sm"
                    className="h-8 rounded-lg bg-success hover:bg-success/90 text-white font-bold text-[10px] px-3 shadow-sm active:scale-[0.98]"
                    onClick={() => onComplete?.(apt)}
                  >
                    Concluir
                  </Button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </motion.div>
    );
  }

  // --- DEFAULT VARIANT (Premium List Card) ---
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)" }}
      transition={{ duration: 0.2 }}
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
      {/* Left Indicator Stripe */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-1.5",
        statusColors[displayStatus] || 'bg-muted'
      )} />

      <div className="flex justify-between items-start gap-1 sm:gap-3">
        <div className="flex gap-3 sm:gap-4 items-start">
          {/* Time Column */}
            <div className="flex flex-col items-center justify-center bg-background/60 backdrop-blur-sm rounded-xl px-2.5 py-1.5 sm:px-3 sm:py-2 min-w-[70px] sm:min-w-[85px] border border-border/40 shadow-sm shrink-0">
              <p className="text-lg sm:text-xl font-display font-bold text-foreground tracking-tight">
                {format(startTime, 'HH:mm')}
              </p>
              <p className="text-[9px] text-muted-foreground leading-none -mt-0.5 mb-1 whitespace-nowrap">até {format(endTime, 'HH:mm')}</p>
              <p className="text-[10px] font-bold text-primary uppercase tracking-wider text-center">
                {displayDateShort}
              </p>
            </div>

          {/* Info Column */}
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h3 className={cn(
                "font-bold text-foreground leading-tight truncate capitalize max-w-[150px] sm:max-w-none",
                variant === 'detailed' ? 'text-lg' : 'text-sm sm:text-base'
              )}>
                {variant === 'client' 
                  ? format(startTime, "d 'de' MMMM', 'eeee", { locale: ptBR })
                  : clientName
                }
              </h3>
              {apt.promotion_id && (
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-none h-4 px-1 text-[9px] font-bold uppercase tracking-tighter">
                  🏷️ PROMO
                </Badge>
              )}
              {cashbackUsed > 0 && apt.status !== 'cancelled' && apt.status !== 'no_show' && (
                <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-none h-4 px-1 text-[9px] font-bold uppercase tracking-tighter">
                  💸 CASHBACK
                </Badge>
              )}
              {apt.client?.is_vip && (
                <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 border-none h-4 px-1 text-[9px] font-bold uppercase tracking-tighter">
                  ⭐ VIP
                </Badge>
              )}
              {apt.special_schedule && (
                <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 border-none h-4 px-1 text-[9px] font-bold uppercase tracking-tighter">
                  🟣 ESPECIAL
                </Badge>
              )}
            </div>
            
            <p className={cn(
              "font-medium text-muted-foreground/90 flex items-center gap-1.5 truncate",
              variant === 'detailed' ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
            )}>
              <Scissors className="h-3 w-3 sm:h-3.5 sm:w-3.5 shrink-0" />
              {apt.appointment_services?.length > 0 
                ? formatServicesWithDuration(apt.appointment_services) 
                : 'Serviço não informado'}
            </p>
            
            {variant !== 'client' && professionalName && (
              <p className="text-[11px] sm:text-xs font-semibold text-primary/80 flex items-center gap-1 pt-0.5">
                <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                {professionalName}
              </p>
            )}
            
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              {variant === 'client' && professionalName && (
                <p className="text-[11px] sm:text-xs font-semibold text-primary/80 flex items-center gap-1">
                  <User className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {professionalName}
                </p>
              )}
              {showCompany && (
                <p className="text-[11px] sm:text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {companyName}
                </p>
              )}
              {variant === 'detailed' && apt.client?.whatsapp && (
                <p className="text-[11px] sm:text-xs font-medium text-green-600 flex items-center gap-1">
                  <MessageSquare className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                  {apt.client.whatsapp}
                </p>
              )}
              <div className="flex flex-col items-end gap-0.5">
                {totalDiscounts > 0 && (
                  <div className="flex flex-col items-end text-[10px] space-y-0.5">
                    <span className="text-muted-foreground line-through">
                      {formatBRL(originalPrice)}
                    </span>
                    {promoDiscount > 0 && (
                      <span className="text-orange-600 font-medium">🏷️ Promoção -{formatBRL(promoDiscount)}</span>
                    )}
                    {cashbackUsed > 0 && (
                      <span className="text-blue-600 font-medium">💸 Cashback -{formatBRL(cashbackUsed)}</span>
                    )}
                    {manualDiscount > 0 && (
                      <span className="text-purple-600 font-medium">✍️ Desconto manual -{formatBRL(manualDiscount)}</span>
                    )}
                  </div>
                )}
                <div className="flex flex-col items-end">
                  <span className={cn(
                    "font-display font-black text-foreground",
                    variant === 'detailed' ? 'text-lg' : 'text-sm sm:text-base'
                  )}>
                    {totalDiscounts > 0 ? `💰 Total: ${formattedPrice}` : formattedPrice}
                  </span>
                  {apt.extra_fee > 0 && (
                    <span className="text-[9px] text-purple-600 font-bold uppercase tracking-wider">
                      +R$ {Number(apt.extra_fee).toFixed(2)} taxa
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            {variant === 'detailed' && apt.notes && (
              <div className="mt-3 p-3 bg-muted/50 rounded-lg border border-border/20">
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  "{apt.notes}"
                </p>
              </div>
            )}
            
            {variant === 'detailed' && (
              <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/10">
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                  <Clock className="h-3 w-3" />
                  Criado em: {format(parseISO(apt.created_at || new Date().toISOString()), 'dd/MM/yy HH:mm')}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Actions & Badges */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10 rounded-full hover:bg-background/80 shadow-sm border border-border/20">
                <MoreHorizontal className="h-5 w-5 sm:h-6 sm:w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-2 rounded-xl shadow-xl border-border/40">
              <DropdownMenuItem 
                className="gap-2 p-3 cursor-pointer rounded-lg"
                onClick={(e) => { e.stopPropagation(); onWhatsApp?.(apt); }}
              >
                <MessageSquare className="h-4 w-4 text-green-600" /> WhatsApp
              </DropdownMenuItem>
              
              <DropdownMenuItem 
                className="gap-2 p-3 cursor-pointer rounded-lg"
                onClick={(e) => { e.stopPropagation(); onRegisterDelay?.(apt); }}
              >
                <Timer className="h-4 w-4 text-warning" /> Registrar Atraso
              </DropdownMenuItem>
              
              {!apt.promotion_id && (
                <DropdownMenuItem 
                  className="gap-2 p-3 cursor-pointer rounded-lg"
                  onClick={(e) => { e.stopPropagation(); onReschedule?.(apt); }}
                >
                  <RefreshCw className="h-4 w-4 text-blue-500" /> Reagendar
                </DropdownMenuItem>
              )}

              <DropdownMenuItem 
                className="gap-2 p-3 cursor-pointer rounded-lg font-medium"
                onClick={(e) => { e.stopPropagation(); onAdjust?.(apt); }}
              >
                <ArrowLeftRight className="h-4 w-4 text-purple-500" /> Ajustar (IA)
              </DropdownMenuItem>

              <DropdownMenuSeparator />
              
              <DropdownMenuItem 
                className="gap-2 p-3 cursor-pointer rounded-lg text-destructive focus:bg-destructive/10 focus:text-destructive"
                onClick={(e) => { e.stopPropagation(); onCancel?.(apt); }}
              >
                <XCircle className="h-4 w-4" /> Cancelar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Inline Delay Badge - ALWAYS VISIBLE if there's a delay */}
          {(apt.delay_minutes > 0 || displayStatus === 'late') && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-end gap-1"
            >
              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 animate-pulse font-bold px-2 py-0.5 text-[10px] whitespace-nowrap">
                ⏱️ {apt.delay_minutes > 0 ? `+${apt.delay_minutes} min` : 'ATRASADO'}
              </Badge>
            </motion.div>
          )}
        </div>
      </div>

      {/* Primary Action Button (CTA) */}
      <div className="pt-2" onClick={(e) => e.stopPropagation()}>
        {isPast && displayStatus !== 'completed' && displayStatus !== 'cancelled' ? (
          <Button
            className="w-full h-11 sm:h-12 rounded-xl bg-success hover:bg-success/90 text-white font-bold text-sm sm:text-base shadow-lg shadow-success/20 transition-all active:scale-[0.98]"
            onClick={() => onComplete?.(apt)}
          >
            <CheckCircle2 className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            Concluir Atendimento
          </Button>
        ) : displayStatus === 'completed' ? (
          <div className="w-full h-10 sm:h-11 flex items-center justify-center gap-2 rounded-xl bg-success/10 text-success border border-success/20 font-bold uppercase tracking-wider text-[10px] sm:text-xs">
            <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            Concluído
          </div>
        ) : displayStatus === 'confirmed' || displayStatus === 'pending' || displayStatus === 'in_progress' || displayStatus === 'late' ? (
          <div className="flex gap-2">
            {displayStatus === 'pending' && !isPast ? (
              <Button 
                className="flex-1 h-10 sm:h-11 rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                onClick={() => onUpdateStatus?.(apt.id, 'confirmed')}
              >
                Confirmar Agora
              </Button>
            ) : (
              <div className="flex-1 h-10 sm:h-11 flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-wider text-[10px] sm:text-xs">
                <CalendarCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {isPast ? 'Agendamento Passado' : 'Confirmado'}
              </div>
            )}
            
            {(isNow || (isPast && displayStatus !== 'completed')) && (
              <Button
                className="flex-1 h-10 sm:h-11 rounded-xl bg-success hover:bg-success/90 text-white font-bold text-xs sm:text-sm shadow-md transition-all active:scale-[0.98]"
                onClick={() => onComplete?.(apt)}
              >
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Concluir
              </Button>
            )}
          </div>
        ) : displayStatus === 'cancelled' || displayStatus === 'no_show' ? (
          <div className="w-full h-10 sm:h-11 flex items-center justify-center gap-2 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 font-bold uppercase tracking-wider text-[10px] sm:text-xs">
            <XCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            {displayStatus === 'cancelled' ? 'Cancelado' : 'Não compareceu'}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
