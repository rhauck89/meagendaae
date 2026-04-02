import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, RefreshCw } from 'lucide-react';
import { format, addMonths, addWeeks, addYears } from 'date-fns';
import { toast } from 'sonner';

const statusLabels: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };

const FinanceExpenses = () => {
  const { companyId, user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState({
    description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'),
    due_date: '', category_id: '', is_recurring: false, recurrence_type: 'monthly',
    recurrence_interval: '1', notes: '', status: 'pending', installments: '1',
  });

  useEffect(() => { if (companyId) { fetchExpenses(); fetchCategories(); } }, [companyId]);

  const fetchExpenses = async () => {
    const { data } = await supabase
      .from('company_expenses')
      .select('*, category:company_expense_categories(name)')
      .eq('company_id', companyId!)
      .order('expense_date', { ascending: false })
      .limit(200);
    if (data) setExpenses(data);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('company_expense_categories').select('*').eq('company_id', companyId!).order('name');
    if (data) setCategories(data);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    const installments = parseInt(form.installments) || 1;
    const baseAmount = parseFloat(form.amount);
    const installmentAmount = installments > 1 ? baseAmount / installments : baseAmount;
    const baseDueDate = form.due_date || form.expense_date;

    const entries = [];
    for (let i = 0; i < installments; i++) {
      let dueDate = baseDueDate;
      if (i > 0) {
        const base = new Date(baseDueDate + 'T12:00:00');
        const next = addMonths(base, i);
        dueDate = format(next, 'yyyy-MM-dd');
      }
      entries.push({
        company_id: companyId!,
        description: installments > 1 ? `${form.description} (${i + 1}/${installments})` : form.description,
        amount: Math.round(installmentAmount * 100) / 100,
        expense_date: i === 0 ? form.expense_date : dueDate,
        due_date: dueDate || null,
        status: i === 0 ? form.status : 'pending',
        category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
        is_recurring: form.is_recurring,
        recurrence_type: form.is_recurring ? form.recurrence_type : null,
        recurrence_interval: form.is_recurring ? parseInt(form.recurrence_interval) : null,
        notes: form.notes || null,
        created_by: user?.id,
        installment_number: installments > 1 ? i + 1 : null,
        total_installments: installments > 1 ? installments : null,
      });
    }

    const { error } = await supabase.from('company_expenses').insert(entries);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success(installments > 1 ? `${installments} parcelas criadas` : 'Despesa registrada');
    setOpen(false);
    setForm({ description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'), due_date: '', category_id: '', is_recurring: false, recurrence_type: 'monthly', recurrence_interval: '1', notes: '', status: 'pending', installments: '1' });
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_expenses').delete().eq('id', id);
    toast.success('Despesa removida');
    fetchExpenses();
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { data, error } = await supabase.from('company_expense_categories').insert({ company_id: companyId!, name: newCatName.trim() }).select().single();
    if (error) { toast.error('Erro ao criar categoria'); return; }
    toast.success('Categoria criada');
    setNewCatName('');
    setCatOpen(false);
    await fetchCategories();
    if (data) setForm(f => ({ ...f, category_id: data.id }));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Despesas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as despesas da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Despesa</Button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-md">
            <DialogHeader><DialogTitle>Nova Despesa</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Data</Label><Input type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} /></div>
                <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="paid">Pago</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Parcelas</Label><Input type="number" min="1" max="60" value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Categoria</Label>
                  <Button type="button" variant="ghost" size="sm" className="h-auto py-0.5 px-1.5 text-xs text-primary" onClick={() => setCatOpen(true)}>
                    <Plus className="h-3 w-3 mr-1" /> Nova
                  </Button>
                </div>
                <Select value={form.category_id || 'none'} onValueChange={v => setForm(f => ({ ...f, category_id: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v }))} />
                <Label>Recorrente</Label>
              </div>
              {form.is_recurring && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Frequência</Label>
                    <Select value={form.recurrence_type} onValueChange={v => setForm(f => ({ ...f, recurrence_type: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Semanal</SelectItem>
                        <SelectItem value="monthly">Mensal</SelectItem>
                        <SelectItem value="yearly">Anual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Repetir a cada</Label><Input type="number" min="1" value={form.recurrence_interval} onChange={e => setForm(f => ({ ...f, recurrence_interval: e.target.value }))} /></div>
                </div>
              )}
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria de Despesa</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Ex: Aluguel, Marketing" /></div>
            <Button onClick={handleCreateCategory} className="w-full">Criar Categoria</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma despesa registrada</TableCell></TableRow>
                ) : expenses.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{format(new Date(e.expense_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell className="flex items-center gap-2">
                      {e.is_recurring && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                      {e.description}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.category?.name || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{statusLabels[e.status] || e.status}</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-destructive">R$ {Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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

export default FinanceExpenses;
