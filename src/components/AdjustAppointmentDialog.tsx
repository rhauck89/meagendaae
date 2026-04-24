import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, User, ArrowLeftRight, Scissors, AlertTriangle, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isPromoActive } from '@/lib/promotion-period';

interface AdjustAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onAdjust: (type: 'reschedule' | 'professional' | 'both' | 'normal') => void;
  onConverted?: () => void;
}

export function AdjustAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onAdjust,
  onConverted,
}: AdjustAppointmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [promoData, setPromoData] = useState<any>(null);

  useEffect(() => {
    if (open && appointment?.promotion_id) {
      fetchPromoData();
    } else {
      setPromoData(null);
    }
  }, [open, appointment]);

  const fetchPromoData = async () => {
    const { data } = await supabase
      .from('promotions')
      .select('*')
      .eq('id', appointment.promotion_id)
      .maybeSingle();
    setPromoData(data);
  };

  const handleConvertToNormal = async () => {
    if (!appointment) return;
    setLoading(true);
    try {
      // Get original price if possible
      let newPrice = appointment.total_price;
      if (promoData?.original_price) {
        newPrice = promoData.original_price;
      }

      const { error } = await supabase
        .from('appointments')
        .update({
          promotion_id: null,
          total_price: newPrice,
          notes: (appointment.notes || '') + '\n[Convertido de promoção para atendimento normal]'
        } as any)
        .eq('id', appointment.id);

      if (error) throw error;

      toast.success('Convertido para atendimento normal');
      onConverted?.();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Error converting appointment:', err);
      toast.error('Erro ao converter agendamento');
    } finally {
      setLoading(false);
    }
  };

  if (!appointment) return null;

  const isPromotion = !!appointment.promotion_id;
  const start = parseISO(appointment.start_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-primary" />
            Ajustar Agendamento
          </DialogTitle>
          <DialogDescription>
            Escolha como deseja ajustar o agendamento de <strong>{appointment.client_name || 'Cliente'}</strong>.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 pt-4">
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
            <div className="flex justify-between items-start">
              <p className="font-semibold text-sm">{appointment.client_name || 'Cliente'}</p>
              {isPromotion && (
                <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  Promoção
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {format(start, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> {appointment.professional?.full_name || 'Profissional'}
            </p>
          </div>

          <div className="grid gap-2">
            <Button
              variant="outline"
              className="justify-start gap-3 h-12"
              onClick={() => {
                onAdjust('reschedule');
                onOpenChange(false);
              }}
            >
              <Clock className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Trocar horário</p>
                <p className="text-[10px] text-muted-foreground">Manter o mesmo profissional</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-12"
              onClick={() => {
                onAdjust('professional');
                onOpenChange(false);
              }}
            >
              <User className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Trocar profissional</p>
                <p className="text-[10px] text-muted-foreground">Manter o mesmo horário</p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="justify-start gap-3 h-12"
              onClick={() => {
                onAdjust('both');
                onOpenChange(false);
              }}
            >
              <ArrowLeftRight className="h-4 w-4 text-primary" />
              <div className="text-left">
                <p className="text-sm font-medium">Trocar horário + profissional</p>
                <p className="text-[10px] text-muted-foreground">Alterar data, hora e profissional</p>
              </div>
            </Button>

            {isPromotion && (
              <Button
                variant="outline"
                className="justify-start gap-3 h-12 border-amber-200 hover:border-amber-300 hover:bg-amber-50"
                onClick={handleConvertToNormal}
                disabled={loading}
              >
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <div className="text-left">
                  <p className="text-sm font-medium">Converter para atendimento normal</p>
                  <p className="text-[10px] text-muted-foreground">Remove o vínculo com a promoção</p>
                </div>
              </Button>
            )}
          </div>
        </DialogBody>

        <DialogFooter className="sm:justify-start">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
