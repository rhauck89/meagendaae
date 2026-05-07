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
import { format, parseISO, isToday, isTomorrow, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarRange, User, Trash2, Check, ChevronDown, ChevronUp, ChevronRight, Clock } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<string>('');
  const [expandedDays, setExpandedDays] = useState<string[]>([]);

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

  // Set default active tab when opening or changing professional
  useEffect(() => {
    if (open && groupedSlots.length > 0) {
      if (!activeTab || !groupedSlots.find(s => s.date === activeTab)) {
        setActiveTab(groupedSlots[0].date);
      }
    }
  }, [open, groupedSlots, activeTab]);

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

  const getDayAbbreviation = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, 'EEE', { locale: ptBR }).replace('.', '');
  };

  const getDayNumber = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd');
  };

  const formatDateFull = (dateStr: string) => {
    const d = parseISO(dateStr);
    if (isToday(d)) return 'Hoje';
    if (isTomorrow(d)) return 'Amanhã';
    return format(d, "eeee, dd 'de' MMMM", { locale: ptBR });
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

  const currentDayData = useMemo(() => {
    return groupedSlots.find(s => s.date === activeTab);
  }, [groupedSlots, activeTab]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden flex flex-col max-h-[95vh] h-[90vh]">
        <DialogHeader className="p-6 pb-2 border-b">
          <DialogTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5 text-primary" />
            Selecionar Horários Ociosos
          </DialogTitle>
          <div className="mt-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            <User className="h-3 w-3" />
            Agenda de: <span className="text-foreground font-bold">{selectedProfName}</span>
          </div>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-hidden p-0 flex flex-col">
          {/* Controls & Professional Selection */}
          <div className="px-6 py-4 space-y-4 bg-muted/20">
            {isAdmin && (
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-muted-foreground ml-1">
                  Selecione o Profissional
                </label>
                <Select value={selectedProfId} onValueChange={(val) => {
                  setSelectedProfId(val);
                  setSelectedItems([]);
                  setActiveTab('');
                }}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Escolha um profissional" />
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

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={selectAllSlots} className="text-[10px] h-7 px-3">
                  Selecionar Todos
                </Button>
                <Button variant="ghost" size="sm" onClick={clearSelection} className="text-[10px] h-7 text-destructive hover:text-destructive hover:bg-destructive/5">
                  <Trash2 className="h-3 w-3 mr-1" /> Limpar
                </Button>
              </div>
            </div>
          </div>

          {/* Horizontal Tabs */}
          {selectedProfId && groupedSlots.length > 0 && (
            <div className="border-b bg-background">
              <div className="w-full overflow-x-auto flex p-2 gap-2 px-6 no-scrollbar">
                  {groupedSlots.map((day) => {
                    const isActive = activeTab === day.date;
                    const count = selectedCountByDay[day.date] || 0;
                    return (
                      <button
                        key={day.date}
                        onClick={() => setActiveTab(day.date)}
                        className={cn(
                          "flex flex-col items-center justify-center min-w-[64px] py-2 px-3 rounded-xl border transition-all relative",
                          isActive 
                            ? "bg-primary text-primary-foreground border-primary shadow-md" 
                            : "bg-muted/50 border-transparent hover:bg-muted text-muted-foreground"
                        )}
                      >
                        <span className="text-[10px] font-bold uppercase leading-none mb-1">
                          {getDayAbbreviation(day.date)}
                        </span>
                        <span className="text-lg font-black leading-none">
                          {getDayNumber(day.date)}
                        </span>
                        {count > 0 && (
                          <Badge 
                            className={cn(
                              "absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-[10px] border-2",
                              isActive ? "bg-white text-primary border-primary" : "bg-primary text-white border-white"
                            )}
                          >
                            {count}
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

          {/* Tab Content */}
          <ScrollArea className="flex-1">
            <div className="px-6 py-6">
              {!selectedProfId ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <User className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm text-muted-foreground">
                    Selecione um profissional para ver as lacunas da semana.
                  </p>
                </div>
              ) : !currentDayData ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Clock className="h-12 w-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum horário livre encontrado.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-black capitalize text-foreground leading-none">
                        {formatDateFull(currentDayData.date)}
                      </h3>
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        {currentDayData.items.length} horários livres disponíveis
                      </p>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={cn(
                        "h-8 text-[10px] uppercase font-black transition-all",
                        currentDayData.items.every(item => selectedItems.includes(`${currentDayData.date}T${item.time}_${item.professionalId}`))
                          ? "bg-primary/10 text-primary border-primary/50"
                          : "text-primary border-primary/20 hover:bg-primary/5"
                      )}
                      onClick={() => selectAllDay(currentDayData.date, currentDayData.items)}
                    >
                      {currentDayData.items.every(item => selectedItems.includes(`${currentDayData.date}T${item.time}_${item.professionalId}`)) 
                        ? 'Desmarcar Dia' 
                        : 'Selecionar Dia'}
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {(expandedDays.includes(currentDayData.date) ? currentDayData.items : currentDayData.items.slice(0, 8)).map((item, idx) => {
                      const id = `${currentDayData.date}T${item.time}_${item.professionalId}`;
                      const isSelected = selectedItems.includes(id);
                      return (
                        <button
                          key={`${id}-${idx}`}
                          onClick={() => toggleSlot(currentDayData.date, item.time, item.professionalId)}
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

                  {currentDayData.items.length > 8 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full h-9 text-[11px] font-bold text-muted-foreground hover:text-primary mt-2 border border-dashed hover:border-primary/50 rounded-xl"
                      onClick={() => toggleExpandDay(currentDayData.date)}
                    >
                      {expandedDays.includes(currentDayData.date) ? (
                        <><ChevronUp className="h-4 w-4 mr-1" /> Ver menos</>
                      ) : (
                        <><ChevronDown className="h-4 w-4 mr-1" /> Ver mais ({currentDayData.items.length - 8} horários)</>
                      )}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogBody>

        <DialogFooter className="p-6 border-t bg-muted/5 flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col">
              <span className="text-sm font-black text-foreground">
                {selectedItems.length} horários selecionados
              </span>
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                em {uniqueDaysSelected} {uniqueDaysSelected === 1 ? 'dia' : 'dias'} diferentes
              </span>
            </div>
          </div>
          <Button 
            onClick={handleNext} 
            disabled={selectedItems.length === 0}
            className="w-full gap-2 font-black h-12 shadow-lg text-sm uppercase tracking-tight"
          >
            Preencher Horários Selecionados
            <ChevronRight className="h-4 w-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
