import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogBody
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Tag, Wallet, Star, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Slot {
  date: string;
  slots: string[];
  professionalId: string;
}

interface WeeklySlotPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slots: Slot[];
  onConfirm: (selectedSlots: { date: string; time: string; professionalId: string }[], promoType: 'traditional' | 'cashback' | 'points') => void;
}

export function WeeklySlotPicker({ open, onOpenChange, slots, onConfirm }: WeeklySlotPickerProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [promoType, setPromoType] = useState<'traditional' | 'cashback' | 'points'>('traditional');
  const [step, setStep] = useState<'slots' | 'type'>('slots');

  // Group slots by date for easier rendering
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { date: string; items: { time: string; professionalId: string }[] }>();
    
    slots.forEach(group => {
      if (!map.has(group.date)) {
        map.set(group.date, { date: group.date, items: [] });
      }
      group.slots.forEach(time => {
        map.get(group.date)!.items.push({ time, professionalId: group.professionalId });
      });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  const toggleSlot = (date: string, time: string) => {
    const id = `${date}T${time}`;
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllDay = (date: string, dayItems: { time: string; professionalId: string }[]) => {
    const dayIds = dayItems.map(item => `${date}T${item.time}`);
    const allSelected = dayIds.every(id => selectedItems.includes(id));
    
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !dayIds.includes(id)));
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...dayIds])));
    }
  };

  const handleNext = () => {
    if (step === 'slots') {
      if (selectedItems.length === 0) return;
      setStep('type');
    } else {
      const finalSlots = selectedItems.map(id => {
        const [date, time] = id.split('T');
        const professionalId = slots.find(s => s.date === date)?.professionalId || '';
        return { date, time, professionalId };
      });
      
      console.log('[PROMOTION_WEEK_GAPS_DEBUG]', {
        action: 'confirm_slots',
        selectedCount: finalSlots.length,
        promoType,
        slots: finalSlots
      });
      
      onConfirm(finalSlots, promoType);
      onOpenChange(false);
      // Reset for next time
      setTimeout(() => {
        setStep('slots');
        setSelectedItems([]);
      }, 300);
    }
  };

  const formatDateLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            {step === 'slots' ? (
              <>
                <Calendar className="h-5 w-5 text-primary" />
                Selecionar Horários Ociosos
              </>
            ) : (
              <>
                <Tag className="h-5 w-5 text-primary" />
                Tipo de Promoção
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-hidden p-0">
          {step === 'slots' ? (
            <ScrollArea className="h-full px-6 py-2">
              <div className="space-y-6 pb-6">
                <p className="text-sm text-muted-foreground">
                  Escolha os horários que deseja preencher com promoções nesta semana.
                </p>

                {groupedSlots.map((day) => (
                  <div key={day.date} className="space-y-3">
                    <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm py-1 z-10">
                      <h3 className="text-sm font-bold capitalize">
                        {formatDateLabel(day.date)}
                      </h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-[10px] uppercase font-bold text-primary"
                        onClick={() => selectAllDay(day.date, day.items)}
                      >
                        {day.items.every(item => selectedItems.includes(`${day.date}T${item.time}`)) 
                          ? 'Desmarcar Tudo' 
                          : 'Selecionar Tudo'}
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {day.items.map((item) => {
                        const id = `${day.date}T${item.time}`;
                        const isSelected = selectedItems.includes(id);
                        return (
                          <button
                            key={id}
                            onClick={() => toggleSlot(day.date, item.time)}
                            className={cn(
                              "flex flex-col items-center justify-center p-2 rounded-lg border transition-all h-14",
                              isSelected 
                                ? "bg-primary/10 border-primary ring-1 ring-primary" 
                                : "bg-card hover:bg-accent border-border"
                            )}
                          >
                            <span className={cn(
                              "text-xs font-bold",
                              isSelected ? "text-primary" : "text-foreground"
                            )}>
                              {item.time.substring(0, 5)}
                            </span>
                            {isSelected && <Check className="h-3 w-3 text-primary mt-1" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {groupedSlots.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock className="h-12 w-12 text-muted-foreground/30 mb-4" />
                    <p className="text-sm text-muted-foreground">Nenhuma lacuna encontrada na semana.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                Como você deseja incentivar o preenchimento desses horários?
              </p>

              <div className="grid gap-3">
                <button
                  onClick={() => setPromoType('traditional')}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    promoType === 'traditional' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent border-border"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Desconto Direto</p>
                    <p className="text-xs text-muted-foreground">Reduza o preço original do serviço.</p>
                  </div>
                  {promoType === 'traditional' && <div className="h-2 w-2 rounded-full bg-primary" />}
                </button>

                <button
                  onClick={() => setPromoType('cashback')}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border text-left transition-all",
                    promoType === 'cashback' ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-accent border-border"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Cashback em Dobro</p>
                    <p className="text-xs text-muted-foreground">Ofereça mais saldo para o cliente voltar.</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase">Em Breve</Badge>
                </button>

                <button
                  disabled
                  className="flex items-center gap-4 p-4 rounded-xl border text-left opacity-50 cursor-not-allowed bg-muted/50"
                >
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold">Pontos em Dobro</p>
                    <p className="text-xs text-muted-foreground">Incentive o programa de fidelidade.</p>
                  </div>
                  <Badge variant="secondary" className="text-[9px] uppercase">Em Breve</Badge>
                </button>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="p-6 pt-2 border-t flex items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground font-medium">
            {selectedItems.length} {selectedItems.length === 1 ? 'horário selecionado' : 'horários selecionados'}
          </div>
          <div className="flex gap-2">
            {step === 'type' && (
              <Button variant="ghost" onClick={() => setStep('slots')}>
                Voltar
              </Button>
            )}
            <Button 
              onClick={handleNext} 
              disabled={selectedItems.length === 0}
              className="gap-2"
            >
              {step === 'slots' ? 'Avançar' : 'Gerar Promoções'}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
