import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CheckoutSuccess() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = setTimeout(() => navigate("/dashboard"), 5000);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md text-center space-y-4">
        <CheckCircle2 className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-2xl font-bold">Pagamento confirmado!</h1>
        <p className="text-muted-foreground">
          Sua assinatura foi ativada. Você será redirecionado para o painel em instantes.
        </p>
        <Button onClick={() => navigate("/dashboard")}>Ir para o painel agora</Button>
      </div>
    </div>
  );
}
