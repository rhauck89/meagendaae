import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, RotateCcw } from 'lucide-react';
import { startOfMonth, startOfDay, endOfDay, format } from 'date-fns';
import { calculateFinancials, collaboratorTypeLabel, commissionLabel } from '@/lib/financial-engine';

const FinanceCommissions = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [startDate, setStartDate] = useState<Date>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId, startDate, endDate]);

  const fetchData = async () => {
    const start = startOfDay(startDate);
    const end = endOfDay(endDate);

    let query = supabase
      .from('appointments')
      .select('*, professional:profiles!appointments_professional_id_fkey(id, full_name)')
      .eq('company_id', companyId!)
      .eq('status', 'completed')
      .gte('start_time', start.toISOString())
      .lte('start_time', end.toISOString());

    if (!isAdmin && profileId) query = query.eq('professional_id', profileId);

    const { data: appointments } = await query;
    const { data: collaborators } = await supabase
      .from('collaborators')
      .select('profile_id, collaborator_type, commission_type, commission_value, commission_percent')
      .eq('company_id', companyId!);

    if (!appointments) return;

    const collabMap: Record<string, any> = {};
    collaborators?.forEach(c => {
      collabMap[c.profile_id] = { type: c.collaborator_type, commType: c.commission_type, value: c.commission_value ?? c.commission_percent ?? 0 };
    });

    const grouped: Record<string, { name: string; revenue: number; count: number }> = {};
    appointments.forEach(a => {
      const pid = a.professional_id;
      if (!grouped[pid]) grouped[pid] = { name: a.professional?.full_name || 'Sem nome', revenue: 0, count: 0 };
      grouped[pid].revenue += Number(a.total_price);
      grouped[pid].count += 1;
    });

    const result = Object.entries(grouped).map(([id, g]) => {
      const collab = collabMap[id] || { type: 'commissioned', commType: 'none', value: 0 };
      const fin = calculateFinancials(g.revenue, g.count, collab.type, collab.commType, collab.value);
      return { id, ...g, ...collab, professionalValue: fin.professionalValue, companyValue: fin.companyValue };
    });
    result.sort((a, b) => b.revenue - a.revenue);
    setRows(result);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Comissões</h2>
        <p className="text-sm text-muted-foreground">Cálculo de comissões por profissional</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(startDate, 'dd/MM/yyyy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={startDate} onSelect={d => d && setStartDate(d)} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <span className="text-muted-foreground">—</span>
            <Popover>
              <PopoverTrigger asChild><Button variant="outline" size="sm" className="w-full sm:w-[150px] justify-start"><CalendarIcon className="mr-2 h-4 w-4" />{format(endDate, 'dd/MM/yyyy')}</Button></PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={endDate} onSelect={d => d && setEndDate(d)} disabled={d => d < startDate} className="p-3 pointer-events-auto" /></PopoverContent>
            </Popover>
            <Button variant="ghost" size="sm" onClick={() => { setStartDate(startOfMonth(new Date())); setEndDate(new Date()); }}><RotateCcw className="h-3 w-3 mr-1" /> Resetar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
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
              {rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Sem dados no período</TableCell></TableRow>
              ) : rows.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="text-xs">{collaboratorTypeLabel(r.type)}</Badge></TableCell>
                  <TableCell className="text-center">{r.count}</TableCell>
                  <TableCell className="text-right font-semibold">R$ {r.revenue.toFixed(2)}</TableCell>
                  <TableCell className="text-center"><Badge variant="outline" className="text-xs">{commissionLabel(r.commType, r.value)}</Badge></TableCell>
                  <TableCell className="text-right font-semibold text-warning">R$ {r.professionalValue.toFixed(2)}</TableCell>
                  <TableCell className="text-right font-display font-bold">R$ {r.companyValue.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceCommissions;
