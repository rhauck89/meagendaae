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
import { Plus, Trash2, Pencil, Filter, X, ChevronUp, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CategoryBadgeEditor from '@/components/finance/CategoryBadgeEditor';

const statusLabels: Record<string, string> = { pending: 'Pendente', received: 'Recebido', cancelled: 'Cancelado' };

const paymentMethodLabels: Record<string, string> = { 
  dinheiro: 'Dinheiro', 
  pix: 'Pix', 
  cartao: 'Cartão', 
  cartao_credito: 'Cartão de Crédito', 
  cartao_debito: 'Cartão de Débito', 
  transferencia: 'Transferência', 
  outro: 'Outro' 
};

const emptyForm = () => ({
  description: '', amount: '', revenue_date: format(new Date(), 'yyyy-MM-dd'),
  due_date: '', category_id: '', notes: '', status: 'received', payment_method: '',
  client_name: '', professional_name: '', service_name: ''
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
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterClient, setFilterClient] = useState('');
  const [filterProfessional, setFilterProfessional] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [filterType, setFilterType] = useState('all');
  const [sortField, setSortField] = useState('revenue_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => { 
    if (companyId) { 
      fetchRevenues(); 
      fetchCategories(); 
    } 
  }, [companyId, filterCategory, filterClient, filterProfessional, filterService, filterPayment, filterType, sortField, sortDirection]);

  const fetchRevenues = async () => {
    let query = supabase
      .from('company_revenues')
      .select('*, category:company_revenue_categories(name)')
      .eq('company_id', companyId!)
      .order(sortField, { ascending: sortDirection === 'asc' });

    if (filterCategory !== 'all') {
      query = query.eq('category_id', filterCategory);
    }
    if (filterPayment !== 'all') {
      query = query.eq('payment_method', filterPayment);
    }
    if (filterType !== 'all') {
      query = query.eq('is_automatic', filterType === 'automatic');
    }
    if (filterClient) {
      query = query.ilike('client_name', `%${filterClient}%`);
    }
    if (filterProfessional) {
      query = query.ilike('professional_name', `%${filterProfessional}%`);
    }
    if (filterService) {
      query = query.ilike('service_name', `%${filterService}%`);
    }

    const { data } = await query.limit(200);
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
        client_name: form.client_name || (form.description.includes(' — ') ? form.description.split(' — ')[0] : form.description),
        professional_name: form.professional_name || null,
        service_name: form.service_name || (form.description.includes(' — ') ? form.description.split(' — ')[1] : null),
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
      client_name: r.client_name || '',
      professional_name: r.professional_name || '',
      service_name: r.service_name || '',
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
        <div className="flex gap-2 w-full sm:w-auto">
          <Dialog open={open} onOpenChange={v => { if (!v) closeDialog(); else setOpen(true); }}>
            <DialogTrigger asChild>
              <Button className="flex-1 sm:flex-none"><Plus className="h-4 w-4 mr-2" /> Nova Receita</Button>
            </DialogTrigger>
            <DialogContent className="w-[92vw] max-w-md">
              <DialogHeader><DialogTitle>{editingId ? 'Editar Receita' : 'Nova Receita Manual'}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>Descrição / Título</Label><Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Ex: Venda de produto" /></div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div><Label>Cliente</Label><Input value={form.client_name} onChange={e => setForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Nome do cliente" /></div>
                  <div><Label>Profissional</Label><Input value={form.professional_name} onChange={e => setForm(f => ({ ...f, professional_name: e.target.value }))} placeholder="Responsável" /></div>
                  <div><Label>Serviço / Item</Label><Input value={form.service_name} onChange={e => setForm(f => ({ ...f, service_name: e.target.value }))} placeholder="O que foi vendido" /></div>
                </div>
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
                  <div className="flex items-center justify-between mb-1 mt-4">
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
      </div>

      {/* Filters */}
      <Card className="bg-muted/30 border-none shadow-none">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground shrink-0">
              <Filter className="h-4 w-4" />
              <span>Filtrar:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button 
                variant={filterCategory === 'all' ? 'default' : 'outline'} 
                size="sm"
                className="rounded-full h-8 text-xs px-4"
                onClick={() => setFilterCategory('all')}
              >
                Todos
              </Button>
              {categories.map(cat => (
                <Button
                  key={cat.id}
                  variant={filterCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  className="rounded-full h-8 text-xs px-4"
                  onClick={() => setFilterCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
              {filterCategory !== 'all' && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-2 text-muted-foreground"
                  onClick={() => setFilterCategory('all')}
                >
                  <X className="h-4 w-4 mr-1" /> Limpar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

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
            <Table className="min-w-[1000px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => {
                    if (sortField === 'revenue_date') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('revenue_date'); setSortDirection('desc'); }
                  }}>
                    <div className="flex items-center gap-1">
                      Data {sortField === 'revenue_date' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2 py-2">
                      <span className="text-xs font-semibold">Cliente</span>
                      <Input 
                        placeholder="Filtrar..." 
                        value={filterClient} 
                        onChange={e => setFilterClient(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2 py-2">
                      <span className="text-xs font-semibold">Profissional</span>
                      <Input 
                        placeholder="Filtrar..." 
                        value={filterProfessional} 
                        onChange={e => setFilterProfessional(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2 py-2">
                      <span className="text-xs font-semibold">Serviço</span>
                      <Input 
                        placeholder="Filtrar..." 
                        value={filterService} 
                        onChange={e => setFilterService(e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>
                    <div className="space-y-2 py-2">
                      <span className="text-xs font-semibold">Tipo</span>
                      <Select value={filterType || 'all'} onValueChange={setFilterType}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="automatic">Automática</SelectItem>
                          <SelectItem value="manual">Manual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead>
                    <div className="space-y-2 py-2">
                      <span className="text-xs font-semibold">Pagamento</span>
                      <Select value={filterPayment} onValueChange={setFilterPayment}>
                        <SelectTrigger className="h-7 text-xs">
                          <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {Object.entries(paymentMethodLabels).map(([val, label]) => (
                            <SelectItem key={val} value={val}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </TableHead>
                  <TableHead className="text-right cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => {
                    if (sortField === 'amount') setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
                    else { setSortField('amount'); setSortDirection('desc'); }
                  }}>
                    <div className="flex items-center justify-end gap-1">
                      Valor {sortField === 'amount' && (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
                    </div>
                  </TableHead>
                  <TableHead className="w-20">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revenues.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Nenhuma receita encontrada</TableCell></TableRow>
                ) : revenues.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">{format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <div className="font-medium truncate max-w-[120px]" title={r.client_name}>
                        {r.client_name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs truncate max-w-[120px]" title={r.professional_name}>
                        {r.professional_name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs truncate max-w-[150px]" title={r.service_name}>
                        {r.service_name || '—'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <CategoryBadgeEditor 
                        revenueId={r.id}
                        companyId={companyId!}
                        currentCategoryId={r.category_id}
                        currentCategoryName={r.category?.name}
                        onUpdate={fetchRevenues}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.is_automatic ? 'default' : 'outline'} className="text-[10px] uppercase font-bold tracking-tight px-1.5 py-0">
                        {r.is_automatic ? 'Automática' : 'Manual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{paymentMethodLabels[r.payment_method] || '—'}</TableCell>
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
      <div className="md:hidden space-y-3 pb-20">
        <div className="flex flex-col gap-2 mb-4">
          <Input 
            placeholder="Pesquisar cliente..." 
            value={filterClient} 
            onChange={e => setFilterClient(e.target.value)}
            className="h-10"
          />
          <div className="grid grid-cols-2 gap-2">
            <Select value={filterPayment} onValueChange={setFilterPayment}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Pagamentos</SelectItem>
                {Object.entries(paymentMethodLabels).map(([val, label]) => (
                  <SelectItem key={val} value={val}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas Categorias</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {revenues.length === 0 ? (
          <Card><CardContent className="p-6 text-center text-muted-foreground">Nenhuma receita encontrada</CardContent></Card>
        ) : revenues.map(r => (
          <Card key={r.id} className="overflow-hidden border-none shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="space-y-1 min-w-0">
                  <div className="font-semibold text-sm break-words line-clamp-1">{r.client_name || 'Manual'}</div>
                  <div className="text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="font-medium text-foreground/80">{r.service_name}</span>
                    <span>•</span>
                    <span>{format(new Date(r.revenue_date + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground italic truncate">
                    Prof: {r.professional_name || '—'}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-bold text-success text-sm">{maskValue(Number(r.amount))}</div>
                  <Badge variant={r.is_automatic ? 'default' : 'outline'} className="text-[9px] px-1 py-0 h-4 uppercase mt-1">
                    {r.is_automatic ? 'AUTO' : 'MANUAL'}
                  </Badge>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-dashed">
                <div className="flex items-center gap-2">
                  <CategoryBadgeEditor 
                    revenueId={r.id}
                    companyId={companyId!}
                    currentCategoryId={r.category_id}
                    currentCategoryName={r.category?.name}
                    onUpdate={fetchRevenues}
                  />
                  <span className="text-[10px] text-muted-foreground">{paymentMethodLabels[r.payment_method] || ''}</span>
                </div>
                
                {!r.is_automatic && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive/70" onClick={() => handleDelete(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinanceRevenues;
