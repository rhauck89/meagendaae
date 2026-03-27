import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, TrendingUp, DollarSign, Users, Briefcase } from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateFinancials, collaboratorTypeLabel, commissionLabel } from '@/lib/financial-engine';

type Period = 'day' | 'week' | 'month';

interface ProfessionalReport {
  id: string;
  name: string;
  totalServices: number;
  totalRevenue: number;
  collaboratorType: string;
  commissionType: string;
  commissionValue: number;
  professionalValue: number;
  companyValue: number;
}

const Reports = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [period, setPeriod] = useState<Period>('month');
  const [filterProfessional, setFilterProfessional] = useState<string>('all');
  const [filterRoleType, setFilterRoleType] = useState<string>('all');
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [professionals, setProfessionals] = useState<ProfessionalReport[]>([]);
  const [totalProfessionalValue, setTotalProfessionalValue] = useState(0);
  const [totalCompanyValue, setTotalCompanyValue] = useState(0);
  const [collaboratorsList, setCollaboratorsList] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) {
      fetchCollaborators();
    }
  }, [companyId]);

  useEffect(() => {
    if (companyId) fetchReport();
  }, [companyId, period, filterProfessional, filterRoleType]);

  const fetchCollaborators = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent, profile:profiles(full_name)')
      .eq('company_id', companyId!);
    if (data) setCollaboratorsList(data);
  };

  const getRange = () => {
    const now = new Date();
    if (period === 'day') return { start: startOfDay(now), end: endOfDay(now) };
    if (period === 'week') return { start: startOfWeek(now, { locale: ptBR }), end: endOfWeek(now, { locale: ptBR }) };
    return { start: startOfMonth(now), end: endOfMonth(now) };
  };

  const fetchReport = async () => {
    const { start, end } = getRange();

    let query = supabase
      .from('appointments')
      .select('*, professional:profiles!appointments_professional_id_fkey(id, full_name)')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    // Non-admin professionals can only see their own data
    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    } else if (filterProfessional !== 'all') {
      query = query.eq('professional_id', filterProfessional);
    }

    const { data: appointments } = await query;
    const { data: collaborators } = await supabase
      .from('collaborators')
      .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent')
      .eq('company_id', companyId!);

    if (!appointments) return;

    const collabMap: Record<string, { type: string; commType: string; value: number }> = {};
    if (collaborators) {
      for (const c of collaborators) {
        collabMap[c.profile_id] = {
          type: c.collaborator_type || 'commissioned',
          commType: c.commission_type || 'none',
          value: c.commission_value ?? c.commission_percent ?? 0,
        };
      }
    }

    const grouped: Record<string, { name: string; revenue: number; count: number; profileId: string }> = {};
    for (const apt of appointments) {
      const pid = apt.professional_id;
      const name = apt.professional?.full_name || 'Sem nome';
      if (!grouped[pid]) grouped[pid] = { name, revenue: 0, count: 0, profileId: pid };
      grouped[pid].revenue += Number(apt.total_price);
      grouped[pid].count += 1;
    }

    let reports: ProfessionalReport[] = Object.entries(grouped).map(([id, g]) => {
      const collab = collabMap[g.profileId] || { type: 'commissioned', commType: 'none', value: 0 };
      const fin = calculateFinancials(g.revenue, g.count, collab.type, collab.commType, collab.value);

      return {
        id,
        name: g.name,
        totalServices: g.count,
        totalRevenue: g.revenue,
        collaboratorType: collab.type,
        commissionType: collab.commType,
        commissionValue: collab.value,
        professionalValue: fin.professionalValue,
        companyValue: fin.companyValue,
      };
    });

    // Filter by role type
    if (filterRoleType !== 'all') {
      reports = reports.filter((r) => r.collaboratorType === filterRoleType);
    }

    reports.sort((a, b) => b.totalRevenue - a.totalRevenue);

    const revenue = reports.reduce((s, r) => s + r.totalRevenue, 0);
    const profValue = reports.reduce((s, r) => s + r.professionalValue, 0);
    const compValue = reports.reduce((s, r) => s + r.companyValue, 0);

    setTotalRevenue(revenue);
    setTotalCount(reports.reduce((s, r) => s + r.totalServices, 0));
    setProfessionals(reports);
    setTotalProfessionalValue(profValue);
    setTotalCompanyValue(compValue);
  };

  const periodLabel = period === 'day' ? 'do Dia' : period === 'week' ? 'da Semana' : 'do Mês';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Relatórios Financeiros</h2>
          <p className="text-sm text-muted-foreground">Faturamento e comissões {periodLabel.toLowerCase()}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isAdmin && (
            <>
              <Select value={filterProfessional} onValueChange={setFilterProfessional}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {collaboratorsList.map((c) => (
                    <SelectItem key={c.profile_id} value={c.profile_id}>
                      {(c.profile as any)?.full_name || 'Sem nome'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterRoleType} onValueChange={setFilterRoleType}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="partner">Sócio</SelectItem>
                  <SelectItem value="commissioned">Comissionado</SelectItem>
                  <SelectItem value="independent">Independente</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['day', 'week', 'month'] as Period[]).map((p) => (
              <Button key={p} variant={period === p ? 'default' : 'ghost'} size="sm" onClick={() => setPeriod(p)}>
                {p === 'day' ? 'Dia' : p === 'week' ? 'Semana' : 'Mês'}
              </Button>
            ))}
          </div>
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
              <p className="text-sm text-muted-foreground">Valor Profissionais</p>
              <p className="text-2xl font-display font-bold">R$ {totalProfessionalValue.toFixed(2)}</p>
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
              <p className="text-2xl font-display font-bold">R$ {totalCompanyValue.toFixed(2)}</p>
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
                  <TableHead className="text-center">Tipo</TableHead>
                  <TableHead className="text-center">Serviços</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-center">Comissão</TableHead>
                  <TableHead className="text-right">Valor Prof.</TableHead>
                  <TableHead className="text-right">Valor Empresa</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {professionals.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                          {p.name.charAt(0)}
                        </div>
                        <span className="font-medium">{p.name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {collaboratorTypeLabel(p.collaboratorType)}
                      </Badge>
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
                    <TableCell className="text-right font-semibold text-warning">
                      R$ {p.professionalValue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-display font-bold">
                      R$ {p.companyValue.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell />
                  <TableCell className="text-center">{totalCount}</TableCell>
                  <TableCell className="text-right font-display">R$ {totalRevenue.toFixed(2)}</TableCell>
                  <TableCell />
                  <TableCell className="text-right text-warning">R$ {totalProfessionalValue.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-display">R$ {totalCompanyValue.toFixed(2)}</TableCell>
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
