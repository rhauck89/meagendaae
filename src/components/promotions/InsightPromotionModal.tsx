import { useEffect, useMemo, useState } from 'react';
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
import { Tag, Wallet, Star, Check, ChevronRight, ChevronLeft, Loader2, Clock, MessageCircle, Users } from 'lucide-react';
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
  insightContext?: any;
}

const WEEK_DAYS = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];

export function InsightPromotionModal({
  isOpen,
  onClose,
  onSave,
  selectedSlots,
  services,
  professionals,
  insightContext
}: InsightPromotionModalProps) {
  const [step, setStep] = useState<'type' | 'config' | 'message'>('type');
  const [loading, setLoading] = useState(false);
  const [promoType, setPromoType] = useState<'discount' | 'double_cashback' | 'double_points'>('discount');
  const [title, setTitle] = useState('Agenda especial');
  const [description, setDescription] = useState('Condicao especial criada a partir dos insights da sua agenda.');
  const [discountType, setDiscountType] = useState<'fixed_price' | 'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('15');
  const [promotionPrice, setPromotionPrice] = useState('');
  const [messageTemplate, setMessageTemplate] = useState('');

  const isSlotFlow = selectedSlots.length > 0;
  const insight = insightContext?.insight;
  const selectedProfId = selectedSlots[0]?.professionalId || insightContext?.professionalId || insightContext?.professional_ids?.[0];

  const professionalName = useMemo(() => {
    const prof = professionals.find((p: any) => p.profile_id === selectedProfId);
    return prof?.profiles?.full_name || prof?.name || 'nossa equipe';
  }, [selectedProfId, professionals]);

  const getDefaults = () => {
    if (isSlotFlow) {
      return insightContext?.scope === 'today'
        ? {
            title: 'Preencher lacunas de hoje',
            description: 'Condicao especial para ocupar horarios disponiveis ainda hoje.'
          }
        : {
            title: 'Agenda especial da semana',
            description: 'Condicao especial para preencher horarios selecionados desta semana.'
          };
    }

    if (insight === 'birthdays') {
      return {
        title: 'Presente de aniversario',
        description: 'Condicao especial para os aniversariantes selecionados.'
      };
    }

    if (insight === 'reactivation') {
      return {
        title: 'Saudades de voce',
        description: 'Condicao especial para clientes que estao ha mais de 30 dias sem retorno.'
      };
    }

    if (insight === 'idle_day') {
      const day = WEEK_DAYS[insightContext?.validDays?.[0] ?? 0] || 'dia selecionado';
      return {
        title: `Especial de ${day}`,
        description: `Condicao estrategica para agendamentos de ${day}.`
      };
    }

    return {
      title: 'Acao inteligente',
      description: 'Condicao especial criada a partir dos insights da sua agenda.'
    };
  };

  useEffect(() => {
    if (!isOpen) return;
    const defaults = getDefaults();
    setStep('type');
    setPromoType('discount');
    setTitle(defaults.title);
    setDescription(defaults.description);
    setDiscountType('percentage');
    setDiscountValue('15');
    setPromotionPrice('');
    setMessageTemplate('');
  }, [isOpen, insightContext, selectedSlots.length]);

  const targetSummary = useMemo(() => {
    const clients = insightContext?.clients || [];
    if (isSlotFlow) return `${selectedSlots.length} horarios selecionados - Agenda de ${professionalName}`;
    if (insight === 'birthdays') return `${clients.length} aniversariante(s) selecionado(s)`;
    if (insight === 'reactivation') return `${clients.length} cliente(s) sem retorno selecionado(s)`;
    if (insight === 'idle_day') return `${WEEK_DAYS[insightContext?.validDays?.[0] ?? 0]} selecionado`;
    return 'Insight inteligente';
  }, [insightContext, insight, isSlotFlow, professionalName, selectedSlots.length]);

  const clientPreview = useMemo(() => {
    const clients = insightContext?.clients || [];
    return clients.slice(0, 6).map((c: any) => c.name || c.full_name || 'Cliente');
  }, [insightContext]);

  const generateMessage = () => {
    let benefitText = `com ${discountType === 'percentage' ? `${discountValue}% de desconto` : discountType === 'fixed_amount' ? `R$ ${discountValue} de desconto` : 'um preco especial'}`;
    if (promoType === 'double_cashback') benefitText = 'com CASHBACK EM DOBRO';
    if (promoType === 'double_points') benefitText = 'com PONTOS EM DOBRO';

    if (isSlotFlow) {
      const sortedSlots = [...selectedSlots].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.time.localeCompare(b.time);
      });

      const slotsByDay = new Map<string, string[]>();
      sortedSlots.forEach(slot => {
        const dayName = format(parseISO(slot.date), 'EEEE', { locale: ptBR });
        if (!slotsByDay.has(dayName)) slotsByDay.set(dayName, []);
        slotsByDay.get(dayName)!.push(slot.time.substring(0, 5));
      });

      const slotsText = Array.from(slotsByDay.entries())
        .map(([day, times]) => `- ${day}: ${times.join(', ')}`)
        .join('\n');

      setMessageTemplate(`Ola {{cliente_primeiro_nome}}! 👋\n\nTemos uma condicao especial ${benefitText} em horarios selecionados com ${professionalName} na {{empresa_nome}}.\n\nHorarios disponiveis:\n${slotsText}\n\nGaranta seu horario pelo link: {{link_promocao}}`);
      return;
    }

    const targetText =
      insight === 'birthdays'
        ? 'preparamos um presente especial de aniversario para voce'
        : insight === 'reactivation'
          ? 'sentimos sua falta e preparamos uma condicao especial para seu retorno'
          : insight === 'idle_day'
            ? 'abrimos uma condicao especial para este dia da semana'
            : 'preparamos uma condicao especial';

    setMessageTemplate(`Ola {{cliente_primeiro_nome}}! 👋\n\nNa {{empresa_nome}}, ${targetText} ${benefitText}.\n\nAcesse e escolha seu melhor horario: {{link_promocao}}`);
  };

  const handleNext = () => {
    if (step === 'type') {
      setStep('config');
      return;
    }

    if (step === 'config') {
      if (!title.trim()) {
        toast({ title: 'Preencha o titulo', variant: 'destructive' });
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
      const today = format(new Date(), 'yyyy-MM-dd');
      const nextWeek = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
      const monthEnd = format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), 'yyyy-MM-dd');
      const idleDayIndex = insightContext?.validDays?.[0];
      const idleDayDate = typeof idleDayIndex === 'number'
        ? format(new Date(Date.now() + (((idleDayIndex - new Date().getDay() + 7) % 7) || 7) * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
        : today;
      const validDays = insight === 'idle_day' && insightContext?.validDays?.length
        ? insightContext.validDays
        : [0, 1, 2, 3, 4, 5, 6];

      const payload = {
        title,
        description,
        discount_type: promoType === 'discount' ? discountType : 'percentage',
        discount_value: promoType === 'discount' ? (discountType !== 'fixed_price' ? parseFloat(discountValue) : null) : 0,
        promotion_price: promoType === 'discount' ? (discountType === 'fixed_price' ? parseFloat(promotionPrice) : null) : null,
        times: selectedSlots.map(slot => slot.time),
        date: selectedSlots[0]?.date || (insight === 'idle_day' ? idleDayDate : today),
        start_date: insight === 'idle_day' ? idleDayDate : today,
        end_date: insight === 'birthdays' ? monthEnd : insight === 'idle_day' ? idleDayDate : nextWeek,
        start_time: insightContext?.startTime || '09:00',
        end_time: insightContext?.endTime || '20:00',
        valid_days: validDays,
        selectedSlots,
        message_template: messageTemplate,
        promotion_type: 'traditional',
        service_ids: services.map((service: any) => service.id),
        professional_ids: isSlotFlow
          ? Array.from(new Set(selectedSlots.map(slot => slot.professionalId)))
          : (insightContext?.professional_ids || []),
        professional_filter: !isSlotFlow && insightContext?.professional_ids?.length ? 'selected' : 'all',
        promotion_mode: 'manual',
        source_insight: insight || (isSlotFlow ? 'week_gap' : 'insight'),
        client_filter: insight === 'birthdays' ? 'birthday_month' : insight === 'reactivation' ? 'inactive' : 'all',
        client_filter_value: insight === 'reactivation' ? 30 : null,
        target_client_ids: insightContext?.clients?.map((client: any) => client.id) || [],
        metadata: promoType !== 'discount' ? {
          incentive_config: {
            type: promoType,
            multiplier: 2
          }
        } : {}
      };

      console.log('[PROMOTION_INSIGHT_MODAL_DEBUG]', {
        action: 'save',
        insight,
        isSlotFlow,
        targetSummary,
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
            {step === 'type' ? 'Como deseja incentivar?' : step === 'config' ? 'Configurar condicao' : 'Divulgacao'}
          </DialogTitle>
          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight mt-1">
            {targetSummary}
          </p>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-y-auto p-6 pt-2">
          {step === 'type' && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Escolha o tipo de beneficio para este insight.
              </p>

              <div className="grid gap-3">
                {[
                  { key: 'discount', label: 'Desconto Direto', desc: 'Crie uma promocao manual com porcentagem, valor fixo ou preco final.', icon: Tag, tone: 'blue' },
                  { key: 'double_cashback', label: 'Cashback em Dobro', desc: 'Dobre o cashback padrao para quem agendar por esta acao.', icon: Wallet, tone: 'emerald' },
                  { key: 'double_points', label: 'Pontos em Dobro', desc: 'Dobre os pontos de fidelidade para quem agendar por esta acao.', icon: Star, tone: 'amber' }
                ].map((option: any) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => {
                      setPromoType(option.key);
                      const defaults = getDefaults();
                      setTitle(option.key === 'double_cashback' ? `${defaults.title} - cashback em dobro` : option.key === 'double_points' ? `${defaults.title} - pontos em dobro` : defaults.title);
                      setDescription(defaults.description);
                    }}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      promoType === option.key ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:bg-accent border-border'
                    )}
                  >
                    <div className={cn(
                      'h-10 w-10 rounded-full flex items-center justify-center',
                      option.tone === 'emerald' ? 'bg-emerald-100 text-emerald-600' : option.tone === 'amber' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                    )}>
                      <option.icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold">{option.label}</p>
                      <p className="text-xs text-muted-foreground text-pretty">{option.desc}</p>
                    </div>
                    {promoType === option.key && <Check className="h-5 w-5 text-primary" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 'config' && (
            <div className="space-y-4">
              <div className="bg-primary/5 border border-primary/10 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg mt-0.5">
                    {isSlotFlow ? <Clock className="h-4 w-4 text-primary" /> : <Users className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-bold text-primary uppercase tracking-wider">
                        {isSlotFlow ? 'Resumo da agenda' : 'Publico da acao'}
                      </p>
                      {isSlotFlow && (
                        <Badge variant="outline" className="h-5 text-[9px] border-primary/20 text-primary bg-primary/5">
                          {professionalName}
                        </Badge>
                      )}
                    </div>

                    {isSlotFlow ? (
                      <div className="space-y-1">
                        {Object.entries(groupedSlots).map(([date, times]) => (
                          <p key={date} className="text-[11px] text-muted-foreground">
                            <span className="font-semibold text-foreground">
                              {format(parseISO(date), 'EEEE, dd/MM', { locale: ptBR })}:
                            </span> {times.sort().map(time => time.substring(0, 5)).join(', ')}
                          </p>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-[11px] text-muted-foreground">{targetSummary}</p>
                        {clientPreview.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {clientPreview.map((name: string, idx: number) => (
                              <Badge key={`${name}-${idx}`} variant="secondary" className="text-[10px]">
                                {name}
                              </Badge>
                            ))}
                            {(insightContext?.clients?.length || 0) > clientPreview.length && (
                              <Badge variant="outline" className="text-[10px]">
                                +{insightContext.clients.length - clientPreview.length}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Nome da campanha</Label>
                <Input value={title} onChange={event => setTitle(event.target.value)} />
              </div>

              <div className="grid gap-2">
                <Label>Descricao curta</Label>
                <Textarea value={description} onChange={event => setDescription(event.target.value)} rows={2} />
              </div>

              {promoType === 'discount' ? (
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="space-y-2">
                    <Label>Tipo de desconto</Label>
                    <Select value={discountType} onValueChange={(value: any) => setDiscountType(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Porcentagem (%)</SelectItem>
                        <SelectItem value="fixed_amount">Valor fixo (R$)</SelectItem>
                        <SelectItem value="fixed_price">Preco final (R$)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>{discountType === 'percentage' ? 'Valor (%)' : 'Valor (R$)'}</Label>
                    {discountType === 'fixed_price' ? (
                      <Input type="number" value={promotionPrice} onChange={event => setPromotionPrice(event.target.value)} placeholder="0.00" />
                    ) : (
                      <Input type="number" value={discountValue} onChange={event => setDiscountValue(event.target.value)} />
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className={cn(
                      'p-2 rounded-lg',
                      promoType === 'double_cashback' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                    )}>
                      {promoType === 'double_cashback' ? <Wallet className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                    </div>
                    <p className="font-bold text-sm">
                      {promoType === 'double_cashback' ? 'Cashback em dobro' : 'Pontos em dobro'}
                    </p>
                    <Badge className="ml-auto bg-primary text-primary-foreground animate-pulse">
                      2x
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {promoType === 'double_cashback'
                      ? 'O cliente recebera 2x o cashback padrao configurado para o servico apos a conclusao do atendimento.'
                      : 'O cliente recebera 2x os pontos de fidelidade configurados para o servico apos a conclusao do atendimento.'}
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'message' && (
            <div className="space-y-4">
              <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-lg flex gap-3">
                <MessageCircle className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Mensagem pronta para divulgar esta acao mantendo o contexto do insight.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Template da mensagem</Label>
                <Textarea
                  value={messageTemplate}
                  onChange={event => setMessageTemplate(event.target.value)}
                  rows={8}
                  className="font-mono text-sm leading-relaxed"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px] bg-muted/50">{"{{cliente_primeiro_nome}}"}</Badge>
                <Badge variant="outline" className="text-[10px] bg-muted/50">{"{{empresa_nome}}"}</Badge>
                <Badge variant="outline" className="text-[10px] bg-muted/50">{"{{link_promocao}}"}</Badge>
              </div>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="p-6 pt-2 border-t flex items-center justify-between">
          <Button variant="ghost" onClick={step === 'type' ? onClose : handleBack} disabled={loading}>
            {step === 'type' ? 'Cancelar' : <><ChevronLeft className="h-4 w-4 mr-2" /> Voltar</>}
          </Button>

          <Button onClick={step === 'message' ? handleConfirm : handleNext} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : step === 'message' ? <><Check className="h-4 w-4" /> Criar promocao</> : <>Proximo <ChevronRight className="h-4 w-4" /></>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
