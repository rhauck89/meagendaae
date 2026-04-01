import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, X, CreditCard, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '@/components/DashboardLayout';

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  yearly_discount: number;
  members_limit: number;
  automatic_messages: boolean;
  open_scheduling: boolean;
  promotions: boolean;
  discount_coupons: boolean;
  whitelabel: boolean;
  active: boolean;
}

const featureList = [
  { key: 'automatic_messages', label: 'Mensagens Automáticas' },
  { key: 'open_scheduling', label: 'Agendamento Aberto' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'discount_coupons', label: 'Cupons de Desconto' },
  { key: 'whitelabel', label: 'Whitelabel' },
] as const;

const PlansPage = () => {
  const { companyId } = useAuth();
  const currentPlan = useCompanyPlan();
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [changingPlan, setChangingPlan] = useState<string | null>(null);

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
    if (currentPlan.billingCycle) {
      setBillingCycle(currentPlan.billingCycle as 'monthly' | 'yearly');
    }
  }, [currentPlan.billingCycle]);

  const handleSelectPlan = async (plan: Plan) => {
    if (!companyId) return;
    setChangingPlan(plan.id);

    const { error } = await supabase
      .from('companies')
      .update({
        plan_id: plan.id,
        billing_cycle: billingCycle,
        subscription_status: 'active' as any,
        trial_active: false,
      } as any)
      .eq('id', companyId);

    if (error) {
      toast.error('Erro ao alterar plano');
    } else {
      toast.success(`Plano alterado para ${plan.name}`);
      // Reload after a moment
      setTimeout(() => window.location.reload(), 1000);
    }
    setChangingPlan(null);
  };

  if (loading || currentPlan.loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold flex items-center gap-2">
              <CreditCard className="h-6 w-6" /> Escolha seu plano
            </h1>
            <p className="text-muted-foreground text-sm">Selecione o melhor plano para o seu negócio</p>
          </div>
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-3">
          <Button
            variant={billingCycle === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingCycle('monthly')}
          >
            Mensal
          </Button>
          <Button
            variant={billingCycle === 'yearly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setBillingCycle('yearly')}
          >
            Anual
          </Button>
        </div>

        {/* Plans Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isCurrent = plan.id === currentPlan.planId;
            const price = billingCycle === 'yearly' ? plan.yearly_price : plan.monthly_price;

            return (
              <Card key={plan.id} className={`relative ${isCurrent ? 'ring-2 ring-primary' : ''}`}>
                {isCurrent && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
                    Plano atual
                  </Badge>
                )}
                <CardHeader className="text-center pb-2">
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <div className="mt-2">
                    <span className="text-3xl font-bold">
                      R${Number(price).toFixed(2).replace('.', ',')}
                    </span>
                    <span className="text-muted-foreground">
                      {billingCycle === 'yearly' ? '/ano' : '/mês'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && Number(plan.yearly_discount) > 0 && (
                    <Badge variant="outline" className="text-success border-success/20 mt-1">
                      {plan.yearly_discount}% de desconto
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-center text-muted-foreground">
                    Até {plan.members_limit} membro{plan.members_limit !== 1 ? 's' : ''}
                  </div>
                  <div className="space-y-2 pt-3 border-t">
                    {featureList.map(({ key, label }) => {
                      const enabled = plan[key];
                      return (
                        <div key={key} className="flex items-center gap-2 text-sm">
                          {enabled ? (
                            <Check className="h-4 w-4 text-success shrink-0" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30 shrink-0" />
                          )}
                          <span className={enabled ? '' : 'text-muted-foreground/50'}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'outline' : 'default'}
                    disabled={isCurrent || changingPlan === plan.id}
                    onClick={() => handleSelectPlan(plan)}
                  >
                    {isCurrent ? 'Plano atual' : changingPlan === plan.id ? 'Alterando...' : 'Selecionar plano'}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PlansPage;
