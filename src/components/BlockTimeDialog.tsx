import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Ban } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';

interface Professional {
  profile_id: string;
  full_name: string;
}

interface BlockTimeDialogProps {
  professionals: Professional[];
  onCreated: () => void;
}

const REASONS = ['Almoço', 'Reunião', 'Folga', 'Compromisso pessoal', 'Outro'];

export function BlockTimeDialog({ professionals, onCreated }: BlockTimeDialogProps) {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const [selectedProfessional, setSelectedProfessional] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [startTime, setStartTime] = useState('12:00');
  const [endTime, setEndTime] = useState('13:00');
  const [reason, setReason] = useState('');

  // Auto-select professional for non-admins
  useEffect(() => {
    if (!isAdmin && profileId) {
      setSelectedProfessional(profileId);
    }
  }, [isAdmin, profileId]);

  const handleSubmit = async () => {
    if (!companyId || !selectedProfessional || !selectedDate || !startTime || !endTime) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    if (startTime >= endTime) {
      toast.error('O horário final deve ser após o horário inicial');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('blocked_times' as any).insert({
        company_id: companyId,
        professional_id: selectedProfessional,
        block_date: format(selectedDate, 'yyyy-MM-dd'),
        start_time: startTime,
        end_time: endTime,
        reason: reason || null,
      });

      if (error) throw error;

      toast.success('Horário bloqueado com sucesso');
      setOpen(false);
      resetForm();
      onCreated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao bloquear horário');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    if (isAdmin) setSelectedProfessional('');
    setSelectedDate(undefined);
    setStartTime('12:00');
    setEndTime('13:00');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Ban className="h-4 w-4" />
          Bloquear horário
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bloquear horário</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {isAdmin && (
            <div className="space-y-2">
              <Label>Profissional</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((p) => (
                    <SelectItem key={p.profile_id} value={p.profile_id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Data</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn('w-full justify-start text-left font-normal', !selectedDate && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR }) : 'Selecione a data'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={setSelectedDate}
                  disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Motivo</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o motivo (opcional)" />
              </SelectTrigger>
              <SelectContent>
                {REASONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Bloqueando...' : 'Bloquear horário'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
