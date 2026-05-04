import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, Calendar, User, Scissors, Tag, Check, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface OpportunityPromotionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: any) => Promise<void>;
  slotData: {
    date: string;
    times: string[];
    professionalId: string;
    serviceIds?: string[];
  } | null;
  services: any[];
  professionals: any[];
}

export function OpportunityPromotionModal({
  isOpen,
  onClose,
  onSave,
  slotData,
  services,
  professionals
}: OpportunityPromotionModalProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [discountType, setDiscountType] = useState<'fixed_price' | 'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('10');
  const [promotionPrice, setPromotionPrice] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && slotData) {
      setTitle(slotData.times.length > 1 ? 'Promoção Combinada' : 'Promoção Relâmpago');
      setDescription(
        slotData.times.length > 1 
          ? `Desconto para ${slotData.times.length} horários selecionados` 
          : `Desconto especial para o horário de ${slotData.times[0]}`
      );
      
      if (slotData.serviceIds && slotData.serviceIds.length > 0) {
        if (slotData.serviceIds.includes('all')) {
          setSelectedServiceIds(services.map(s => s.id));
        } else {
          setSelectedServiceIds(slotData.serviceIds);
        }
      } else {
        setSelectedServiceIds([]);
      }
      
      setDiscountType('percentage');
      setDiscountValue('10');
      setPromotionPrice('');
    }
  }, [isOpen, slotData]);

  const handleSave = async () => {
    if (!slotData) return;
    if (!title) {
      toast({ title: 'Dê um nome para a promoção', variant: 'destructive' });
      return;
    }
    if (selectedServiceIds.length === 0) {
      toast({ title: 'Selecione pelo menos um serviço', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        description,
        discount_type: discountType,
        discount_value: discountType !== 'fixed_price' ? parseFloat(discountValue) : null,
        promotion_price: discountType === 'fixed_price' ? parseFloat(promotionPrice) : null,
        date: slotData.date,
        times: slotData.times,
        service_ids: selectedServiceIds,
        service_id: selectedServiceIds.length === 1 ? selectedServiceIds[0] : null,
        professional_filter: 'selected',
        professional_ids: [slotData.professionalId],
        promotion_mode: 'manual'
      };

      await onSave(payload);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!slotData) return null;

  const selectedProfessional = professionals.find(p => p.profile_id === slotData.professionalId);
  const formattedDate = format(parseISO(slotData.date), "dd/MM/yyyy (EEEE)", { locale: ptBR });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Criar promoção para horário vago
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="p-6 pt-2 overflow-y-auto space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg space-y-2 border">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Data:</span>
              <span className="font-semibold">{formattedDate}</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex flex-col">
                <span className="font-medium text-muted-foreground">Horários selecionados ({slotData.times.length}):</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {slotData.times.map(t => (
                    <Badge key={t} variant="outline" className="text-[10px] bg-background">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-muted-foreground">Profissional:</span>
              <span className="font-semibold">{selectedProfessional?.profiles?.full_name}</span>
            </div>
            {slotData.serviceIds && slotData.serviceIds.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Scissors className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium text-muted-foreground">
                  {slotData.serviceIds.includes('all') || slotData.serviceIds.length === services.length ? "Serviço:" : "Serviços:"}
                </span>
                <span className="font-semibold text-wrap">
                  {slotData.serviceIds.includes('all') || slotData.serviceIds.length === services.length 
                    ? "Todos os serviços" 
                    : slotData.serviceIds.length === 1 
                      ? services.find(s => s.id === slotData.serviceIds![0])?.name
                      : `${slotData.serviceIds.length} selecionados`}
                </span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <Label>Nome da promoção *</Label>
              <Input 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Ex: Flash Deal"
              />
            </div>

            <div>
              <Label>Descrição curta</Label>
              <Textarea 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="Mensagem para o cliente"
                rows={2}
              />
            </div>

            {(!slotData.serviceIds || slotData.serviceIds.length === 0) && (
              <div className="space-y-2">
                <Label>Serviços participantes *</Label>
                <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                  {services.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox 
                        checked={selectedServiceIds.includes(s.id)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedServiceIds(prev => [...prev, s.id]);
                          else setSelectedServiceIds(prev => prev.filter(id => id !== s.id));
                        }}
                      />
                      <span className="text-sm">{s.name} (R$ {Number(s.price).toFixed(2)})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de desconto</Label>
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
                  <Input 
                    type="number" 
                    value={promotionPrice} 
                    onChange={e => setPromotionPrice(e.target.value)}
                    placeholder="0.00"
                  />
                ) : (
                  <Input 
                    type="number" 
                    value={discountValue} 
                    onChange={e => setDiscountValue(e.target.value)}
                    placeholder="0"
                  />
                )}
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="p-6 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Criar Promoção
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
