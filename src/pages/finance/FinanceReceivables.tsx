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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { CheckCircle, Trash2, AlertTriangle } from 'lucide-react';
import { format, isPast, isToday, endOfWeek, endOfMonth } from 'date-fns';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  received: 'bg-green-100 text-green-800 border-green-300',
  cancelled: 'bg-muted text-muted-foreground',
};
const statusLabels: Record<string, string> = { pending: 'Pendente', received: 'Recebido', cancelled: 'Cancelado' };

const paymentMethodLabels: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'Pix',
  cartao: 'Cartão',
  cartao_credito: 'Cartão de Crédito',
  cartao_debito: 'Cartão de Débito',
  transferencia: 'Transferência',
  outro: 'Outro',
};

type DateFilter = 'all' | 'today' | 'week' | 'month' | 'overdue' | 'custom';

const FinanceReceivables = () => {
  const { companyId } = useAuth();
  const { maskValue } = useFinancialPrivacy();
  const [items, setItems] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Payment confirmation modal state
  const [confirmItem, setConfirmItem] = useState<any>(null);
  const [confirmPaymentMethod, setConfirmPaymentMethod] = useState('');
  const [confirmAmount, setConfirmAmount] = useState('');
  const [confirmDate, setConfirmDate] = useState('');
  const [confirming, setConfirming] = useState(false);

  useEffect(() => { if (companyId) fetchItems(); }, [companyId, statusFilter, dateFilter, customStart, customEnd]);

  const fetchItems = async () => {
    let q = supabase
      .from('company_revenues')
      .select('*, category:company_revenue_categories(name)')
      .eq('company_id', companyId!)
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

  const openConfirmModal = (item: any) => {
    setConfirmItem(item);
    setConfirmPaymentMethod('');
    setConfirmAmount(Number(item.amount).toFixed(2));
    setConfirmDate(format(new Date(), 'yyyy-MM-dd'));
  };

  const handleConfirmReceived = async () => {
    if (!confirmPaymentMethod) {
      toast.error('Selecione a forma de pagamento');
      return;
    }
    if (!confirmItem) return;

    setConfirming(true);
    try {
      const { error } = await supabase.from('company_revenues').update({
        status: 'received',
        payment_method: confirmPaymentMethod,
        revenue_date: confirmDate,
        amount: parseFloat(confirmAmount) || confirmItem.amount,
      }).eq('id', confirmItem.id);

      if (error) throw error;

      toast.success('Recebimento confirmado');
      setConfirmItem(null);
      fetchItems();
    } catch {
      toast.error('Erro ao confirmar recebimento');
    } finally {
      setConfirming(false);
    }
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
            <SelectItem value="received">Recebidos</SelectItem>
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
                  <TableHead>Pagamento</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma conta a receber encontrada</TableCell></TableRow>
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
                    <TableCell className="text-muted-foreground">{r.payment_method ? (paymentMethodLabels[r.payment_method] || r.payment_method) : '—'}</TableCell>
                    <TableCell className="text-right font-semibold text-success">{maskValue(Number(r.amount))}</TableCell>
                    <TableCell><Badge variant="outline" className={statusColors[r.status] || ''}>{statusLabels[r.status] || r.status}</Badge></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {r.status === 'pending' && (
                          <Button variant="ghost" size="icon" onClick={() => openConfirmModal(r)} title="Marcar como recebido"><CheckCircle className="h-4 w-4 text-green-600" /></Button>
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

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {items.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma conta a receber encontrada</CardContent></Card>
        ) : items.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm break-words flex-1 min-w-0">{r.description}</span>
                <span className="font-semibold text-sm text-success shrink-0">{maskValue(Number(r.amount))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{r.due_date ? format(new Date(r.due_date + 'T12:00:00'), 'dd/MM/yyyy') : format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                {getDueBadge(r.due_date, r.status)}
                <span>•</span>
                <span>{r.category?.name || '—'}</span>
                <Badge variant="outline" className={cn('text-[10px]', statusColors[r.status] || '')}>{statusLabels[r.status] || r.status}</Badge>
              </div>
              <div className="flex justify-end gap-1">
                {r.status === 'pending' && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openConfirmModal(r)}><CheckCircle className="h-4 w-4 text-green-600" /></Button>
                )}
                {!r.is_automatic && (
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Payment Confirmation Modal */}
      <Dialog open={!!confirmItem} onOpenChange={open => { if (!open) setConfirmItem(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirmar recebimento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {confirmItem && (
              <p className="text-sm text-muted-foreground">
                {confirmItem.description} — {maskValue(Number(confirmItem.amount))}
              </p>
            )}
            <div className="space-y-2">
              <Label>Forma de pagamento <span className="text-destructive">*</span></Label>
              <Select value={confirmPaymentMethod} onValueChange={setConfirmPaymentMethod}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="pix">Pix</SelectItem>
                  <SelectItem value="cartao">Cartão</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor recebido</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={confirmAmount}
                onChange={e => setConfirmAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data do recebimento</Label>
              <Input
                type="date"
                value={confirmDate}
                onChange={e => setConfirmDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmItem(null)}>Cancelar</Button>
            <Button onClick={handleConfirmReceived} disabled={confirming || !confirmPaymentMethod}>
              {confirming ? 'Confirmando...' : 'Confirmar recebimento'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FinanceReceivables;
