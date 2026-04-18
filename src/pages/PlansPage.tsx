import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { usePaddleCheckout } from '@/hooks/usePaddleCheckout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Check, X, CreditCard, ArrowLeft, Crown, Star, CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Plan {
  id: string;
  slug: string | null;
  badge: string | null;
  name: string;
  monthly_price: number;
  yearly_price: number;
  yearly_discount: number;
  members_limit: number;
  marketplace_priority: number;
  paddle_monthly_price_id: string | null;
  paddle_yearly_price_id: string | null;
  automatic_messages: boolean;
  open_scheduling: boolean;
  promotions: boolean;
  discount_coupons: boolean;
  whitelabel: boolean;
  feature_requests: boolean;
  feature_financial_level: string;
  custom_branding: boolean;
  cashback: boolean;
  loyalty: boolean;
  open_agenda: boolean;
  automation: boolean;
  monthly_reports: boolean;
  advanced_reports: boolean;
  whatsapp_default: boolean;
  premium_templates: boolean;
  custom_domain: boolean;
  custom_colors: boolean;
  support_priority: boolean;
  multi_location_ready: boolean;
  active: boolean;
  sort_order: number;
}

const featureRows: Array<{ key: keyof Plan; label: string }> = [
  { key: 'open_scheduling', label: 'Agendamento aberto' },
  { key: 'open_agenda', label: 'Agenda Aberta' },
  { key: 'feature_requests', label: 'Solicitações' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'cashback', label: 'Cashback' },
  { key: 'loyalty', label: 'Fidelidade' },
  { key: 'automation', label: 'Automações' },
  { key: 'whatsapp_default', label: 'WhatsApp padrão' },
  { key: 'custom_domain', label: 'Domínio próprio' },
  { key: 'custom_colors', label: 'Cores personalizadas' },
  { key: 'support_priority', label: 'Suporte prioritário' },
  { key: 'whitelabel', label: 'Whitelabel' },
];

const financialLabels: Record<string, string> = {
  none: 'Sem acesso',
  basic: 'Relatório geral',
  full: 'Financeiro completo',
};

const formatBRL = (n: number) => `R$${Number(n || 0).toFixed(2).replace('.', ',')}`;
const formatDate = (iso: string | null) => iso ? format(new Date(iso), "dd/MM/yyyy", { locale: ptBR }) : null;

type ChangeIntent = {
  plan: Plan;
  cycle: 'monthly' | 'yearly';
  type: 'upgrade' | 'downgrade' | 'switch_cycle' | 'subscribe';
};

