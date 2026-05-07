import { useState, useMemo, useEffect } from 'react';
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
import { Calendar, Clock, ChevronRight, Check, Trash2, CalendarRange, User, ChevronDown, ChevronUp } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  isAdmin: boolean;
  professionals: any[];
  currentProfessionalId?: string;
}

export function WeeklySlotPicker({ 
  open, 
  onOpenChange, 
  slots, 
  onConfirm,
  isAdmin,
  professionals,
  currentProfessionalId
}: WeeklySlotPickerProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectedProfId, setSelectedProfId] = useState<string>(currentProfessionalId || '');
  const [expandedDays, setExpandedDays] = useState<string[]>([]);

  // Automatically set professional if not admin
  useEffect(() => {
    if (!isAdmin && currentProfessionalId) {
      setSelectedProfId(currentProfessionalId);
    }
  }, [isAdmin, currentProfessionalId, open]);

  const selectedProfName = useMemo(() => {
    const prof = professionals.find(p => p.profile_id === selectedProfId);
    return prof?.profiles?.full_name || prof?.name || 'Profissional';
  }, [selectedProfId, professionals]);

  // Group slots by date for the selected professional
  const groupedSlots = useMemo(() => {
    if (!selectedProfId) return [];
    
    const filtered = slots.filter(s => s.professionalId === selectedProfId);
    const map = new Map<string, { date: string; items: { time: string; professionalId: string }[] }>();
    
    filtered.forEach(group => {
      if (!map.has(group.date)) {
        map.set(group.date, { date: group.date, items: [] });
      }
      group.slots.forEach(time => {
        map.get(group.date)!.items.push({ time, professionalId: group.professionalId });
      });
    });

    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [slots, selectedProfId]);

  const toggleSlot = (date: string, time: string, profId: string) => {
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
      professionalId: selectedProfId,
      professionalName: selectedProfName,
      selectedCount: finalSlots.length,
      slots: finalSlots
    });
    
    onConfirm(finalSlots);
    onOpenChange(false);
    setTimeout(() => {
      setSelectedItems([]);
      setExpandedDays([]);
    }, 300);
  };

  const toggleExpandDay = (date: string) => {
    setExpandedDays(prev => 
      prev.includes(date) ? prev.filter(d => d !== date) : [...prev, date]
    );
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
      <DialogContent className=\"sm:max-w-[500px] p-0 overflow-hidden flex flex-col max-h-[90vh]\">
        <DialogHeader className=\"p-6 pb-2\">
          <DialogTitle className=\"flex items-center gap-2\">
            <CalendarRange className=\"h-5 w-5 text-primary\" />
            Selecionar Horários Ociosos
          </DialogTitle>
          <div className=\"mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground\">
            <User className=\"h-3 w-3\" />
            Agenda de: <span className=\"text-foreground font-bold\">{selectedProfName}</span>
          </div>
        </DialogHeader>

        <DialogBody className=\"flex-1 overflow-hidden p-0 flex flex-col\">
          <div className=\"px-6 py-4 space-y-4 border-b bg-muted/20\">
            {isAdmin && (
              <div className=\"space-y-1.5\">
                <label className=\"text-[10px] uppercase font-bold text-muted-foreground ml-1\">
                  Selecione o Profissional
                </label>
                <Select value={selectedProfId} onValueChange={(val) => {
                  setSelectedProfId(val);
                  setSelectedItems([]);
                }}>
                  <SelectTrigger className=\"h-10\">
                    <SelectValue placeholder=\"Escolha um profissional\" />
                  </SelectTrigger>
                  <SelectContent>
                    {professionals.map((p) => (
                      <SelectItem key={p.profile_id} value={p.profile_id}>
                        {p.profiles?.full_name || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!selectedProfId ? (
              <div className=\"py-4 text-center\">
                <p className=\"text-sm text-muted-foreground\">
                  Selecione um profissional para ver as lacunas da semana.
                </p>
              </div>
            ) : (
              <div className=\"flex items-center justify-between\">
                <div className=\"flex gap-2\">
                  <Button variant=\"outline\" size=\"sm\" onClick={selectAllSlots} className=\"text-[10px] h-7\">
                    Selecionar Todos
                  </Button>
                  <Button variant=\"ghost\" size=\"sm\" onClick={clearSelection} className=\"text-[10px] h-7 text-destructive hover:text-destructive hover:bg-destructive/5\">
                    <Trash2 className=\"h-3 w-3 mr-1\" /> Limpar
                  </Button>
                </div>
                {selectedItems.length > 0 && (
                  <Badge variant=\"secondary\" className=\"text-[10px] bg-primary/10 text-primary border-primary/20\">
                    {selectedItems.length} horários selecionados
                  </Badge>
                )}
              </div>
            )}
          </div>

          <ScrollArea className=\"flex-1\">
            <div className=\"px-6 pb-6 pt-2 space-y-8\">
              {selectedProfId && groupedSlots.map((day) => {
                const isExpanded = expandedDays.includes(day.date);
                const visibleItems = isExpanded ? day.items : day.items.slice(0, 8);
                const hasMore = day.items.length > 8;

                return (
                  <div key={day.date} className=\"space-y-4\">
                    <div className=\"flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur-sm py-2 z-10 border-b border-dashed\">
                      <div className=\"flex flex-col\">
                        <h3 className=\"text-sm font-black capitalize flex items-center gap-2\">
                          {formatDateLabel(day.date)}
                          {selectedCountByDay[day.date] > 0 && (
                            <Badge className=\"h-4 px-1.5 text-[9px] bg-primary text-primary-foreground\">
                              {selectedCountByDay[day.date]}
                            </Badge>
                          )}
                        </h3>
                        <span className=\"text-[10px] text-muted-foreground font-medium\">
                          {day.items.length} horários livres
                        </span>
                      </div>
                      <Button 
                        variant=\"ghost\" 
                        size=\"sm\" 
                        className=\"h-8 text-[10px] uppercase font-black text-primary hover:bg-primary/5\"
                        onClick={() => selectAllDay(day.date, day.items)}
                      >
                        {day.items.every(item => selectedItems.includes(`${day.date}T${item.time}_${item.professionalId}`)) 
                          ? 'Desmarcar Dia' 
                          : 'Selecionar Dia'}
                      </Button>
                    </div>
                    
                    <div className=\"grid grid-cols-4 gap-2\">
                      {visibleItems.map((item, idx) => {
                        const id = `${day.date}T${item.time}_${item.professionalId}`;
                        const isSelected = selectedItems.includes(id);
                        return (
                          <button
                            key={`${id}-${idx}`}
                            onClick={() => toggleSlot(day.date, item.time, item.professionalId)}
                            className={cn(
                              \"flex flex-col items-center justify-center p-2 rounded-xl border transition-all h-14 relative group\",
                              isSelected 
                                ? \"bg-primary/10 border-primary ring-1 ring-primary shadow-sm\" 
                                : \"bg-card hover:bg-accent border-border hover:border-primary/50\"
                            )}
                          >
                            <span className={cn(
                              \"text-xs font-black tracking-tight\",
                              isSelected ? \"text-primary\" : \"text-foreground\"
                            )}>
                              {item.time.substring(0, 5)}
                            </span>
                            {isSelected && (
                              <div className=\"absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow-sm\">
                                <Check className=\"h-2.5 w-2.5 stroke-[4]\" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {hasMore && (
                      <Button 
                        variant=\"ghost\" 
                        size=\"sm\" 
                        className=\"w-full h-8 text-[10px] font-bold text-muted-foreground hover:text-primary mt-2\"
                        onClick={() => toggleExpandDay(day.date)}
                      >
                        {isExpanded ? (
                          <><ChevronUp className=\"h-3 w-3 mr-1\" /> Ver menos</>
                        ) : (
                          <><ChevronDown className=\"h-3 w-3 mr-1\" /> Ver mais ({day.items.length - 8} horários)</>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}

              {selectedProfId && groupedSlots.length === 0 && (
                <div className=\"flex flex-col items-center justify-center py-16 text-center\">
                  <Clock className=\"h-12 w-12 text-muted-foreground/20 mb-4\" />
                  <p className=\"text-sm font-medium text-muted-foreground\">Nenhum horário livre encontrado para este profissional.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className=\"p-6 pt-3 border-t bg-muted/5\">
          <Button 
            onClick={handleNext} 
            disabled={selectedItems.length === 0}
            className=\"w-full gap-2 font-bold h-11 shadow-lg\"
          >
            Preencher Horários Selecionados
            <ChevronRight className=\"h-4 w-4\" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


