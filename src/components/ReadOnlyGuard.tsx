import { useNavigate } from "react-router-dom";
import { AlertTriangle, Lock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";

/**
 * Returns true when the company is in read-only mode:
 *  - Trial expired without an active paid subscription
 *  - Subscription past_due/unpaid AND grace period has ended
 *  - Subscription canceled and current period ended
 */
export function useIsReadOnly() {
  const plan = useCompanyPlan();

  if (plan.loading) return { readOnly: false, reason: null as string | null, plan };

  const status = plan.subscriptionStatus;
  const now = Date.now();
  const periodEnd = plan.currentPeriodEnd ? new Date(plan.currentPeriodEnd).getTime() : null;

  // Trial expired
  if (plan.trialExpired && status !== "active") {
    return { readOnly: true, reason: "trial_expired" as const, plan };
  }
  // Past due / unpaid - we rely on webhook setting grace_period_until on companies,
  // but here we conservatively block once status is unpaid or expired_trial.
  if (status === "expired_trial" || status === "unpaid") {
    return { readOnly: true, reason: "unpaid" as const, plan };
  }
  // Canceled and period ended
  if (status === "canceled" && periodEnd && periodEnd < now) {
    return { readOnly: true, reason: "canceled" as const, plan };
  }
  return { readOnly: false, reason: null as string | null, plan };
}

interface ReadOnlyGuardProps {
  children: React.ReactNode;
  /** When true, only show the banner but still render children (read-only mode). Default true. */
  allowRead?: boolean;
}

const messages: Record<string, { title: string; body: string }> = {
  trial_expired: {
    title: "Seu período de teste terminou",
    body: "Reative escolhendo um plano para liberar novos agendamentos, edições e automações. Seus dados continuam salvos.",
  },
  unpaid: {
    title: "Pagamento pendente",
    body: "Não conseguimos confirmar sua última cobrança. Atualize sua forma de pagamento para reativar todos os recursos.",
  },
  canceled: {
    title: "Sua assinatura foi cancelada",
    body: "O acesso aos recursos pagos foi suspenso. Assine novamente para continuar criando agendamentos e usando todas as ferramentas.",
  },
};

export function ReadOnlyBanner() {
  const navigate = useNavigate();
  const { readOnly, reason } = useIsReadOnly();
  if (!readOnly || !reason) return null;
  const msg = messages[reason] ?? messages.trial_expired;

  return (
    <div className="w-full bg-destructive/10 border-b border-destructive/30 px-4 py-3">
      <div className="max-w-6xl mx-auto flex items-start gap-3 flex-wrap">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
        <div className="flex-1 min-w-[200px]">
          <p className="font-medium text-destructive text-sm">{msg.title}</p>
          <p className="text-xs text-muted-foreground">{msg.body}</p>
        </div>
        <Button size="sm" onClick={() => navigate("/settings/plans")}>
          Reativar plano
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

/**
 * Wrap UI that should be locked when the workspace is read-only.
 * If `allowRead` is true (default), children render but interactive children
 * inside should call useIsReadOnly() to disable themselves. If false, shows a paywall.
 */
export function ReadOnlyGuard({ children, allowRead = true }: ReadOnlyGuardProps) {
  const navigate = useNavigate();
  const { readOnly, reason } = useIsReadOnly();

  if (!readOnly) return <>{children}</>;

  if (allowRead) return <>{children}</>;

  const msg = messages[reason ?? "trial_expired"] ?? messages.trial_expired;
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 gap-4 max-w-lg mx-auto">
      <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
        <Lock className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-display font-bold">{msg.title}</h2>
      <p className="text-muted-foreground text-sm">{msg.body}</p>
      <Button onClick={() => navigate("/settings/plans")}>
        Reativar plano
        <ArrowRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}

export default ReadOnlyGuard;
