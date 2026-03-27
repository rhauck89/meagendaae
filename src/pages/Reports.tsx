import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, DollarSign, Users, Briefcase } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type Period = 'day' | 'week' | 'month';

interface ProfessionalReport {
  id: string;
  name: string;
  totalServices: number;
  totalRevenue: number;
  commissionType: string;
  commissionValue: number;
  commissionAmount: number;
  netAmount: number;
}

const Reports = () => {
  const { companyId } = useAuth();
  const [period, setPeriod] = useState<Period>('month');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [professionals, setProfessionals] = useState<ProfessionalReport[]>([]);
  const [totalCommission, setTotalCommission] = useState(0);

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

    // Fetch completed appointments with professional info
    const { data: appointments } = await supabase
      .from('appointments')
      .select('*, professional:profiles!appointments_professional_id_fkey(id, full_name)')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    // Fetch collaborators with commission info
    const { data: collaborators } = await supabase
      .from('collaborators')
      .select('profile_id, commission_type, commission_value, commission_percent')
      .eq('company_id', companyId!);

    if (!appointments) return;

    // Build commission lookup by profile_id
    const commissionMap: Record<string, { type: string; value: number }> = {};
    if (collaborators) {
      for (const c of collaborators) {
        commissionMap[c.profile_id] = {
          type: c.commission_type || 'percentage',
          value: c.commission_value ?? c.commission_percent ?? 0,
        };
      }
    }

    // Group by professional
    const grouped: Record<string, { name: string; revenue: number; count: number; profileId: string }> = {};
    for (const a of appointments) {
      const profId = a.professional_id;
      const name = a.professional?.full_name || 'Sem nome';
      if (!grouped[profId]) grouped[profId] = { name, revenue: 0, count: 0, profileId: profId };
      grouped[profId].revenue += Number(a.total_price);
      grouped[profId].count += 1;
    }

    // Calculate commissions
    const profReports: ProfessionalReport[] = Object.entries(grouped).map(([id, g]) => {
      const comm = commissionMap[g.profileId] || { type: 'none', value: 0 };
      let commissionAmount = 0;

      if (comm.type === 'percentage') {
        commissionAmount = (g.revenue * comm.value) / 100;
      } else if (comm.type === 'fixed') {
        commissionAmount = comm.value * g.count;
      }

      return {
        id,
        name: g.name,
        totalServices: g.count,
        totalRevenue: g.revenue,
        commissionType: comm.type,
        commissionValue: comm.value,
        commissionAmount,
        netAmount: g.revenue - commissionAmount,
      };
    });

    profReports.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const rev = appointments.reduce((sum, a) => sum + Number(a.total_price), 0);
    const totalComm = profReports.reduce((sum, p) => sum + p.commissionAmount, 0);

    setTotalRevenue(rev);
    setTotalCount(appointments.length);
    setProfessionals(profReports);
    setTotalCommission(totalComm);
  };

  const commissionLabel = (type: string, value: number) => {
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `R$ ${value.toFixed(2)}/serviço`;
    return 'Sem comissão';
  };

  const periodLabel = period === 'day' ? 'do Dia' : period === 'week' ? 'da Semana' : 'do Mês';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Relatórios Financeiros</h2>
          <p className="text-sm text-muted-foreground">Faturamento e comissões {periodLabel.toLowerCase()}</p>
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(['day', 'week', 'month'] as Period[]).map((p) => (
            <Button key={p} variant={period === p ? 'default' : 'ghost'} size="sm" onClick={() => setPeriod(p)}>
              {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
            </Button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Faturamento {periodLabel}</p>
              <p className="text-2xl font-display font-bold">R$ {totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atendimentos</p>
              <p className="text-2xl font-display font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Comissões</p>
              <p className="text-2xl font-display font-bold">R$ {totalCommission.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Líquido Empresa</p>
              <p className="text-2xl font-display font-bold">R$ {(totalRevenue - totalCommission).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Per-professional table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Relatório por Profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {professionals.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Sem atendimentos concluídos no período</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Profissional</TableHead>
                  <TableHead className="text-center">Serviços</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-center">Comissão</TableHead>
                  <TableHead className="text-right">Valor Comissão</TableHead>
                  <TableHead className="text-right">Líquido Prof.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center font-bold text-primary text-sm">
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{p.totalServices}</TableCell>
                    <TableCell className="text-right font-display font-semibold">
                      R$ {p.totalRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {commissionLabel(p.commissionType, p.commissionValue)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-warning font-semibold">
                      R$ {p.commissionAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-display font-bold">
                      R$ {p.netAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-center">{totalCount}</TableCell>
                  <TableCell className="text-right font-display">R$ {totalRevenue.toFixed(2)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-warning">R$ {totalCommission.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-display">R$ {(totalRevenue - totalCommission).toFixed(2)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Reports;
