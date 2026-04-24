import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Clock, User, ArrowLeftRight, Scissors, AlertTriangle, Calendar, Sparkles, Loader2, Check } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isPromoActive } from '@/lib/promotion-period';
import { calculateAIOperationalSuggestion, type AIOperationalSuggestion } from '@/lib/smart-slot-suggestion';
import { getAvailableSlots } from '@/lib/availability-service';

interface AdjustAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: any;
  onAdjust: (type: 'reschedule' | 'professional' | 'both' | 'normal') => void;
  onConverted?: () => void;
  onApplySuggestion?: (suggestion: AIOperationalSuggestion) => void;
}

export function AdjustAppointmentDialog({
  open,
  onOpenChange,
  appointment,
  onAdjust,
  onConverted,
  onApplySuggestion,
}: AdjustAppointmentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [promoData, setPromoData] = useState<any>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AIOperationalSuggestion | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (open && appointment) {
      if (appointment.promotion_id) fetchPromoData();
      fetchAISuggestion();
    } else {
      setPromoData(null);
      setAiSuggestion(null);
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

  const fetchAISuggestion = async () => {
    if (!appointment || !appointment.company_id) return;
    setAiLoading(true);
    try {
      const { data: collaborators } = await supabase
        .from('collaborators')
        .select('profile_id, profile:profiles(full_name)')
        .eq('company_id', appointment.company_id);

      if (!collaborators || collaborators.length === 0) return;

      const date = parseISO(appointment.start_time);
      const totalDuration = appointment.appointment_services?.reduce(
        (sum: number, s: any) => sum + (s.duration_minutes || 0), 0
      ) || 30;

      // Parallel availability check for all professionals
      const availResults = await Promise.all(
        collaborators.map(async (c) => {
          const res = await getAvailableSlots({
            source: 'manual',
            companyId: appointment.company_id,
            professionalId: c.profile_id,
            date,
            totalDuration,
            filterPastForToday: true,
          });
          return {
            professionalId: c.profile_id,
            professionalName: (c.profile as any)?.full_name || 'Profissional',
            slots: res.slots,
            appointments: res.existingAppointments,
          };
        })
      );

      const suggestion = calculateAIOperationalSuggestion(
        {
          start_time: appointment.start_time,
          professional_id: appointment.professional_id,
          professional_name: appointment.professional?.full_name || 'Profissional',
          duration: totalDuration,
        },
        availResults,
        date
      );

      setAiSuggestion(suggestion);
    } catch (err) {
      console.error('Error fetching AI suggestion:', err);
    } finally {
      setAiLoading(false);
    }
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

          {aiLoading && (
            <div className="flex items-center justify-center py-4 gap-2 text-sm text-muted-foreground animate-pulse">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              IA está analisando a melhor opção...
            </div>
          )}

          {aiSuggestion && !aiLoading && (
            <Card className="border-primary/20 bg-primary/5 p-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-1">
                <Sparkles className="h-4 w-4 text-primary opacity-50" />
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary text-white hover:bg-primary/90 text-[10px] px-2 py-0 h-5">
                    SUGESTÃO IA
                  </Badge>
                  <span className="text-xs font-medium text-primary flex items-center gap-1">
                    Operacional MVP
                  </span>
                </div>
                
                <div className="space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    {aiSuggestion.professionalName}
                  </p>
                  <p className="text-sm text-muted-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    {aiSuggestion.slot} • {format(aiSuggestion.date, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground bg-white/50 p-2 rounded border border-primary/10 mt-2 italic">
                    "{aiSuggestion.reason}"
                  </p>
                </div>

                <Button 
                  size="sm" 
                  className="w-full gap-2 bg-primary hover:bg-primary/90 text-white shadow-sm"
                  onClick={() => onApplySuggestion?.(aiSuggestion)}
                >
                  <Check className="h-4 w-4" />
                  Confirmar Sugestão da IA
                </Button>
              </div>
            </Card>
          )}

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
