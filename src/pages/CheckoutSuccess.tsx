import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompanyPlan } from "@/hooks/useCompanyPlan";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  const plan = useCompanyPlan();
  const [confirmed, setConfirmed] = useState(false);
  const [tries, setTries] = useState(0);

  // Poll the plan a few times — the webhook may take a few seconds to arrive
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      await plan.refresh();
      if (cancelled) return;
      if (plan.subscriptionStatus === "active" && !plan.trialActive) {
        setConfirmed(true);
        return;
      }
      if (tries < 8) {
        setTimeout(() => setTries((t) => t + 1), 1500);
      } else {
        // Best-effort — show success UI even if webhook hasn't landed yet
        setConfirmed(true);
      }
    };
    tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tries]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-6">
      <div className="max-w-md w-full text-center space-y-6 bg-card border rounded-2xl p-8 shadow-xl">
        {!confirmed ? (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold">Confirmando pagamento…</h1>
              <p className="text-muted-foreground mt-2 text-sm">
                Estamos sincronizando sua assinatura. Isso costuma levar alguns segundos.
              </p>
            </div>
          </>
        ) : (
          <>
            <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center animate-in zoom-in-50 duration-300">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-display font-bold">Pagamento confirmado!</h1>
              <p className="text-muted-foreground">
                Sua assinatura{plan.planName ? <> do plano <strong>{plan.planName}</strong></> : null} está ativa.
                Bem-vindo(a) a bordo 🎉
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <Button onClick={() => navigate("/dashboard")} className="w-full">
                Ir para o painel
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
              <Button variant="ghost" onClick={() => navigate("/dashboard/settings/plan")} className="w-full">
                Ver detalhes do plano
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
