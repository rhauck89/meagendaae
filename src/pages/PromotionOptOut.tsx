import { useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { BellOff, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function PromotionOptOut() {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const companyId = searchParams.get("c");
  const whatsapp = searchParams.get("w");

  const canSubmit = useMemo(() => Boolean(companyId && whatsapp), [companyId, whatsapp]);

  const handleConfirm = async () => {
    if (!canSubmit) {
      toast.error("Link de descadastro inválido.");
      return;
    }

    setLoading(true);
    try {
      const { error } = await (supabase.rpc as any)("register_promotional_opt_out", {
        p_company_id: companyId,
        p_whatsapp: whatsapp,
      });

      if (error) throw error;
      setDone(true);
    } catch (error) {
      console.error("[PromotionOptOut]", error);
      toast.error("Não foi possível concluir o descadastro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-muted/30 flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md shadow-sm">
        <CardContent className="p-8 text-center space-y-6">
          <div className="mx-auto h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
            {done ? <CheckCircle2 className="h-8 w-8" /> : <BellOff className="h-8 w-8" />}
          </div>

          {done ? (
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Descadastro confirmado</h1>
              <p className="text-sm text-muted-foreground">
                Você não receberá mais promoções deste estabelecimento.
              </p>
              <p className="text-xs text-muted-foreground">
                Confirmações, lembretes e mensagens importantes de agendamento continuarão chegando normalmente.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <h1 className="text-2xl font-bold">Sair da lista de promoções</h1>
              <p className="text-sm text-muted-foreground">
                Você deixará de receber apenas promoções deste estabelecimento.
              </p>
              <p className="text-xs text-muted-foreground">
                Isso não bloqueia confirmações, lembretes, cancelamentos, reagendamentos ou mensagens de acesso.
              </p>
            </div>
          )}

          {!done && (
            <Button className="w-full" onClick={handleConfirm} disabled={loading || !canSubmit}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar descadastro
            </Button>
          )}

          <Button variant="ghost" asChild className="w-full">
            <Link to="/">Voltar ao início</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
