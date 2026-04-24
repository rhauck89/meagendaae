import { Sparkles, Gift } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import type { SmartRewardSuggestion } from '@/lib/smart-rewards';

interface Props {
  suggestion: SmartRewardSuggestion | null;
  pointValue?: number;
  compact?: boolean;
}

/**
 * Exibe a "próxima recompensa ideal" sugerida pelo motor inteligente.
 * Usado no Portal do Cliente e no painel admin de Fidelidade.
 */
export const SmartRewardCard = ({ suggestion, pointValue = 0, compact = false }: Props) => {
  if (!suggestion) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-4 text-center text-sm text-muted-foreground">
          <Gift className="h-6 w-6 mx-auto mb-2 opacity-40" />
          Nenhuma recompensa disponível no momento.
        </CardContent>
      </Card>
    );
  }

  const { reward, progressPct, reason, isAffordable } = suggestion;
  const realValueLabel = reward.real_value
    ? `R$ ${Number(reward.real_value).toFixed(2).replace('.', ',')}`
    : null;

  return (
    <Card className={isAffordable ? 'border-primary/40 bg-primary/5' : ''}>
      <CardContent className={compact ? 'p-3' : 'p-4'}>
        <div className="flex items-start gap-3">
          <div className="shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-xs font-semibold text-primary uppercase tracking-wide">
                Próxima recompensa
              </p>
              {isAffordable && (
                <Badge className="bg-success/20 text-success border-success/30 text-xs">
                  Disponível agora!
                </Badge>
              )}
            </div>
            <p className="font-semibold truncate">{reward.name}</p>
            {realValueLabel && (
              <p className="text-xs text-muted-foreground">Valor: {realValueLabel}</p>
            )}
            <div className="mt-2 space-y-1">
              <Progress value={progressPct} className="h-2" />
              <p className="text-xs text-muted-foreground">{reason}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SmartRewardCard;
