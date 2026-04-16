import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Pencil } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const statusLabels: Record<string, string> = { pending: 'Pendente', received: 'Recebido', cancelled: 'Cancelado' };

const paymentMethodLabels: Record<string, string> = { dinheiro: 'Dinheiro', pix: 'Pix', cartao: 'Cartão', transferencia: 'Transferência', outro: 'Outro' };

const emptyForm = () => ({
  description: '', amount: '', revenue_date: format(new Date(), 'yyyy-MM-dd'),
  due_date: '', category_id: '', notes: '', status: 'received', payment_method: '',
});

const FinanceRevenues = () => {
  const { companyId, user } = useAuth();
  const { maskValue } = useFinancialPrivacy();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => { if (companyId) { fetchRevenues(); fetchCategories(); } }, [companyId]);

  const fetchRevenues = async () => {
    const { data } = await supabase
      .from('company_revenues')
      .select('*, category:company_revenue_categories(name)')
      .eq('company_id', companyId!)
      .order('revenue_date', { ascending: false })
      .limit(200);
    if (data) setRevenues(data);
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('company_revenue_categories').select('*').eq('company_id', companyId!).order('name');
    if (data) setCategories(data);
  };

  const handleSubmit = async () => {
    if (submitting) return;
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    setSubmitting(true);
    try {
      const payload = {
        description: form.description,
        amount: parseFloat(form.amount),
        revenue_date: form.revenue_date,
        due_date: form.due_date || null,
        status: form.status,
        category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
        notes: form.notes || null,
        payment_method: form.payment_method || null,
      };

      if (editingId) {
        const { error } = await supabase.from('company_revenues').update(payload).eq('id', editingId);
        if (error) { toast.error('Erro ao atualizar'); return; }
        toast.success('Receita atualizada');
      } else {
        const { error } = await supabase.from('company_revenues').insert({
          ...payload,
          company_id: companyId!,
          is_automatic: false,
          created_by: user?.id,
        });
        if (error) { toast.error('Erro ao salvar'); return; }
        toast.success('Receita registrada');
      }
      closeDialog();
      fetchRevenues();
    } finally {
      setSubmitting(false);
    }
  };

  const closeDialog = () => {
    setOpen(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      description: r.description,
      amount: String(r.amount),
      revenue_date: r.revenue_date,
      due_date: r.due_date || '',
      category_id: r.category_id || '',
      notes: r.notes || '',
      status: r.status,
      payment_method: r.payment_method || '',
    });
    setOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('company_revenues').delete().eq('id', id);
    toast.success('Receita removida');
    fetchRevenues();
  };

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    const { data, error } = await supabase.from('company_revenue_categories').insert({ company_id: companyId!, name: newCatName.trim() }).select().single();
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
          <h2 className="text-xl font-display font-bold">Receitas</h2>
          <p className="text-sm text-muted-foreground">Receitas automáticas e manuais</p>
        </div>
        <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Receita</Button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-md">
            <DialogHeader><DialogTitle>{editingId ? 'Editar Receita' : 'Nova Receita Manual'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Data</Label><Input type="date" value={form.revenue_date} onChange={e => setForm(f => ({ ...f, revenue_date: e.target.value }))} /></div>
                <div><Label>Vencimento</Label><Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} /></div>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="received">Recebido</SelectItem>
                    <SelectItem value="cancelled">Cancelado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleSubmit} className="w-full" disabled={submitting}>{submitting ? 'Salvando...' : 'Salvar'}</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria de Receita</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Ex: Produtos, Serviços extras" /></div>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead>Pagamento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma receita registrada</TableCell></TableRow>
                ) : revenues.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>{r.description}</TableCell>
                    <TableCell className="text-muted-foreground">{r.category?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={r.is_automatic ? 'default' : 'outline'} className="text-xs">
                        {r.is_automatic ? 'Automática' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{paymentMethodLabels[r.payment_method] || '—'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{statusLabels[r.status] || r.status}</Badge></TableCell>
                    <TableCell className="text-right font-semibold text-success">{maskValue(Number(r.amount))}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {!r.is_automatic && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} title="Editar"><Pencil className="h-4 w-4" /></Button>
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
        {revenues.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma receita registrada</CardContent></Card>
        ) : revenues.map(r => (
          <Card key={r.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className="font-medium text-sm break-words flex-1 min-w-0">{r.description}</span>
                <span className="font-semibold text-sm text-success shrink-0">{maskValue(Number(r.amount))}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mb-2">
                <span>{format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                <span>•</span>
                <span>{r.category?.name || '—'}</span>
                <Badge variant={r.is_automatic ? 'default' : 'outline'} className="text-[10px]">
                  {r.is_automatic ? 'Auto' : 'Manual'}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{statusLabels[r.status] || r.status}</Badge>
              </div>
              {!r.is_automatic && (
                <div className="flex justify-end gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinanceRevenues;
