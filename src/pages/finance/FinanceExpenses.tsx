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
import { Plus, Trash2, RefreshCw, Pencil } from 'lucide-react';
import { format, addMonths, addWeeks, addYears } from 'date-fns';
import { toast } from 'sonner';

const statusLabels: Record<string, string> = { pending: 'Pendente', paid: 'Pago', cancelled: 'Cancelado' };

const paymentMethodLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' };

const emptyForm = () => ({
  description: '', amount: '', expense_date: format(new Date(), 'yyyy-MM-dd'),
  due_date: '', category_id: '', is_recurring: false, recurrence_type: 'monthly',
  recurrence_count: '1', notes: '', status: 'pending', installments: '1', payment_method: '',
});

const FinanceExpenses = () => {
  const { companyId, user } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const addRecurrencePeriod = (baseDate: string, type: string, count: number): string => {
    const d = new Date(baseDate + 'T12:00:00');
    switch (type) {
      case 'weekly': return format(addWeeks(d, count), 'yyyy-MM-dd');
      case 'yearly': return format(addYears(d, count), 'yyyy-MM-dd');
      default: return format(addMonths(d, count), 'yyyy-MM-dd');
    }
  };

  const createEntries = (baseForm: typeof form): any[] => {
    const isRecurring = baseForm.is_recurring;
    const installments = isRecurring
      ? Math.max(1, parseInt(baseForm.recurrence_count) || 1)
      : Math.max(1, parseInt(baseForm.installments) || 1);
    const baseAmount = parseFloat(baseForm.amount);
    const installmentAmount = !isRecurring && installments > 1 ? baseAmount / installments : baseAmount;
    const baseDueDate = baseForm.due_date || baseForm.expense_date;
    const groupId = installments > 1 ? crypto.randomUUID() : null;

    const entries = [];
    for (let i = 0; i < installments; i++) {
      const dueDate = i === 0 ? baseDueDate : isRecurring
        ? addRecurrencePeriod(baseDueDate, baseForm.recurrence_type, i)
        : format(addMonths(new Date(baseDueDate + 'T12:00:00'), i), 'yyyy-MM-dd');

      entries.push({
        company_id: companyId!,
        description: installments > 1 ? `${baseForm.description} (${i + 1}/${installments})` : baseForm.description,
        amount: Math.round(installmentAmount * 100) / 100,
        expense_date: i === 0 ? baseForm.expense_date : dueDate,
        due_date: dueDate || null,
        status: i === 0 ? baseForm.status : 'pending',
        category_id: baseForm.category_id && baseForm.category_id !== 'none' ? baseForm.category_id : null,
        is_recurring: isRecurring,
        recurrence_type: isRecurring ? baseForm.recurrence_type : null,
        recurrence_interval: isRecurring ? 1 : null,
        notes: baseForm.notes || null,
        created_by: user?.id,
        installment_number: installments > 1 ? i + 1 : null,
        total_installments: installments > 1 ? installments : null,
        installment_group_id: groupId,
        payment_method: baseForm.payment_method || null,
      });
    }
    return entries;
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('company_expenses').update({
          description: form.description,
          amount: parseFloat(form.amount),
          expense_date: form.expense_date,
          due_date: form.due_date || null,
          status: form.status,
          category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
          is_recurring: form.is_recurring,
          recurrence_type: form.is_recurring ? form.recurrence_type : null,
          notes: form.notes || null,
          payment_method: form.payment_method || null,
        }).eq('id', editingId);
        if (error) { toast.error('Erro ao atualizar'); return; }
        toast.success('Despesa atualizada');
      } else {
        const entries = createEntries(form);
        const { error } = await supabase.from('company_expenses').insert(entries);
        if (error) { toast.error('Erro ao salvar'); return; }
        const count = entries.length;
        toast.success(count > 1 ? `${count} registros criados` : 'Despesa registrada');
      }
      closeDialog();
      fetchExpenses();
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditGroup = async (groupId: string) => {
    const { error } = await supabase.from('company_expenses').update({
      category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
      notes: form.notes || null,
      status: form.status,
    }).eq('installment_group_id', groupId);
    if (error) { toast.error('Erro ao atualizar grupo'); return; }
    toast.success('Grupo atualizado');
    closeDialog();
    fetchExpenses();
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openEdit = (e: any) => {
    setEditingId(e.id);
    setForm({
      description: e.description,
      amount: String(e.amount),
      expense_date: e.expense_date,
      due_date: e.due_date || '',
      category_id: e.category_id || '',
      is_recurring: e.is_recurring,
      recurrence_type: e.recurrence_type || 'monthly',
      recurrence_count: '1',
      notes: e.notes || '',
      status: e.status,
      installments: '1',
      payment_method: e.payment_method || '',
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_expenses').delete().eq('id', id);
    toast.success('Despesa removida');
    fetchExpenses();
  };

  const handleDeleteGroup = async (groupId: string) => {
    await supabase.from('company_expenses').delete().eq('installment_group_id', groupId);
    toast.success('Grupo de parcelas removido');
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

  const editingExpense = editingId ? expenses.find(e => e.id === editingId) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold">Despesas</h2>
          <p className="text-sm text-muted-foreground">Gerencie as despesas da empresa</p>
        </div>
        <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Despesa</Button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-md">
            <DialogHeader><DialogTitle>{editingId ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
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
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {!editingId && !form.is_recurring && (
                  <div><Label>Parcelas</Label><Input type="number" min="1" max="60" value={form.installments} onChange={e => setForm(f => ({ ...f, installments: e.target.value }))} /></div>
                )}
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
              {!editingId && (
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_recurring} onCheckedChange={v => setForm(f => ({ ...f, is_recurring: v, installments: '1' }))} />
                  <Label>Recorrente</Label>
                </div>
              )}
              {!editingId && form.is_recurring && (
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
                  <div><Label>Nº de ocorrências</Label><Input type="number" min="1" max="60" value={form.recurrence_count} onChange={e => setForm(f => ({ ...f, recurrence_count: e.target.value }))} /></div>
                </div>
              )}
              <div>
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_method || 'none'} onValueChange={v => setForm(f => ({ ...f, payment_method: v === 'none' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não informado</SelectItem>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">Pix</SelectItem>
                    <SelectItem value="cartao">Cartão</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="outro">Outro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <div className="space-y-2">
                <Button onClick={handleSubmit} className="w-full" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
                {editingId && editingExpense?.installment_group_id && editingExpense?.total_installments > 1 && (
                  <Button variant="outline" onClick={() => handleEditGroup(editingExpense.installment_group_id)} className="w-full">
                    Aplicar a todo o grupo ({editingExpense.total_installments} parcelas)
                  </Button>
                )}
              </div>
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

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma despesa registrada</TableCell></TableRow>
                ) : expenses.map(e => (
                  <TableRow key={e.id}>
                    <TableCell>{format(new Date(e.expense_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {e.is_recurring && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                        <span>{e.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{e.category?.name || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{paymentMethodLabels[e.payment_method] || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{statusLabels[e.status] || e.status}</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-destructive">R$ {Number(e.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(e)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (e.installment_group_id && e.total_installments && e.total_installments > 1) {
                            if (confirm('Deseja excluir todas as parcelas deste grupo?')) {
                              handleDeleteGroup(e.installment_group_id);
                            } else {
                              handleDelete(e.id);
                            }
                          } else {
                            handleDelete(e.id);
                          }
                        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
        {expenses.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma despesa registrada</CardContent></Card>
        ) : expenses.map(e => (
          <Card key={e.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {e.is_recurring && <RefreshCw className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                  <span className="font-medium text-sm break-words">{e.description}</span>
                </div>
                <span className="font-semibold text-sm text-destructive shrink-0">R$ {Number(e.amount).toFixed(2)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{format(new Date(e.expense_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                <span>•</span>
                <span>{e.category?.name || '—'}</span>
                <Badge variant="outline" className="text-[10px]">{statusLabels[e.status] || e.status}</Badge>
              </div>
              <div className="flex justify-end gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                  if (e.installment_group_id && e.total_installments && e.total_installments > 1) {
                    if (confirm('Deseja excluir todas as parcelas deste grupo?')) {
                      handleDeleteGroup(e.installment_group_id);
                    } else {
                      handleDelete(e.id);
                    }
                  } else {
                    handleDelete(e.id);
                  }
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinanceExpenses;
