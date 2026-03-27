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

    const { data: appointments } = await supabase
      .from('appointments')
      .select('*, professional:profiles!appointments_professional_id_fkey(id, full_name)')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    const { data: collaborators } = await supabase
      .from('collaborators')
      .select('profile_id, commission_type, commission_value, commission_percent')
      .eq('company_id', companyId!);

    if (!appointments) return;

    const commissionMap: Record<string, { type: string; value: number }> = {};
    if (collaborators) {
      for (const collaborator of collaborators) {
        commissionMap[collaborator.profile_id] = {
          type: collaborator.commission_type || 'none',
          value: collaborator.commission_value ?? collaborator.commission_percent ?? 0,
        };
      }
    }

    const grouped: Record<string, { name: string; revenue: number; count: number; profileId: string }> = {};
    for (const appointment of appointments) {
      const professionalId = appointment.professional_id;
      const name = appointment.professional?.full_name || 'Sem nome';
      if (!grouped[professionalId]) {
        grouped[professionalId] = { name, revenue: 0, count: 0, profileId: professionalId };
      }
      grouped[professionalId].revenue += Number(appointment.total_price);
      grouped[professionalId].count += 1;
    }

    const professionalReports: ProfessionalReport[] = Object.entries(grouped).map(([id, groupedProfessional]) => {
      const commission = commissionMap[groupedProfessional.profileId] || { type: 'none', value: 0 };
      let commissionAmount = 0;

      if (commission.type === 'percentage') {
        commissionAmount = (groupedProfessional.revenue * commission.value) / 100;
      } else if (commission.type === 'fixed') {
        commissionAmount = commission.value * groupedProfessional.count;
      }

      return {
        id,
        name: groupedProfessional.name,
        totalServices: groupedProfessional.count,
        totalRevenue: groupedProfessional.revenue,
        commissionType: commission.type,
        commissionValue: commission.value,
        commissionAmount,
        netAmount: groupedProfessional.revenue - commissionAmount,
      };
    });

    professionalReports.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const revenue = appointments.reduce((sum, appointment) => sum + Number(appointment.total_price), 0);
    const commissions = professionalReports.reduce((sum, professional) => sum + professional.commissionAmount, 0);

    setTotalRevenue(revenue);
    setTotalCount(appointments.length);
    setProfessionals(professionalReports);
    setTotalCommission(commissions);
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
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['day', 'week', 'month'] as Period[]).map((currentPeriod) => (
            <Button key={currentPeriod} variant={period === currentPeriod ? 'default' : 'ghost'} size="sm" onClick={() => setPeriod(currentPeriod)}>
              {currentPeriod === 'day' ? 'Dia' : currentPeriod === 'week' ? 'Semana' : 'Mês'}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Faturamento {periodLabel}</p>
              <p className="text-2xl font-display font-bold">R$ {totalRevenue.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <TrendingUp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Atendimentos</p>
              <p className="text-2xl font-display font-bold">{totalCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
              <Briefcase className="h-6 w-6 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Comissões</p>
              <p className="text-2xl font-display font-bold">R$ {totalCommission.toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10">
              <Users className="h-6 w-6 text-accent" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Líquido Empresa</p>
              <p className="text-2xl font-display font-bold">R$ {(totalRevenue - totalCommission).toFixed(2)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" /> Relatório por Profissional
          </CardTitle>
        </CardHeader>
        <CardContent>
          {professionals.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">Sem atendimentos concluídos no período</p>
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
                {professionals.map((professional) => (
                  <TableRow key={professional.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {professional.name.charAt(0)}
                        </div>
                        <span className="font-medium">{professional.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">{professional.totalServices}</TableCell>
                    <TableCell className="text-right font-display font-semibold">
                      R$ {professional.totalRevenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {commissionLabel(professional.commissionType, professional.commissionValue)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold text-warning">
                      R$ {professional.commissionAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-display font-bold">
                      R$ {professional.netAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
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
