import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { format, isPast, isToday, endOfWeek, endOfMonth, startOfWeek } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  paid: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'overdue' | 'custom';

const FinancePayables = () => {
  const { companyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => { if (companyId) fetchItems(); }, [companyId, statusFilter, dateFilter, customStart, customEnd]);

  const fetchItems = async () => {
    let q = supabase
      .from('company_expenses')
      .select('*, category:company_expense_categories(name)')
      .eq('company_id', companyId!)
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
      .limit(300);

    if (statusFilter !== 'all') q = q.eq('status', statusFilter);

    const today = format(new Date(), 'yyyy-MM-dd');

    if (dateFilter === 'today') {
      q = q.eq('due_date', today);
    } else if (dateFilter === 'week') {
      q = q.gte('due_date', today).lte('due_date', format(endOfWeek(new Date()), 'yyyy-MM-dd'));
    } else if (dateFilter === 'month') {
      q = q.gte('due_date', today).lte('due_date', format(endOfMonth(new Date()), 'yyyy-MM-dd'));
    } else if (dateFilter === 'overdue') {
      q = q.lt('due_date', today).eq('status', 'pending');
    } else if (dateFilter === 'custom' && customStart && customEnd) {
      q = q.gte('due_date', customStart).lte('due_date', customEnd);
    }

    const { data } = await q;
    if (data) setItems(data);
  };

  const markPaid = async (id: string) => {
    await supabase.from('company_expenses').update({ status: 'paid' }).eq('id', id);
    toast.success('Marcado como pago');
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_expenses').delete().eq('id', id);
    toast.success('Despesa removida');
    fetchItems();
  };

  const getDueBadge = (dueDate: string, status: string) => {
    if (status !== 'pending') return null;
    const d = new Date(dueDate + 'T12:00:00');
    if (isToday(d)) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Vence hoje</Badge>;
    if (isPast(d)) return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasada</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Contas a Pagar</h2>
          <p className="text-sm text-muted-foreground">Despesas com vencimento futuro</p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 items-end">
        <div className="flex flex-wrap gap-1">
          {(['all', 'today', 'week', 'month', 'overdue', 'custom'] as DateFilter[]).map(f => (
            <Button key={f} size="sm" variant={dateFilter === f ? 'default' : 'outline'} onClick={() => setDateFilter(f)}>
              {{ all: 'Todos', today: 'Hoje', week: 'Esta semana', month: 'Este mês', overdue: 'Atrasadas', custom: 'Período' }[f]}
            </Button>
          ))}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="paid">Pagos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {dateFilter === 'custom' && (
        <div className="flex flex-wrap gap-2 items-end">
          <div><Label>Data inicial</Label><Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} /></div>
          <div><Label>Data final</Label><Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} /></div>
        </div>
      )}

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conta a pagar encontrada</TableCell></TableRow>
                ) : items.map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {format(new Date(e.due_date + 'T12:00:00'), 'dd/MM/yyyy')}
                        {getDueBadge(e.due_date, e.status)}
                      </div>
                    </TableCell>
                    <TableCell>{e.description}</TableCell>
                    <TableCell className="text-muted-foreground">{e.category?.name || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-destructive">R$ {Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColors[e.status] || ''}>{statusLabels[e.status] || e.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {e.status === 'pending' && (
                          <Button variant="ghost" size="icon" onClick={() => markPaid(e.id)} title="Marcar como pago"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                        )}
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma conta a pagar encontrada</CardContent></Card>
        ) : items.map(e => (
          <Card key={e.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm break-words flex-1 min-w-0">{e.description}</span>
                <span className="font-semibold text-sm text-destructive shrink-0">R$ {Number(e.amount).toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{format(new Date(e.due_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                {getDueBadge(e.due_date, e.status)}
                <span>•</span>
                <span>{e.category?.name || '—'}</span>
                <Badge variant="outline" className={cn('text-[10px]', statusColors[e.status] || '')}>{statusLabels[e.status] || e.status}</Badge>
              </div>
              <div className="flex justify-end gap-1">
                {e.status === 'pending' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => markPaid(e.id)}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                )}
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinancePayables;
