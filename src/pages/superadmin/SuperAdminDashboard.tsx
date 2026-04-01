import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Building2, Users, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';

const SuperAdminDashboard = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('companies')
        .select('id, name, slug, subscription_status, created_at, stripe_subscription_id')
        .order('created_at', { ascending: false });
      if (data) setCompanies(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const totalCompanies = companies.length;
  const activeCompanies = companies.filter(c => c.subscription_status === 'active').length;
  const trialCompanies = companies.filter(c => c.subscription_status === 'trial').length;
  const blockedCompanies = companies.filter(c => c.subscription_status === 'blocked').length;
  const monthStart = startOfMonth(new Date());
  const newThisMonth = companies.filter(c => new Date(c.created_at) >= monthStart).length;

  const metrics = [
    { label: 'Total Empresas', value: totalCompanies, icon: Building2, color: 'text-primary' },
    { label: 'Ativas', value: activeCompanies, icon: Users, color: 'text-success' },
    { label: 'Trial', value: trialCompanies, icon: Clock, color: 'text-warning' },
    { label: 'Bloqueadas', value: blockedCompanies, icon: DollarSign, color: 'text-destructive' },
    { label: 'Novas este mês', value: newThisMonth, icon: TrendingUp, color: 'text-accent-foreground' },
  ];

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">📊 Visão Geral</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <m.icon className={`h-8 w-8 ${m.color}`} />
              <div>
                <p className="text-sm text-muted-foreground">{m.label}</p>
                <p className="text-2xl font-display font-bold">{m.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <h2 className="text-xl font-display font-semibold">🏢 Últimas Empresas</h2>
      <div className="space-y-2">
        {companies.slice(0, 10).map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">/{c.slug} · {format(new Date(c.created_at), 'dd/MM/yyyy')}</p>
              </div>
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                c.subscription_status === 'active' ? 'bg-success/10 text-success' :
                c.subscription_status === 'trial' ? 'bg-warning/10 text-warning' :
                c.subscription_status === 'blocked' ? 'bg-destructive/10 text-destructive' :
                'bg-muted text-muted-foreground'
              }`}>
                {c.subscription_status}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminDashboard;
