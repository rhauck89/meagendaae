import { useState, useEffect, useMemo } from 'react';
import { format, isToday, parseISO, startOfDay, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getAvailableSlots } from '@/lib/availability-service';
import { isSlotEligible } from '@/lib/promotion-period';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, User, Scissors, Clock, Loader2, Tag, Check, Zap, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromotionOpportunitiesProps {
  promotions: any[];
  services: any[];
  professionals: any[];
  isAdmin: boolean;
  onSelectSlot: (data: { date: string; times: string[]; professionalId: string; serviceId?: string }) => void;
}

export function PromotionOpportunities({
  promotions,
  services,
  professionals,
  isAdmin,
  onSelectSlot
}: PromotionOpportunitiesProps) {
  const { companyId, profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedProfessionalId, setSelectedProfessionalId] = useState(isAdmin ? 'all' : (profile?.id || ''));
  const [selectedServiceId, setSelectedServiceId] = useState('all');
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlots, setSelectedSlots] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSuggestion, setShowSuggestion] = useState(true);

  // Sync professional ID when profile loads or mode changes
  useEffect(() => {
    setShowSuggestion(true);
  }, [selectedDate, selectedProfessionalId]);

  const freeSlots = useMemo(() => slots.filter(s => s.isFree && !s.hasPromo), [slots]);
  
  const hasGaps = useMemo(() => {
    if (freeSlots.length <= 1) return false;
    
    // Check if slots are continuous
    for (let i = 0; i < freeSlots.length - 1; i++) {
      const current = freeSlots[i];
      const next = freeSlots[i+1];
      
      const [h1, m1] = current.time.split(':').map(Number);
      const [h2, m2] = next.time.split(':').map(Number);
      
      const diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff > 30) return true; // Gap found (assuming 30min intervals)
    }
    return false;
  }, [freeSlots]);

  const shouldShowSuggestion = useMemo(() => {
    return (
      showSuggestion &&
      selectedProfessionalId !== 'all' &&
      freeSlots.length >= 1 &&
      freeSlots.length <= 7 &&
      hasGaps
    );
  }, [showSuggestion, selectedProfessionalId, freeSlots, hasGaps]);
  useEffect(() => {
    if (!isAdmin && profile?.id) {
      setSelectedProfessionalId(profile.id);
    }
  }, [isAdmin, profile?.id]);

  useEffect(() => {
    if (companyId && selectedProfessionalId !== 'all') {
      fetchSlots();
    } else {
      setSlots([]);
    }
  }, [companyId, selectedDate, selectedProfessionalId, selectedServiceId]);

  const fetchSlots = async () => {
    setLoading(true);
    try {
      const date = parseISO(selectedDate);
      
      // Calculate average duration if "all" services or specific
      const duration = selectedServiceId === 'all' 
        ? (services.length > 0 ? Math.round(services.reduce((acc, s) => acc + (s.duration_minutes || 30), 0) / services.length) : 30)
        : (services.find(s => s.id === selectedServiceId)?.duration_minutes || 30);

      // Get available slots using the core service
      const result = await getAvailableSlots({
        source: 'manual',
        companyId: companyId!,
        professionalId: selectedProfessionalId,
        date,
        totalDuration: duration,
        filterPastForToday: false
      });

      // Now we need to reconstruct the full day timeline (free + occupied)
      // Since getAvailableSlots doesn't give us the full "grid" (only free ones), 
      // we generate a theoretical grid based on business hours or a fixed interval (e.g. 30min)
      // and check which ones are in result.slots.
      
      const startTime = 7 * 60; // 07:00
      const endTime = 22 * 60; // 22:00
      const interval = 30; // default 30 min steps for the opportunities view
      
      const fullGrid: any[] = [];
      for (let time = startTime; time <= endTime; time += interval) {
        const hh = Math.floor(time / 60);
        const mm = time % 60;
        const timeStr = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
        
        const isFree = result.slots.includes(timeStr);
        
        // Check if it's occupied by checking result.existingAppointments
        // A slot is occupied if there is an appointment overlapping [time, time + duration]
        const slotStart = new Date(date);
        slotStart.setHours(hh, mm, 0, 0);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);

        const isOccupied = result.existingAppointments.some((appt: any) => {
          const apptStart = new Date(appt.start_time);
          const apptEnd = new Date(appt.end_time);
          return slotStart < apptEnd && slotEnd > apptStart;
        });

        // Check if there's a promotion for this slot
        const hasPromo = promotions.some(promo => {
          if (promo.status !== 'active') return false;
          
          // Filter by professional
          if (promo.professional_filter === 'selected' && promo.professional_ids) {
            if (!promo.professional_ids.includes(selectedProfessionalId)) return false;
          }

          // Filter by service if specified
          if (selectedServiceId !== 'all') {
            const pSvcIds = promo.service_ids || (promo.service_id ? [promo.service_id] : []);
            if (pSvcIds.length > 0 && !pSvcIds.includes(selectedServiceId)) return false;
          }

          return isSlotEligible(promo, slotStart);
        });

        fullGrid.push({
          time: timeStr,
          isFree,
          isOccupied,
          hasPromo,
          fullDate: slotStart
        });
      }

      setSlots(fullGrid);
    } catch (error) {
      console.error('Error fetching slots:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Tag className="h-5 w-5 text-primary" />
              Oportunidades de Promoção
            </h3>
            <p className="text-sm text-muted-foreground">
              Selecione horários vazios para criar promoções e preencher sua agenda.
            </p>
          </div>

          {selectedSlots.length > 0 && (
            <Button 
              onClick={() => onSelectSlot({
                date: selectedDate,
                times: selectedSlots,
                professionalId: selectedProfessionalId,
                serviceId: selectedServiceId === 'all' ? undefined : selectedServiceId
              })}
              className="bg-primary hover:bg-primary/90 text-white shadow-lg animate-in fade-in slide-in-from-right-4"
            >
              Criar promoção para {selectedSlots.length} {selectedSlots.length === 1 ? 'horário' : 'horários'}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* ... existing select inputs ... */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <CalendarIcon className="h-3.5 w-3.5" /> Data
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedSlots([]);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <User className="h-3.5 w-3.5" /> Profissional
            </label>
            <Select 
              value={selectedProfessionalId} 
              onValueChange={(v) => {
                setSelectedProfessionalId(v);
                setSelectedSlots([]);
              }}
              disabled={!isAdmin}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {isAdmin && <SelectItem value="all">Selecione para ver vagas</SelectItem>}
                {professionals.map((p) => (
                  <SelectItem key={p.profile_id} value={p.profile_id}>
                    {p.profiles?.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium flex items-center gap-1.5">
              <Scissors className="h-3.5 w-3.5" /> Serviço (opcional)
            </label>
            <Select value={selectedServiceId} onValueChange={(v) => {
              setSelectedServiceId(v);
              setSelectedSlots([]);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os serviços" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os serviços</SelectItem>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedProfessionalId === 'all' ? (
          <div className="py-12 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
            <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Selecione um profissional para ver as oportunidades do dia.</p>
          </div>
        ) : loading ? (
          <div className="py-12 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Buscando disponibilidade...</p>
          </div>
        ) : slots.length > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
              {slots.map((slot) => {
                const isPromo = slot.hasPromo;
                const isOccupied = slot.isOccupied || !slot.isFree;
                const isSelected = selectedSlots.includes(slot.time);
                
                return (
                  <Button
                    key={slot.time}
                    variant="outline"
                    className={cn(
                      "h-auto py-3 px-2 flex flex-col gap-1 items-center justify-center transition-all relative",
                      isOccupied ? "opacity-50 cursor-not-allowed bg-muted" : "hover:border-primary",
                      isPromo && "border-amber-500/50 bg-amber-500/5 dark:bg-amber-500/10",
                      isSelected && "border-primary bg-primary/10 ring-2 ring-primary ring-offset-1"
                    )}
                    disabled={isOccupied || isPromo} // Do not allow selecting slots that already have a promo
                    onClick={() => {
                      setSelectedSlots(prev => 
                        prev.includes(slot.time) 
                          ? prev.filter(t => t !== slot.time) 
                          : [...prev, slot.time].sort()
                      );
                    }}
                  >
                    <span className={cn("text-xs font-bold", isOccupied ? "text-muted-foreground" : "text-foreground")}>
                      {slot.time}
                    </span>
                    <span className="text-[10px] leading-tight">
                      {isOccupied ? "Ocupado" : isSelected ? "Selecionado" : "Livre"}
                    </span>
                    {isSelected && (
                      <div className="absolute top-1 right-1">
                        <Check className="h-3 w-3 text-primary" />
                      </div>
                    )}
                    {isPromo && (
                      <Badge className="absolute -top-2 -right-2 px-1 py-0 h-4 text-[9px] bg-amber-500 hover:bg-amber-600 border-none shadow-sm">
                        PROMO
                      </Badge>
                    )}
                  </Button>
                );
              })}
            </div>
            
            <div className="flex flex-wrap gap-4 pt-2 border-t border-primary/10">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full border border-primary/20 bg-background" />
                <span className="text-xs text-muted-foreground">Disponível</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-muted border border-muted-foreground/20" />
                <span className="text-xs text-muted-foreground">Ocupado</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500 shadow-sm" />
                <span className="text-xs text-muted-foreground">Com Promoção</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="py-12 text-center border-2 border-dashed rounded-xl border-muted-foreground/20">
            <Clock className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum slot encontrado para este profissional no dia selecionado.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
