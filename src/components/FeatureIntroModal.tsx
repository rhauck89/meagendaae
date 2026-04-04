import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PartyPopper, Megaphone, DollarSign } from 'lucide-react';
import type { FeatureKey } from '@/hooks/useFeatureDiscovery';

interface FeatureIntroModalProps {
  featureKey: FeatureKey;
  open: boolean;
  onClose: () => void;
  onAction?: () => void;
}

const featureConfig: Record<FeatureKey, { icon: any; title: string; description: string; actionLabel: string }> = {
  agenda_aberta: {
    icon: PartyPopper,
    title: 'Agenda Aberta',
    description: 'Crie eventos especiais com vagas limitadas, como Natal ou Black Friday. Seus clientes podem agendar diretamente pelo link do evento.',
    actionLabel: 'Criar evento',
  },
  promotions: {
    icon: Megaphone,
    title: 'Promoções',
    description: 'Crie promoções e ofertas especiais para atrair novos clientes e fidelizar os que já conhecem seu trabalho.',
    actionLabel: 'Criar promoção',
  },
  finance: {
    icon: DollarSign,
    title: 'Financeiro',
    description: 'Acompanhe receitas, despesas e comissões do seu negócio em um só lugar. Tenha controle total da saúde financeira.',
    actionLabel: 'Ver financeiro',
  },
};

export const FeatureIntroModal = ({ featureKey, open, onClose, onAction }: FeatureIntroModalProps) => {
  const config = featureConfig[featureKey];
  const Icon = config.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader className="items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Icon className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">{config.title}</DialogTitle>
          <DialogDescription className="text-base mt-2">
            {config.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            Entendi
          </Button>
          {onAction && (
            <Button className="flex-1" onClick={() => { onAction(); onClose(); }}>
              {config.actionLabel}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
