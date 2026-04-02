import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
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
import { Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const FinanceRevenues = () => {
  const { companyId, user } = useAuth();
  const [revenues, setRevenues] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [form, setForm] = useState({ description: '', amount: '', revenue_date: format(new Date(), 'yyyy-MM-dd'), category_id: '', notes: '' });

  useEffect(() => {
    if (companyId) { fetchRevenues(); fetchCategories(); }
  }, [companyId]);

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
    const { data } = await supabase
      .from('company_revenue_categories')
      .select('*')
      .eq('company_id', companyId!)
      .order('name');
    if (data) setCategories(data);
  };

  const handleSubmit = async () => {
    if (!form.description || !form.amount) { toast.error('Preencha descrição e valor'); return; }
    const { error } = await supabase.from('company_revenues').insert({
      company_id: companyId!,
      description: form.description,
      amount: parseFloat(form.amount),
      revenue_date: form.revenue_date,
      category_id: form.category_id && form.category_id !== 'none' ? form.category_id : null,
      is_automatic: false,
      notes: form.notes || null,
      created_by: user?.id,
    });
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Receita registrada');
    setOpen(false);
    setForm({ description: '', amount: '', revenue_date: format(new Date(), 'yyyy-MM-dd'), category_id: '', notes: '' });
    fetchRevenues();
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Receita</Button>
          </DialogTrigger>
          <DialogContent className="w-[92vw] max-w-md">
            <DialogHeader><DialogTitle>Nova Receita Manual</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div><Label>Descrição</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div><Label>Valor (R$)</Label><Input type="number" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
              <div><Label>Data</Label><Input type="date" value={form.revenue_date} onChange={e => setForm(f => ({ ...f, revenue_date: e.target.value }))} /></div>
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
              <div><Label>Observações</Label><Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} /></div>
              <Button onClick={handleSubmit} className="w-full">Salvar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inline category creation dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="w-[92vw] max-w-sm">
          <DialogHeader><DialogTitle>Nova Categoria de Receita</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="Ex: Produtos, Serviços extras" /></div>
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
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma receita registrada</TableCell></TableRow>
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
                    <TableCell className="text-right font-semibold text-success">R$ {Number(r.amount).toFixed(2)}</TableCell>
                    <TableCell>
                      {!r.is_automatic && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
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

export default FinanceRevenues;
