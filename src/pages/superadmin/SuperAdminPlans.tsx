import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard } from 'lucide-react';

const SuperAdminPlans = () => {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">💳 Planos</h2>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Gestão de Planos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            A gestão de planos é feita diretamente via Stripe. Configure produtos e preços no painel Stripe para gerenciar os planos de assinatura da plataforma.
          </p>
          <div className="mt-4 p-4 rounded-lg bg-muted/50">
            <p className="text-sm font-medium">Plano atual: Assinatura Mensal</p>
            <p className="text-xs text-muted-foreground mt-1">
              Modelo de plano único para profissionais com cobrança mensal via Stripe.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminPlans;
