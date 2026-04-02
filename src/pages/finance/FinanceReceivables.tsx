import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  received: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<string, string> = { pending: 'Pendente', received: 'Recebido', cancelled: 'Cancelado' };

const FinanceReceivables = () => {
  const { companyId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('pending');

  useEffect(() => { if (companyId) fetchItems(); }, [companyId, filter]);

  const fetchItems = async () => {
    let q = supabase
      .from('company_revenues')
      .select('*, category:company_revenue_categories(name)')
      .eq('company_id', companyId!)
      .order('due_date', { ascending: true })
      .limit(300);
    if (filter !== 'all') q = q.eq('status', filter);
    const { data } = await q;
    if (data) setItems(data);
  };

  const markReceived = async (id: string) => {
    await supabase.from('company_revenues').update({ status: 'received' }).eq('id', id);
    toast.success('Marcado como recebido');
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_revenues').delete().eq('id', id);
    toast.success('Receita removida');
    fetchItems();
  };

  const getDueBadge = (dueDate: string | null, status: string) => {
    if (status !== 'pending' || !dueDate) return null;
    const d = new Date(dueDate + 'T12:00:00');
    if (isToday(d)) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Vence hoje</Badge>;
    if (isPast(d)) return <Badge variant="destructive" className="text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Atrasada</Badge>;
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Contas a Receber</h2>
          <p className="text-sm text-muted-foreground">Receitas pendentes e recebidas</p>
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendentes</SelectItem>
            <SelectItem value="received">Recebidos</SelectItem>
            <SelectItem value="cancelled">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
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
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma conta a receber encontrada</TableCell></TableRow>
                ) : items.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        {r.due_date ? format(new Date(r.due_date + 'T12:00:00'), 'dd/MM/yyyy') : format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}
                        {getDueBadge(r.due_date, r.status)}
                      </div>
                    </TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-muted-foreground">{r.category?.name || '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-success">R$ {Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColors[r.status] || ''}>{statusLabels[r.status] || r.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === 'pending' && (
                          <Button variant="ghost" size="icon" onClick={() => markReceived(r.id)} title="Marcar como recebido"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                        )}
                        {!r.is_automatic && (
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinanceReceivables;