const PlansPage = () => {
  const { companyId } = useAuth();
  const currentPlan = useCompanyPlan();
  const navigate = useNavigate();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [intent, setIntent] = useState<ChangeIntent | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const fetchPlans = async () => {
      const { data } = await supabase
        .from('plans')
        .select('*')
        .eq('active', true)
        .order('sort_order', { ascending: true });
      if (data) setPlans(data as unknown as Plan[]);
      setLoading(false);
    };
    fetchPlans();
  }, []);

  useEffect(() => {
    if (currentPlan.billingCycle) setBillingCycle(currentPlan.billingCycle as 'monthly' | 'yearly');
  }, [currentPlan.billingCycle]);

  const currentPriority = useMemo(() => {
    return plans.find(p => p.id === currentPlan.planId)?.sort_order ?? -1;
  }, [plans, currentPlan.planId]);

  const hasActivePaidSub = currentPlan.subscriptionStatus === 'active' && !!currentPlan.planId && !currentPlan.trialActive;

  const determineIntent = (plan: Plan): ChangeIntent => {
    if (!hasActivePaidSub) return { plan, cycle: billingCycle, type: 'subscribe' };
    if (plan.id === currentPlan.planId) {
      return { plan, cycle: billingCycle, type: 'switch_cycle' };
    }
    const targetIdx = plan.sort_order;
    return {
      plan,
      cycle: billingCycle,
      type: targetIdx > currentPriority ? 'upgrade' : 'downgrade',
    };
  };

  const applyChange = async () => {
    if (!intent || !companyId) return;
    setBusy(true);

    try {
      // Downgrade: schedule for end of current period (no payment needed)
      if (intent.type === 'downgrade' && hasActivePaidSub && currentPlan.currentPeriodEnd) {
        const { error } = await supabase
          .from('companies')
          .update({
            pending_plan_id: intent.plan.id,
            pending_billing_cycle: intent.cycle,
            pending_change_at: currentPlan.currentPeriodEnd,
          } as any)
          .eq('id', companyId);
        if (error) throw error;
        toast.success(`Downgrade agendado para ${formatDate(currentPlan.currentPeriodEnd)}`);
        await currentPlan.refresh();
        setIntent(null);
        return;
      }

      // Switch cycle while active: open checkout for the new cycle (Paddle handles proration)
      // Upgrade or fresh subscribe: open Paddle checkout
      const externalPriceId = intent.cycle === 'yearly'
        ? intent.plan.paddle_yearly_price_id
        : intent.plan.paddle_monthly_price_id;

      if (!externalPriceId) {
        toast.error('Plano sem preço configurado no Paddle. Contate o suporte.');
        return;
      }

      await openCheckout({
        priceId: externalPriceId,
        successUrl: `${window.location.origin}/checkout/success`,
        customData: {
          intentType: intent.type,
          planId: intent.plan.id,
          cycle: intent.cycle,
        },
      });
      // Checkout overlay opens; close our confirm dialog
      setIntent(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Erro ao processar mudança de plano');
    } finally {
      setBusy(false);
    }
  };

  const planAccent = (plan: Plan) => {
    if (plan.slug === 'elite') return 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent';
    if (plan.slug === 'studio') return 'border-primary/50 bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-primary/20';
    return '';
  };

  const planIcon = (plan: Plan) => {
    if (plan.slug === 'elite') return <Crown className="h-5 w-5 text-amber-500" />;
    if (plan.slug === 'studio') return <Star className="h-5 w-5 text-primary" />;
    return <CreditCard className="h-5 w-5 text-muted-foreground" />;
  };

  if (loading || currentPlan.loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const working = busy || checkoutLoading;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/settings/plan')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" /> Escolha seu plano
            </h1>
            <p className="text-muted-foreground text-sm">Selecione o melhor plano para o seu negócio</p>
          </div>
        </div>

        {currentPlan.pendingPlanId && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm">
            <CalendarClock className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="flex-1">
              Você já tem uma mudança agendada para <strong>{currentPlan.pendingPlanName}</strong>
              {currentPlan.pendingChangeAt ? ` em ${formatDate(currentPlan.pendingChangeAt)}` : ''}.
              Selecionar outro plano substituirá essa mudança.
            </p>
          </div>
        )}

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-2">
          <div className="inline-flex rounded-lg border bg-muted/30 p-1">
            <button
              className={`px-4 py-1.5 text-sm rounded-md transition ${billingCycle === 'monthly' ? 'bg-background shadow font-medium' : 'text-muted-foreground'}`}
              onClick={() => setBillingCycle('monthly')}
            >Mensal</button>
            <button
              className={`px-4 py-1.5 text-sm rounded-md transition ${billingCycle === 'yearly' ? 'bg-background shadow font-medium' : 'text-muted-foreground'}`}
              onClick={() => setBillingCycle('yearly')}
            >
              Anual <Badge variant="outline" className="ml-1 text-[10px] text-success border-success/30">economize ~17%</Badge>
            </button>
          </div>
        </div>

        {/* Plans grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan.planId;
            const isPending = plan.id === currentPlan.pendingPlanId;
            const price = billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price;
            const finLabel = financialLabels[plan.feature_financial_level] || 'Sem acesso';
            const intentForPlan = determineIntent(plan);
            const sameCycle = isCurrent && billingCycle === currentPlan.billingCycle;
            const ctaLabel =
              sameCycle ? 'Plano atual'
              : isCurrent ? `Trocar para ${billingCycle === 'yearly' ? 'anual' : 'mensal'}`
              : intentForPlan.type === 'subscribe' ? 'Assinar'
              : intentForPlan.type === 'upgrade' ? 'Fazer upgrade'
              : 'Fazer downgrade';

            return (
              <Card key={plan.id} className={`relative flex flex-col ${planAccent(plan)} ${isCurrent ? 'ring-2 ring-primary' : ''}`}>
                {plan.badge && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow">
                    {plan.badge}
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <div className="flex items-center justify-center gap-2">
                    {planIcon(plan)}
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                  </div>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">{formatBRL(price)}</span>
                    <span className="text-muted-foreground">{billingCycle === 'yearly' ? '/ano' : '/mês'}</span>
                  </div>
                  {billingCycle === 'yearly' && Number(plan.yearly_discount) > 0 && (
                    <Badge variant="outline" className="text-success border-success/20 mt-1">
                      {plan.yearly_discount}% de desconto
                    </Badge>
                  )}
                  {isPending && !isCurrent && (
                    <Badge variant="outline" className="mt-2 text-primary border-primary/30">
                      Mudança agendada
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3 flex-1">
                  <div className="text-sm text-center text-muted-foreground">
                    {plan.members_limit === 0 ? 'Membros ilimitados' : `Até ${plan.members_limit} membro${plan.members_limit !== 1 ? 's' : ''}`}
                  </div>
                  <div className="space-y-1.5 pt-3 border-t">
                    {featureRows.map(({ key, label }) => {
                      const enabled = Boolean(plan[key]);
                      return (
                        <div key={String(key)} className="flex items-center gap-2 text-sm">
                          {enabled
                            ? <Check className="h-4 w-4 text-success shrink-0" />
                            : <X className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
                          <span className={enabled ? '' : 'text-muted-foreground/50'}>{label}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2 text-sm">
                      {plan.feature_financial_level !== 'none'
                        ? <Check className="h-4 w-4 text-success shrink-0" />
                        : <X className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
                      <span className={plan.feature_financial_level !== 'none' ? '' : 'text-muted-foreground/50'}>{finLabel}</span>
                    </div>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={sameCycle ? 'outline' : 'default'}
                    disabled={sameCycle || working}
                    onClick={() => setIntent(intentForPlan)}
                  >
                    {ctaLabel}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!intent} onOpenChange={(o) => !o && !working && setIntent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {intent?.type === 'downgrade' ? 'Agendar downgrade?'
                : intent?.type === 'upgrade' ? 'Fazer upgrade agora?'
                : intent?.type === 'switch_cycle' ? 'Trocar ciclo de cobrança?'
                : 'Assinar plano?'}
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                {intent && (
                  <p>
                    Plano <strong>{intent.plan.name}</strong> · {intent.cycle === 'yearly' ? 'Anual' : 'Mensal'} ·
                    {' '}{formatBRL(intent.cycle === 'yearly' ? intent.plan.yearly_price : intent.plan.monthly_price)}
                    {intent.cycle === 'yearly' ? '/ano' : '/mês'}
                  </p>
                )}
                {intent?.type === 'upgrade' && (
                  <p className="text-xs">Você será direcionado ao checkout. A liberação é imediata após o pagamento.</p>
                )}
                {intent?.type === 'downgrade' && currentPlan.currentPeriodEnd && (
                  <p className="text-xs">Mudança aplicada automaticamente em {formatDate(currentPlan.currentPeriodEnd)} (fim do ciclo atual). Sem cobrança extra.</p>
                )}
                {intent?.type === 'switch_cycle' && (
                  <p className="text-xs">Você será direcionado ao checkout para confirmar o novo ciclo. O Paddle aplica o ajuste proporcional.</p>
                )}
                {intent?.type === 'subscribe' && (
                  <p className="text-xs">Você será direcionado ao checkout seguro do Paddle.</p>
                )}
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIntent(null)} disabled={working}>Voltar</Button>
            <Button onClick={applyChange} disabled={working}>
              {working && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {intent?.type === 'downgrade' ? 'Agendar' : 'Continuar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default PlansPage;
