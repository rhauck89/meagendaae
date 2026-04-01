import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DollarSign, TrendingUp, TrendingDown, Plus, Pencil, Trash2, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface ExpenseCategory { id: string; name: string; description: string | null; type: string; }
interface Expense { id: string; category_id: string | null; description: string; amount: number; expense_date: string; notes: string | null; }
interface ManualRevenue { id: string; description: string; amount: number; revenue_date: string; source: string | null; notes: string | null; }

const SuperAdminFinance = () => {
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [revenues, setRevenues] = useState<ManualRevenue[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<ExpenseCategory | null>(null);
  const [catForm, setCatForm] = useState({ name: '', description: '', type: 'expense' });

  const [expDialogOpen, setExpDialogOpen] = useState(false);
  const [editingExp, setEditingExp] = useState<Expense | null>(null);
  const [expForm, setExpForm] = useState({ category_id: '', description: '', amount: 0, expense_date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  const [revDialogOpen, setRevDialogOpen] = useState(false);
  const [editingRev, setEditingRev] = useState<ManualRevenue | null>(null);
  const [revForm, setRevForm] = useState({ description: '', amount: 0, revenue_date: format(new Date(), 'yyyy-MM-dd'), source: '', notes: '' });

  const [deleteTarget, setDeleteTarget] = useState<{ type: string; id: string } | null>(null);

  const fetchAll = async () => {
    const [catRes, expRes, revRes, compRes] = await Promise.all([
      supabase.from('expense_categories').select('*').order('name'),
      supabase.from('expenses').select('*').order('expense_date', { ascending: false }),
      supabase.from('manual_revenues').select('*').order('revenue_date', { ascending: false }),
      supabase.from('companies').select('id, name, subscription_status, stripe_subscription_id'),
    ]);
    if (catRes.data) setCategories(catRes.data as ExpenseCategory[]);
    if (expRes.data) setExpenses(expRes.data as Expense[]);
    if (revRes.data) setRevenues(revRes.data as ManualRevenue[]);
    if (compRes.data) setCompanies(compRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Metrics
  const totalRevenue = useMemo(() => revenues.reduce((s, r) => s + Number(r.amount), 0), [revenues]);
  const totalExpenses = useMemo(() => expenses.reduce((s, e) => s + Number(e.amount), 0), [expenses]);
  const profit = totalRevenue - totalExpenses;
  const paying = companies.filter(c => c.subscription_status === 'active' && c.stripe_subscription_id).length;

  // Monthly chart data (last 6 months)
  const chartData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const ms = startOfMonth(d);
      const me = endOfMonth(d);
      const label = format(d, 'MMM/yy', { locale: ptBR });
      const monthRevenue = revenues
        .filter(r => new Date(r.revenue_date) >= ms && new Date(r.revenue_date) <= me)
        .reduce((s, r) => s + Number(r.amount), 0);
      const monthExpense = expenses
        .filter(e => new Date(e.expense_date) >= ms && new Date(e.expense_date) <= me)
        .reduce((s, e) => s + Number(e.amount), 0);
      months.push({ name: label, receita: monthRevenue, despesa: monthExpense, lucro: monthRevenue - monthExpense });
    }
    return months;
  }, [revenues, expenses]);

  // Category CRUD
  const saveCat = async () => {
    if (!catForm.name.trim()) { toast.error('Nome obrigatório'); return; }
    if (editingCat) {
      await supabase.from('expense_categories').update({ name: catForm.name, description: catForm.description || null } as any).eq('id', editingCat.id);
      toast.success('Categoria atualizada');
    } else {
      await supabase.from('expense_categories').insert({ name: catForm.name, description: catForm.description || null } as any);
      toast.success('Categoria criada');
    }
    setCatDialogOpen(false);
    fetchAll();
  };

  // Expense CRUD
  const saveExp = async () => {
    if (!expForm.description.trim()) { toast.error('Descrição obrigatória'); return; }
    if (expForm.amount <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    const payload = {
      category_id: expForm.category_id || null,
      description: expForm.description,
      amount: expForm.amount,
      expense_date: expForm.expense_date,
      notes: expForm.notes || null,
    };
    if (editingExp) {
      await supabase.from('expenses').update(payload as any).eq('id', editingExp.id);
      toast.success('Despesa atualizada');
    } else {
      await supabase.from('expenses').insert(payload as any);
      toast.success('Despesa registrada');
    }
    setExpDialogOpen(false);
    fetchAll();
  };

  // Revenue CRUD
  const saveRev = async () => {
    if (!revForm.description.trim()) { toast.error('Descrição obrigatória'); return; }
    if (revForm.amount <= 0) { toast.error('Valor deve ser maior que zero'); return; }
    const payload = {
      description: revForm.description,
      amount: revForm.amount,
      revenue_date: revForm.revenue_date,
      source: revForm.source || null,
      notes: revForm.notes || null,
    };
    if (editingRev) {
      await supabase.from('manual_revenues').update(payload as any).eq('id', editingRev.id);
      toast.success('Receita atualizada');
    } else {
      await supabase.from('manual_revenues').insert(payload as any);
      toast.success('Receita registrada');
    }
    setRevDialogOpen(false);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const table = deleteTarget.type === 'expense' ? 'expenses' : deleteTarget.type === 'revenue' ? 'manual_revenues' : 'expense_categories';
    await supabase.from(table).delete().eq('id', deleteTarget.id);
    toast.success('Registro excluído');
    setDeleteTarget(null);
    fetchAll();
  };

  const formatCurrency = (v: number) => `R$${v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">💰 Financeiro da Plataforma</h2>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingUp className="h-8 w-8 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Receitas</p>
              <p className="text-xl font-display font-bold">{formatCurrency(totalRevenue)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <TrendingDown className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Despesas</p>
              <p className="text-xl font-display font-bold">{formatCurrency(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <DollarSign className={`h-8 w-8 ${profit >= 0 ? 'text-success' : 'text-destructive'}`} />
            <div>
              <p className="text-sm text-muted-foreground">Lucro</p>
              <p className="text-xl font-display font-bold">{formatCurrency(profit)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5 flex items-center gap-4">
            <DollarSign className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm text-muted-foreground">Assinantes</p>
              <p className="text-xl font-display font-bold">{paying}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">📊 Receitas vs Despesas (últimos 6 meses)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="expenses">
        <TabsList>
          <TabsTrigger value="expenses">Despesas</TabsTrigger>
          <TabsTrigger value="revenues">Receitas</TabsTrigger>
          <TabsTrigger value="categories">Categorias</TabsTrigger>
        </TabsList>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingExp(null); setExpForm({ category_id: '', description: '', amount: 0, expense_date: format(new Date(), 'yyyy-MM-dd'), notes: '' }); setExpDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Despesa
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma despesa</TableCell></TableRow>
                    ) : expenses.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium text-sm">{e.description}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {categories.find(c => c.id === e.category_id)?.name || '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-destructive font-medium">{formatCurrency(Number(e.amount))}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(e.expense_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setEditingExp(e);
                              setExpForm({ category_id: e.category_id || '', description: e.description, amount: Number(e.amount), expense_date: e.expense_date, notes: e.notes || '' });
                              setExpDialogOpen(true);
                            }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: 'expense', id: e.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Revenues Tab */}
        <TabsContent value="revenues" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingRev(null); setRevForm({ description: '', amount: 0, revenue_date: format(new Date(), 'yyyy-MM-dd'), source: '', notes: '' }); setRevDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Receita
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="hidden md:table-cell">Data</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revenues.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="text-center py-6 text-muted-foreground">Nenhuma receita</TableCell></TableRow>
                    ) : revenues.map(r => (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium text-sm">{r.description}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.source || '—'}</TableCell>
                        <TableCell className="text-success font-medium">{formatCurrency(Number(r.amount))}</TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{format(new Date(r.revenue_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setEditingRev(r);
                              setRevForm({ description: r.description, amount: Number(r.amount), revenue_date: r.revenue_date, source: r.source || '', notes: r.notes || '' });
                              setRevDialogOpen(true);
                            }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: 'revenue', id: r.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Categories Tab */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => { setEditingCat(null); setCatForm({ name: '', description: '' }); setCatDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Nova Categoria
            </Button>
          </div>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="w-[80px]">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.length === 0 ? (
                      <TableRow><TableCell colSpan={3} className="text-center py-6 text-muted-foreground">Nenhuma categoria</TableCell></TableRow>
                    ) : categories.map(c => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.description || '—'}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                              setEditingCat(c);
                              setCatForm({ name: c.name, description: c.description || '' });
                              setCatDialogOpen(true);
                            }}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTarget({ type: 'category', id: c.id })}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Category Dialog */}
      <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input value={catForm.name} onChange={e => setCatForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={catForm.description} onChange={e => setCatForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveCat}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Expense Dialog */}
      <Dialog open={expDialogOpen} onOpenChange={setExpDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingExp ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={expForm.description} onChange={e => setExpForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" min={0} step={0.01} value={expForm.amount} onChange={e => setExpForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={expForm.expense_date} onChange={e => setExpForm(f => ({ ...f, expense_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Categoria</Label>
              <Select value={expForm.category_id} onValueChange={v => setExpForm(f => ({ ...f, category_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={expForm.notes} onChange={e => setExpForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveExp}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revenue Dialog */}
      <Dialog open={revDialogOpen} onOpenChange={setRevDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingRev ? 'Editar Receita' : 'Nova Receita'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Input value={revForm.description} onChange={e => setRevForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="number" min={0} step={0.01} value={revForm.amount} onChange={e => setRevForm(f => ({ ...f, amount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input type="date" value={revForm.revenue_date} onChange={e => setRevForm(f => ({ ...f, revenue_date: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Fonte</Label>
              <Input value={revForm.source} onChange={e => setRevForm(f => ({ ...f, source: e.target.value }))} placeholder="Ex: Stripe, Manual, Outro" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Observações</Label>
              <Textarea value={revForm.notes} onChange={e => setRevForm(f => ({ ...f, notes: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevDialogOpen(false)}>Cancelar</Button>
            <Button onClick={saveRev}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Confirmar exclusão?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminFinance;
