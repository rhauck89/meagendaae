import { useEffect, useState } from 'react';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { AlertTriangle, Clock, Sparkles, Check, Crown, MessageCircle, Loader2, Zap, CalendarDays, Users, TrendingUp, ShieldCheck, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePaddleCheckout } from '@/hooks/usePaddleCheckout';
import { openWhatsApp } from '@/lib/whatsapp';
import { useTrialUsageStats } from '@/hooks/useTrialUsageStats';

interface StudioPlan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  yearly_discount: number;
  paddle_monthly_price_id: string | null;
  paddle_yearly_price_id: string | null;
}

// Configurable: support WhatsApp (international format, digits only)
const SUPPORT_WHATSAPP = '5511999999999';
// Social proof — total active professionals/companies on the platform
const SOCIAL_PROOF_COUNT = 500;

const STUDIO_BENEFITS = [
  'Agenda inteligente ilimitada',
  'Lembretes automáticos no WhatsApp',
  'Programa de fidelidade e cashback',
  'Múltiplos profissionais',
  'Relatórios financeiros completos',
  'Domínio personalizado',
  'Suporte prioritário',
];

const formatBRL = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

const TrialBanner = () => {
  const { trialActive, trialExpired, trialDaysLeft, loading } = useCompanyPlan();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const usage = useTrialUsageStats();
  const [studio, setStudio] = useState<StudioPlan | null>(null);
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('yearly');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!trialExpired) return;
    (async () => {
      const { data } = await supabase
        .from('plans')
        .select('id,name,monthly_price,yearly_price,yearly_discount,paddle_monthly_price_id,paddle_yearly_price_id')
        .eq('slug', 'studio')
        .eq('active', true)
        .maybeSingle();
      if (data) setStudio(data as StudioPlan);
    })();
  }, [trialExpired]);

  const handleSubscribe = async () => {
    if (!studio) {
      navigate('/settings/plans');
      return;
    }
    const priceId = cycle === 'yearly' ? studio.paddle_yearly_price_id : studio.paddle_monthly_price_id;
    if (!priceId) {
      navigate('/settings/plans');
      return;
    }
    setSubmitting(true);
    try {
      await openCheckout({
        priceId,
        customData: {
          planId: studio.id,
          billingCycle: cycle,
        },
        successUrl: `${window.location.origin}/checkout/success`,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSupport = () => {
    openWhatsApp(SUPPORT_WHATSAPP, {
      source: 'trial-banner',
      message: 'Olá! Meu período de teste expirou e gostaria de ajuda para escolher o melhor plano.',
    });
  };

  const handleSupportBeforeSubscribe = () => {
    openWhatsApp(SUPPORT_WHATSAPP, {
      source: 'trial-banner',
      message: 'Olá! Antes de assinar o Agendaê, gostaria de tirar algumas dúvidas. Pode me ajudar?',
    });
  };

  if (loading) return null;

  if (trialExpired) {
    const monthly = studio?.monthly_price ?? 69.9;
    const yearly = studio?.yearly_price ?? 699;
    const yearlyMonthEquivalent = yearly / 12;
    const savings = Math.round(((monthly * 12 - yearly) / (monthly * 12)) * 100);
    const displayPrice = cycle === 'yearly' ? yearlyMonthEquivalent : monthly;
    const isLoading = checkoutLoading || submitting;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-background via-primary/5 to-primary/10 shadow-xl">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />

        <div className="relative p-6 sm:p-8">
          {/* Urgency tag */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge variant="destructive" className="gap-1.5 px-3 py-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Teste expirado
            </Badge>
            <Badge variant="outline" className="gap-1.5 border-primary/40 text-primary">
              <Zap className="h-3.5 w-3.5" />
              Reative em 1 minuto
            </Badge>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            {/* Left: pitch */}
            <div>
              {!usage.loading && usage.daysUsed > 0 && (
                <p className="mb-2 text-xs sm:text-sm font-medium text-primary/90 flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Você usou o Agendaê por <span className="font-bold">{usage.daysUsed} dia{usage.daysUsed !== 1 ? 's' : ''}</span>
                </p>
              )}

              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Não perca tudo que você construiu.{' '}
                <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Continue crescendo com o Studio.
                </span>
              </h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                Seu acesso está em modo somente leitura. Assine agora e mantenha sua agenda, clientes e
                automações funcionando sem interrupção.
              </p>

              {!usage.loading && (usage.appointmentsCount > 0 || usage.clientsCount > 0 || usage.totalRevenue > 0) && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-card/60 backdrop-blur p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Resultados que você já gerou
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary">
                        <CalendarDays className="h-4 w-4" />
                        <span className="text-xl sm:text-2xl font-bold">{usage.appointmentsCount}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Agendamentos</p>
                    </div>
                    <div className="text-center border-x border-border/50">
                      <div className="flex items-center justify-center gap-1 text-primary">
                        <Users className="h-4 w-4" />
                        <span className="text-xl sm:text-2xl font-bold">{usage.clientsCount}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Clientes</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-primary">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-sm sm:text-base font-bold">{formatBRL(usage.totalRevenue)}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Faturamento</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                <Lock className="h-4 w-4 shrink-0 text-destructive mt-0.5" />
                <p className="text-xs sm:text-sm text-foreground/90">
                  <span className="font-semibold text-destructive">Seu acesso está limitado</span> até a ativação do plano. Novos agendamentos, edições e automações estão pausados.
                </p>
              </div>

              <ul className="mt-5 grid gap-2 sm:grid-cols-2">
                {STUDIO_BENEFITS.map((b) => (
                  <li key={b} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <span className="text-foreground/90">{b}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="flex -space-x-1.5">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-6 w-6 rounded-full border-2 border-background bg-gradient-to-br from-primary/60 to-primary/30"
                      />
                    ))}
                  </div>
                  <span>
                    Mais de <span className="font-semibold text-foreground">+{SOCIAL_PROOF_COUNT} profissionais</span> já usam o Agendaê
                  </span>
                </div>
                <div className="flex items-center gap-1 text-primary">
                  {'★★★★★'.split('').map((s, i) => (
                    <span key={i} className="text-xs">{s}</span>
                  ))}
                  <span className="text-muted-foreground ml-1">4.9/5</span>
                </div>
              </div>
            </div>

            {/* Right: pricing card */}
            <div className="rounded-xl border border-primary/30 bg-card/80 backdrop-blur p-5 shadow-lg">
              <div className="flex items-center gap-2 mb-3">
                <Crown className="h-5 w-5 text-primary" />
                <span className="font-semibold">Plano Studio</span>
                <Badge className="ml-auto bg-primary/15 text-primary hover:bg-primary/20 border-0">
                  Mais escolhido
                </Badge>
              </div>

              {/* Cycle toggle */}
              <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 mb-4">
                <button
                  type="button"
                  onClick={() => setCycle('monthly')}
                  className={`rounded-md py-1.5 text-xs font-medium transition ${
                    cycle === 'monthly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Mensal
                </button>
                <button
                  type="button"
                  onClick={() => setCycle('yearly')}
                  className={`relative rounded-md py-1.5 text-xs font-medium transition ${
                    cycle === 'yearly' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  Anual
                  {savings > 0 && (
                    <span className="ml-1 text-[10px] font-semibold text-primary">-{savings}%</span>
                  )}
                </button>
              </div>

              <div className="mb-4">
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-muted-foreground">R$</span>
                  <span className="text-4xl font-bold tracking-tight">
                    {displayPrice.toFixed(2).replace('.', ',')}
                  </span>
                  <span className="text-sm text-muted-foreground">/mês</span>
                </div>
                {cycle === 'yearly' && (
                  <p className="mt-1 text-xs text-primary font-medium flex items-center gap-1">
                    <Sparkles className="h-3 w-3" />
                    Cobrado R$ {yearly.toFixed(2).replace('.', ',')}/ano · Economize R$
                    {' '}
                    {(monthly * 12 - yearly).toFixed(2).replace('.', ',')}
                  </p>
                )}
              </div>

              <Button
                size="lg"
                className="w-full font-semibold shadow-md"
                onClick={handleSubscribe}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Abrindo checkout...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Assinar Studio agora
                  </>
                )}
              </Button>

              {/* Secondary CTA: talk before subscribing */}
              <Button
                variant="outline"
                size="lg"
                className="w-full mt-2 gap-2 border-primary/30 hover:bg-primary/5"
                onClick={handleSupportBeforeSubscribe}
              >
                <MessageCircle className="h-4 w-4 text-primary" />
                Falar no WhatsApp antes de assinar
              </Button>

              {/* Guarantee block */}
              <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-primary/5 border border-primary/15 p-2.5">
                <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                <p className="text-xs text-foreground/90">
                  <span className="font-semibold">Cancele quando quiser</span> · Sem fidelidade · Pagamento 100% seguro
                </p>
              </div>

              <div className="mt-3 flex items-center justify-between gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/settings/plans')}
                >
                  Ver todos os planos
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleSupport}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  Suporte
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (trialActive && trialDaysLeft <= 3) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Clock className="h-5 w-5 text-warning shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-warning">
            Trial expira em {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}
          </p>
          <p className="text-sm text-muted-foreground">
            Assine agora para não perder acesso aos recursos.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/settings/plans')}>
          Ver planos
        </Button>
      </div>
    );
  }

  return null;
};

export default TrialBanner;
