import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogBody
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag, Wallet, Star, Check, ChevronRight, ChevronLeft, Loader2, Scissors, Calendar, Clock, MessageCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface InsightPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  selectedSlots: { date: string; time: string; professionalId: string }[];
  services: any[];
  professionals: any[];
}

export function InsightPromotionModal({
  isOpen,
  onClose,
  onSave,
  selectedSlots,
  services,
  professionals
}: InsightPromotionModalProps) {
  const [step, setStep] = useState<'type' | 'config' | 'message'>('type');
  const [loading, setLoading] = useState(false);
  
  const [promoType, setPromoType] = useState<'traditional' | 'cashback' | 'points'>('traditional');
  const [title, setTitle] = useState('Agenda Especial da Semana');
  const [description, setDescription] = useState('Aproveite nossos horários disponíveis nesta semana com uma condição especial!');
  const [discountType, setDiscountType] = useState<'fixed_price' | 'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [promotionPrice, setPromotionPrice] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');

  // Auto-generate message template when switching to message step
  const generateMessage = () => {
    const sortedSlots = [...selectedSlots].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.time.localeCompare(b.time);
    });

    const dayNames: Record<string, string> = {
      'Monday': 'segunda', 'Tuesday': 'terça', 'Wednesday': 'quarta', 
      'Thursday': 'quinta', 'Friday': 'sexta', 'Saturday': 'sábado', 'Sunday': 'domingo'
    };

    const slotsByDay = new Map<string, string[]>();
    sortedSlots.forEach(s => {
      const dayName = dayNames[format(parseISO(s.date), 'EEEE', { locale: ptBR })] || format(parseISO(s.date), 'EEEE', { locale: ptBR });
      if (!slotsByDay.has(dayName)) slotsByDay.set(dayName, []);
      slotsByDay.get(dayName)!.push(s.time.substring(0, 5));
    });

    const slotsText = Array.from(slotsByDay.entries())
      .map(([day, times]) => `${day} ${times.join(', ')}`)
      .join('; ');

    const template = `Olá {{cliente_primeiro_nome}}! 👋\n\nTemos uma condição especial em horários selecionados desta semana na {{empresa_nome}}. 🎉\n\nHorários disponíveis: ${slotsText}.\n\nGaranta seu horário pelo link: {{link_promocao}}`;
    setMessageTemplate(template);
  };

  const handleNext = () => {
    if (step === 'type') {
      if (promoType !== 'traditional') {
        toast({ title: "Funcionalidade em breve", description: "O suporte real para este tipo de promoção será lançado em breve." });
        return;
      }
      setStep('config');
    } else if (step === 'config') {
      if (!title.trim()) {
        toast({ title: "Preencha o título", variant: "destructive" });
        return;
      }
      generateMessage();
      setStep('message');
    }
  };

  const handleBack = () => {
    if (step === 'config') setStep('type');
    else if (step === 'message') setStep('config');
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const payload = {
        title,
        description,
        discount_type: discountType,
        discount_value: discountType !== 'fixed_price' ? parseFloat(discountValue) : null,
        promotion_price: discountType === 'fixed_price' ? parseFloat(promotionPrice) : null,
        times: selectedSlots.map(s => s.time),
        // We use the first slot date as a reference, but handleOpportunitySave will handle individual creations
        date: selectedSlots[0].date,
        selectedSlots,
        message_template: messageTemplate,
        promotion_type: promoType,
        service_ids: services.map(s => s.id), // Default to all services for this assistant
        professional_ids: Array.from(new Set(selectedSlots.map(s => s.professionalId))),
        promotion_mode: 'manual'
      };

      console.log('[PROMOTION_WEEK_GAPS_DEBUG]', {
        action: 'insight_modal_save',
        payload
      });

      await onSave(payload);
      onClose();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const groupedSlots = selectedSlots.reduce((acc, slot) => {
    if (!acc[slot.date]) acc[slot.date] = [];
    acc[slot.date].push(slot.time);
    return acc;
  }, {} as Record<string, string[]>);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            {step === 'type' ? 'Como deseja incentivar?' : 
             step === 'config' ? 'Configurar Condição' : 'Divulgação'}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {selectedSlots.length} horários selecionados em {Object.keys(groupedSlots).length} dias.
          </p>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto p-6 pt-2">
          {step === 'type' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha o tipo de benefício para quem agendar nestes horários.
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
                    <p className="text-xs text-muted-foreground text-pretty">Reduza o preço original para preencher a vaga rápido.</p>
                  </div>
                  {promoType === 'traditional' && <Check className="h-5 w-5 text-primary" />}
                </button>

                <button
                  onClick={() => setPromoType('cashback')}
                  className={cn(
                    "flex items-center gap-4 p-4 rounded-xl border text-left transition-all opacity-80 cursor-default",
                    promoType === 'cashback' ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                  )}
                >
                  <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                    <Wallet className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">Cashback em Dobro</p>
                      <Badge variant="secondary" className="text-[9px] uppercase h-4">Em Breve</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-pretty">Gere crédito para a próxima visita do cliente.</p>
                  </div>
                </button>

                <button
                  disabled
                  className="flex items-center gap-4 p-4 rounded-xl border text-left opacity-50 cursor-not-allowed bg-muted/30"
                >
                  <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">Pontos em Dobro</p>
                      <Badge variant="secondary" className="text-[9px] uppercase h-4">Em Breve</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground text-pretty">Incentive o programa de fidelidade da sua empresa.</p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4 mb-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg mt-0.5">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-primary uppercase tracking-wider">Resumo da Agenda</p>
                    <div className="space-y-1">
                      {Object.entries(groupedSlots).map(([date, times]) => (
                        <p key={date} className="text-[11px] text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {format(parseISO(date), "EEEE, dd/MM", { locale: ptBR })}:
                          </span> {times.sort().map(t => t.substring(0, 5)).join(', ')}
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label>Nome da Campanha</Label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Flash Week" />
                </div>
                
                <div className="grid gap-2">
                  <Label>Descrição Curta</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Tipo de Desconto</Label>
                    <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed_amount">Valor fixo (R$)</SelectItem>
                        <SelectItem value="fixed_price">Preço final (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      {discountType === 'percentage' ? 'Valor (%)' : 'Valor (R$)'}
                    </Label>
                    {discountType === 'fixed_price' ? (
                      <Input type="number" value={promotionPrice} onChange={e => setPromotionPrice(e.target.value)} placeholder="0.00" />
                    ) : (
                      <Input type="number" value={discountValue} onChange={e => setDiscountValue(e.target.value)} />
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === 'message' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-3">
                <MessageCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Geramos uma mensagem personalizada incluindo os horários reais que você selecionou. Você poderá editá-la antes de enviar individualmente aos clientes.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Template da Mensagem</Label>
                <Textarea 
                  value={messageTemplate} 
                  onChange={e => setMessageTemplate(e.target.value)} 
                  rows={8} 
                  className="font-mono text-sm leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-muted/50 cursor-help" title="Nome do cliente">{"{{cliente_primeiro_nome}}"}</Badge>
                <Badge variant="outline" className="text-[10px] bg-muted/50 cursor-help" title="Nome da sua empresa">{"{{empresa_nome}}"}</Badge>
                <Badge variant="outline" className="text-[10px] bg-muted/50 cursor-help" title="Link para agendamento">{"{{link_promocao}}"}</Badge>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="p-6 pt-2 border-t flex items-center justify-between">
          <Button variant="ghost" onClick={step === 'type' ? onClose : handleBack} disabled={loading}>
            {step === 'type' ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-2" /> Voltar</>}
          </Button>
          
          <Button onClick={step === 'message' ? handleConfirm : handleNext} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 'message' ? <><Check className="h-4 w-4" /> Criar Campanha</> : <>Próximo <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
