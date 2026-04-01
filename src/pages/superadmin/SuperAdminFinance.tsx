import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, DollarSign, TrendingUp } from 'lucide-react';

const SuperAdminFinance = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, subscription_status, stripe_subscription_id');
      if (data) setCompanies(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const paying = companies.filter(c => c.subscription_status === 'active' && c.stripe_subscription_id);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">💰 Financeiro</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <Building2 className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Assinantes Ativos</p>
              <p className="text-2xl font-display font-bold">{paying.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Trial</p>
              <p className="text-2xl font-display font-bold">
                {companies.filter(c => c.subscription_status === 'trial').length}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <DollarSign className="h-8 w-8 text-warning" />
            <div>
              <p className="text-sm text-muted-foreground">Conversão Trial→Ativo</p>
              <p className="text-2xl font-display font-bold">
                {companies.length > 0
                  ? Math.round((paying.length / companies.length) * 100)
                  : 0}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="text-sm text-muted-foreground">
        Detalhes financeiros completos e gestão de cobranças disponíveis no painel Stripe.
      </p>
    </div>
  );
};

export default SuperAdminFinance;
