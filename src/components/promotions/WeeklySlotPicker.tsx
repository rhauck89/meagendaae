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
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, ChevronRight, Check, Trash2, CalendarRange } from 'lucide-react';
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
  onConfirm: (selectedSlots: { date: string; time: string; professionalId: string }[]) => void;
}

export function WeeklySlotPicker({ open, onOpenChange, slots, onConfirm }: WeeklySlotPickerProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Group slots by date for easier rendering
  const groupedSlots = useMemo(() => {
    const map = new Map<string, { date: string; items: { time: string; professionalId: string }[] }>();
    
    slots.forEach(group => {
      if (!map.has(group.date)) {
        map.set(group.date, { date: group.date, items: [] });
      }
      group.slots.forEach(time => {
        // Ensure uniqueness: date + time + profId
        map.get(group.date)!.items.push({ time, professionalId: group.professionalId });
      });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [slots]);

  const toggleSlot = (date: string, time: string, profId: string) => {
    // Unique key: dateTtime_profId
    const id = `${date}T${time}_${profId}`;
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAllDay = (date: string, dayItems: { time: string; professionalId: string }[]) => {
    const dayIds = dayItems.map(item => `${date}T${item.time}_${item.professionalId}`);
    const allSelected = dayIds.every(id => selectedItems.includes(id));
    
    if (allSelected) {
      setSelectedItems(prev => prev.filter(id => !dayIds.includes(id)));
    } else {
      setSelectedItems(prev => Array.from(new Set([...prev, ...dayIds])));
    }
  };

  const selectAllSlots = () => {
    const allIds = groupedSlots.flatMap(day => 
      day.items.map(item => `${day.date}T${item.time}_${item.professionalId}`)
    );
    setSelectedItems(allIds);
  };

  const clearSelection = () => {
    setSelectedItems([]);
  };

  const handleNext = () => {
    if (selectedItems.length === 0) return;
    
    const finalSlots = selectedItems.map(id => {
      const [dateTime, profId] = id.split('_');
      const [date, time] = dateTime.split('T');
      return { date, time, professionalId: profId };
    });
    
    console.log('[PROMOTION_WEEK_GAPS_DEBUG]', {
      action: 'confirm_slots',
      selectedCount: finalSlots.length,
      slots: finalSlots
    });
    
    onConfirm(finalSlots);
    onOpenChange(false);
    // Reset selection after delay
    setTimeout(() => setSelectedItems([]), 300);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "EEEE, d 'de' MMMM", { locale: ptBR });
  };

  const selectedCountByDay = useMemo(() => {
    const counts: Record<string, number> = {};
    selectedItems.forEach(id => {
      const date = id.split('T')[0];
      counts[date] = (counts[date] || 0) + 1;
    });
    return counts;
  }, [selectedItems]);

  const uniqueDaysSelected = Object.keys(selectedCountByDay).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            Selecionar Horários Ociosos
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Escolha os horários reais da agenda que receberão uma condição especial.
          </p>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-hidden p-0 flex flex-col">
          <div className="px-6 py-2 flex items-center justify-between border-b bg-muted/30">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAllSlots} className="text-[10px] h-7">
                Selecionar Todos
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection} className="text-[10px] h-7 text-destructive hover:text-destructive hover:bg-destructive/5">
                <Trash2 className="h-3 w-3 mr-1" /> Limpar
              </Button>
            </div>
            {selectedItems.length > 0 && (
              <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                {selectedItems.length} horários em {uniqueDaysSelected} dias
              </Badge>
            )}
          </div>

          <ScrollArea className="flex-1 px-6 py-2">
            <div className="space-y-8 pb-6 pt-2">
              {groupedSlots.map((day) => (
                <div key={day.date} className="space-y-4">
                  <div className="flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b border-dashed">
                    <div className="flex flex-col">
                      <h3 className="text-sm font-black capitalize flex items-center gap-2">
                        {formatDateLabel(day.date)}
                        {selectedCountByDay[day.date] > 0 && (
                          <Badge className="h-4 px-1.5 text-[9px] bg-primary text-primary-foreground">
                            {selectedCountByDay[day.date]}
                          </Badge>
                        )}
                      </h3>
                      <span className="text-[10px] text-muted-foreground font-medium">
                        {day.items.length} {day.items.length === 1 ? 'horário livre' : 'horários livres'}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-8 text-[10px] uppercase font-black text-primary hover:bg-primary/5"
                      onClick={() => selectAllDay(day.date, day.items)}
                    >
                      {day.items.every(item => selectedItems.includes(`${day.date}T${item.time}_${item.professionalId}`)) 
                        ? 'Desmarcar Dia' 
                        : 'Selecionar Dia'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {day.items.map((item, idx) => {
                      const id = `${day.date}T${item.time}_${item.professionalId}`;
                      const isSelected = selectedItems.includes(id);
                      return (
                        <button
                          key={`${id}-${idx}`}
                          onClick={() => toggleSlot(day.date, item.time, item.professionalId)}
                          className={cn(
                            "flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-14 relative group",
                            isSelected 
                              ? "bg-primary/10 border-primary ring-1 ring-primary shadow-sm" 
                              : "bg-card hover:bg-accent border-border hover:border-primary/50"
                          )}
                        >
                          <span className={cn(
                            "text-xs font-black tracking-tight",
                            isSelected ? "text-primary" : "text-foreground"
                          )}>
                            {item.time.substring(0, 5)}
                          </span>
                          {isSelected && (
                            <div className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm">
                              <Check className="h-2.5 w-2.5 stroke-[4]" />
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {groupedSlots.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum horário livre encontrado nesta semana.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className="p-6 pt-3 border-t bg-muted/5">
          <Button 
            onClick={handleNext} 
            disabled={selectedItems.length === 0}
            className="w-full gap-2 font-bold h-11 shadow-lg"
          >
            Preencher Horários Selecionados
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

