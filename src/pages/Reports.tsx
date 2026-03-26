import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart3, TrendingUp, DollarSign } from 'lucide-react';
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'day' | 'week' | 'month';

const Reports = () => {
  const { companyId } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [revenue, setRevenue] = useState(0);
  const [count, setCount] = useState(0);
  const [byProfessional, setByProfessional] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) fetchReport();
  }, [companyId, period]);

  const getRange = () => {
    const now = new Date();
    if (period === 'day') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'week') return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const fetchReport = async () => {
    const { start, end } = getRange();
    const { data } = await supabase
      .from('appointments')
      .select('*, professional:profiles!appointments_professional_id_fkey(full_name)')
      .eq('company_id', companyId!)
      .neq('status', 'cancelled')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    if (data) {
      setCount(data.length);
      setRevenue(data.reduce((sum, a) => sum + Number(a.total_price), 0));

      const grouped: Record<string, { name: string; revenue: number; count: number }> = {};
      data.forEach((a) => {
        const name = a.professional?.full_name || 'Sem nome';
        if (!grouped[a.professional_id]) grouped[a.professional_id] = { name, revenue: 0, count: 0 };
        grouped[a.professional_id].revenue += Number(a.total_price);
        grouped[a.professional_id].count += 1;
      });
      setByProfessional(Object.values(grouped).sort((a, b) => b.revenue - a.revenue));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Relatórios</h2>
          <p className="text-sm text-muted-foreground">Visão financeira do seu negócio</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <Button key={p} variant={period === p ? 'default' : 'ghost'} size="sm" onClick={() => setPeriod(p)}>
              {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-7 w-7 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-3xl font-display font-bold">R$ {revenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atendimentos</p>
              <p className="text-3xl font-display font-bold">{count}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Por Profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {byProfessional.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem dados no período</p>
          ) : (
            <div className="space-y-3">
              {byProfessional.map((p, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary">
                    {p.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{p.name}</p>
                    <p className="text-sm text-muted-foreground">{p.count} atendimentos</p>
                  </div>
                  <span className="font-display font-bold text-lg">R$ {p.revenue.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
