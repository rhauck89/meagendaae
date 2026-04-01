import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditCard, Clock, AlertTriangle, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const featureLabels: Record<string, string> = {
  automatic_messages: 'Mensagens Automáticas',
  open_scheduling: 'Agendamento Aberto',
  promotions: 'Promoções',
  discount_coupons: 'Cupons de Desconto',
  whitelabel: 'Whitelabel',
};

const CurrentPlanCard = () => {
  const plan = useCompanyPlan();
  const navigate = useNavigate();

  if (plan.loading) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CreditCard className="h-5 w-5" /> Plano Atual
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl font-bold">{plan.planName || 'Sem plano'}</p>
            {plan.subscriptionStatus === 'active' && (
              <p className="text-sm text-muted-foreground">
                Cobrança: {plan.billingCycle === 'yearly' ? 'Anual' : 'Mensal'} —{' '}
                R${(plan.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice).toFixed(2).replace('.', ',')}
                {plan.billingCycle === 'yearly' ? '/ano' : '/mês'}
              </p>
            )}
          </div>
          <Badge variant="outline" className={
            plan.trialActive && !plan.trialExpired
              ? 'bg-warning/10 text-warning border-warning/20'
              : plan.subscriptionStatus === 'active'
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }>
            {plan.trialActive && !plan.trialExpired
              ? 'Trial'
              : plan.subscriptionStatus === 'active'
              ? 'Ativo'
              : plan.trialExpired
              ? 'Trial Expirado'
              : plan.subscriptionStatus}
          </Badge>
        </div>

        {plan.trialActive && !plan.trialExpired && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-warning">Trial ativo</p>
              <p className="text-muted-foreground">Expira em {plan.trialDaysLeft} dia{plan.trialDaysLeft !== 1 ? 's' : ''}</p>
            </div>
          </div>
        )}

        {plan.trialExpired && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-destructive">Trial expirado</p>
              <p className="text-muted-foreground">Escolha um plano para continuar usando todos os recursos.</p>
            </div>
          </div>
        )}

        {/* Plan features */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">Recursos do plano</p>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(featureLabels).map(([key, label]) => {
              const enabled = plan.isFeatureEnabled(key as any);
              return (
                <div key={key} className="flex items-center gap-2 text-sm">
                  <Check className={`h-3.5 w-3.5 ${enabled ? 'text-success' : 'text-muted-foreground/30'}`} />
                  <span className={enabled ? '' : 'text-muted-foreground/50'}>{label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-2 text-sm">
              <Check className="h-3.5 w-3.5 text-success" />
              <span>Até {plan.features.members_limit} membro{plan.features.members_limit !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={() => navigate('/settings/plans')}>
          Alterar plano
        </Button>
      </CardContent>
    </Card>
  );
};

export default CurrentPlanCard;
