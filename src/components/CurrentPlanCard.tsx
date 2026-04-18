import { useState } from 'react';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  CreditCard, Clock, AlertTriangle, Check, ArrowUpRight, ArrowDownRight,
  XCircle, CalendarClock, ExternalLink, Loader2, AlertOctagon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getPaddleEnvironment } from '@/lib/paddle';

const featureLabels: Array<{ key: string; label: string }> = [
  { key: 'open_scheduling', label: 'Agendamento aberto' },
  { key: 'open_agenda', label: 'Agenda Aberta' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'loyalty', label: 'Fidelidade' },
  { key: 'automation', label: 'Automações' },
  { key: 'automatic_messages', label: 'Mensagens automáticas' },
  { key: 'whatsapp_default', label: 'WhatsApp padrão' },
  { key: 'custom_domain', label: 'Domínio próprio' },
  { key: 'custom_colors', label: 'Cores personalizadas' },
  { key: 'support_priority', label: 'Suporte prioritário' },
  { key: 'whitelabel', label: 'Whitelabel' },
];

const formatBRL = (n: number) => `R$${Number(n || 0).toFixed(2).replace('.', ',')}`;
const formatDate = (iso: string | null) => iso ? format(new Date(iso), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : '—';

const statusConfig = (plan: ReturnType<typeof useCompanyPlan>) => {
  const onTrial = plan.trialActive && !plan.trialExpired;
  const s = plan.subscriptionStatus;
  if (onTrial) return { label: 'Em teste grátis', cls: 'bg-warning/10 text-warning border-warning/30' };
  if (s === 'active') return { label: 'Ativo', cls: 'bg-success/10 text-success border-success/30' };
  if (s === 'past_due') return { label: 'Pagamento em atraso', cls: 'bg-warning/10 text-warning border-warning/30' };
  if (s === 'unpaid') return { label: 'Pagamento pendente', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
  if (s === 'expired_trial' || plan.trialExpired) return { label: 'Trial expirado', cls: 'bg-destructive/10 text-destructive border-destructive/30' };
  if (s === 'canceled' || s === 'cancelled') return { label: 'Cancelado', cls: 'bg-muted text-muted-foreground' };
  if (s === 'trialing') return { label: 'Em teste', cls: 'bg-warning/10 text-warning border-warning/30' };
  return { label: s || 'Sem plano', cls: 'bg-muted text-muted-foreground' };
};

const CurrentPlanCard = () => {
  const plan = useCompanyPlan();
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<null | 'portal' | 'cancel' | 'cancelPending'>(null);
  const [confirmDialog, setConfirmDialog] = useState<null | 'cancelPending' | 'cancelSubscription'>(null);

  if (plan.loading) {
    return (
      <Card><CardContent className="p-8 text-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
      </CardContent></Card>
    );
  }

  const onTrial = plan.trialActive && !plan.trialExpired;
  const isActive = plan.subscriptionStatus === 'active';
  const isPastDue = plan.subscriptionStatus === 'past_due';
  const hasPaddleSub = isActive || isPastDue || plan.subscriptionStatus === 'canceled';
  const env = getPaddleEnvironment();

  const cancelPendingChange = async () => {
    if (!companyId) return;
    setBusy('cancelPending');
    const { error } = await supabase
      .from('companies')
      .update({ pending_plan_id: null, pending_billing_cycle: null, pending_change_at: null } as any)
      .eq('id', companyId);
    setBusy(null);
    setConfirmDialog(null);
    if (error) toast.error('Erro ao cancelar mudança');
    else { toast.success('Mudança agendada cancelada'); plan.refresh(); }
  };

  const openCustomerPortal = async () => {
    if (!companyId) return;
    setBusy('portal');
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal', {
        body: { companyId, environment: env === 'live' ? 'live' : 'sandbox' },
      });
      if (error) throw error;
      const url = data?.url;
      if (!url) throw new Error('Portal indisponível');
      window.open(url, '_blank', 'noopener');
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Não foi possível abrir o portal de cobrança');
    } finally {
      setBusy(null);
    }
  };

  const cancelSubscription = async () => {
    if (!companyId) return;
    setBusy('cancel');
    try {
      const { error } = await supabase.functions.invoke('cancel-subscription', {
        body: { companyId, environment: env === 'live' ? 'live' : 'sandbox' },
      });
      if (error) throw error;
      toast.success('Assinatura cancelada. Acesso mantido até o fim do período.');
      await plan.refresh();
      setConfirmDialog(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao cancelar assinatura');
    } finally {
      setBusy(null);
    }
  };

  const status = statusConfig(plan);
  const currentPrice = plan.billingCycle === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5" /> Meu plano
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Header: plan name + status */}
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-2xl font-display font-bold">{plan.planName || 'Sem plano'}</p>
                {plan.planBadge && (
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-[10px]">
                    {plan.planBadge}
                  </Badge>
                )}
              </div>
              {(isActive || onTrial) && plan.planName && (
                <p className="text-sm text-muted-foreground mt-0.5">
                  {formatBRL(currentPrice)}{plan.billingCycle === 'yearly' ? '/ano' : '/mês'} ·
                  {' '}Cobrança {plan.billingCycle === 'yearly' ? 'anual' : 'mensal'}
                </p>
              )}
            </div>
            <Badge variant="outline" className={status.cls}>{status.label}</Badge>
          </div>

          {/* Trial banner */}
          {onTrial && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
              <Clock className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-warning">
                  Teste grátis ativo {plan.trialPlanName ? `(${plan.trialPlanName})` : ''}
                </p>
                <p className="text-muted-foreground">
                  {plan.trialDaysLeft > 0
                    ? `Restam ${plan.trialDaysLeft} dia${plan.trialDaysLeft !== 1 ? 's' : ''} · Termina em ${formatDate(plan.trialEndDate)}`
                    : 'Encerra hoje'}
                </p>
              </div>
            </div>
          )}

          {plan.trialExpired && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-destructive">Seu teste grátis terminou</p>
                <p className="text-muted-foreground">Escolha um plano para continuar usando todos os recursos.</p>
              </div>
            </div>
          )}

          {isPastDue && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
              <AlertOctagon className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-warning">Pagamento em atraso</p>
                <p className="text-muted-foreground">Atualize sua forma de pagamento no portal para evitar perda de acesso.</p>
              </div>
            </div>
          )}

          {/* Billing info */}
          {(isActive || isPastDue) && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Próxima cobrança</p>
                <p className="font-medium mt-0.5">{formatDate(plan.currentPeriodEnd)}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Ciclo</p>
                <p className="font-medium mt-0.5">{plan.billingCycle === 'yearly' ? 'Anual' : 'Mensal'}</p>
              </div>
            </div>
          )}

          {/* Pending change */}
          {plan.pendingPlanId && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-sm flex-1">
                <p className="font-medium text-primary">Mudança agendada</p>
                <p className="text-muted-foreground">
                  Vai migrar para <strong>{plan.pendingPlanName}</strong>
                  {plan.pendingBillingCycle ? ` (${plan.pendingBillingCycle === 'yearly' ? 'anual' : 'mensal'})` : ''}
                  {plan.pendingChangeAt ? ` em ${formatDate(plan.pendingChangeAt)}` : ''}.
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDialog('cancelPending')} disabled={!!busy}>
                Cancelar
              </Button>
            </div>
          )}

          {/* Features */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase">Recursos do plano</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {featureLabels.map(({ key, label }) => {
                const enabled = plan.isFeatureEnabled(key as any);
                return (
                  <div key={key} className="flex items-center gap-1.5 text-sm">
                    <Check className={`h-3.5 w-3.5 shrink-0 ${enabled ? 'text-success' : 'text-muted-foreground/30'}`} />
                    <span className={enabled ? '' : 'text-muted-foreground/50'}>{label}</span>
                  </div>
                );
              })}
              <div className="flex items-center gap-1.5 text-sm col-span-2 pt-1">
                <Check className="h-3.5 w-3.5 text-success shrink-0" />
                <span>
                  {plan.features.members_limit === 0
                    ? 'Membros ilimitados'
                    : `Até ${plan.features.members_limit} membro${plan.features.members_limit !== 1 ? 's' : ''}`}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t">
            <Button onClick={() => navigate('/settings/plans')}>
              <ArrowUpRight className="h-4 w-4 mr-1" /> {hasPaddleSub ? 'Mudar de plano' : 'Escolher plano'}
            </Button>
            {!hasPaddleSub && (
              <Button variant="outline" onClick={() => navigate('/settings/plans')}>
                <ArrowDownRight className="h-4 w-4 mr-1" /> Comparar planos
              </Button>
            )}
            {hasPaddleSub && (
              <Button variant="outline" onClick={openCustomerPortal} disabled={!!busy}>
                {busy === 'portal'
                  ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  : <ExternalLink className="h-4 w-4 mr-1" />}
                Gerenciar assinatura
              </Button>
            )}
            {isActive && !plan.cancelAtPeriodEnd && (
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive sm:col-span-2"
                onClick={() => setConfirmDialog('cancelSubscription')}
                disabled={!!busy}
              >
                <XCircle className="h-4 w-4 mr-1" /> Cancelar assinatura
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Confirm dialogs */}
      <Dialog open={confirmDialog === 'cancelPending'} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar mudança agendada?</DialogTitle>
            <DialogDescription>
              A mudança para <strong>{plan.pendingPlanName}</strong> será removida e seu plano atual continuará válido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Voltar</Button>
            <Button variant="destructive" onClick={cancelPendingChange} disabled={!!busy}>
              {busy === 'cancelPending' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Cancelar mudança
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog === 'cancelSubscription'} onOpenChange={(o) => !o && setConfirmDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Cancelar assinatura?</DialogTitle>
            <DialogDescription>
              Você manterá acesso aos recursos pagos até <strong>{formatDate(plan.currentPeriodEnd)}</strong> (fim do período já pago).
              Após essa data, sua conta entrará em modo somente-leitura. Você pode reativar a qualquer momento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>Voltar</Button>
            <Button variant="destructive" onClick={cancelSubscription} disabled={!!busy}>
              {busy === 'cancel' && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Cancelar assinatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CurrentPlanCard;
