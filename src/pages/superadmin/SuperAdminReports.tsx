import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { startOfMonth, format } from 'date-fns';

const SuperAdminReports = () => {
  const [stats, setStats] = useState({ totalAppointments: 0, completedAppointments: 0, cancelledAppointments: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
      
      const [totalRes, completedRes, cancelledRes] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('start_time', monthStart),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('start_time', monthStart).eq('status', 'completed'),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).gte('start_time', monthStart).eq('status', 'cancelled'),
      ]);

      setStats({
        totalAppointments: totalRes.count || 0,
        completedAppointments: completedRes.count || 0,
        cancelledAppointments: cancelledRes.count || 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">📈 Relatórios do Mês</h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Total Agendamentos</p>
            <p className="text-2xl font-display font-bold">{stats.totalAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Concluídos</p>
            <p className="text-2xl font-display font-bold text-success">{stats.completedAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Cancelados</p>
            <p className="text-2xl font-display font-bold text-destructive">{stats.cancelledAppointments}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SuperAdminReports;
