import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  yearly_price: number;
  yearly_discount: number;
  members_limit: number;
  automatic_messages: boolean;
  open_scheduling: boolean;
  promotions: boolean;
  discount_coupons: boolean;
  whitelabel: boolean;
  active: boolean;
  sort_order: number;
}

const emptyPlan: Omit<Plan, 'id'> = {
  name: '',
  monthly_price: 0,
  yearly_price: 0,
  yearly_discount: 0,
  members_limit: 1,
  automatic_messages: false,
  open_scheduling: false,
  promotions: false,
  discount_coupons: false,
  whitelabel: false,
  active: true,
  sort_order: 0,
};

const featureLabels: { key: keyof Pick<Plan, 'automatic_messages' | 'open_scheduling' | 'promotions' | 'discount_coupons' | 'whitelabel'>; label: string }[] = [
  { key: 'automatic_messages', label: 'Mensagens Automáticas' },
  { key: 'open_scheduling', label: 'Agendamento Aberto' },
  { key: 'promotions', label: 'Promoções' },
  { key: 'discount_coupons', label: 'Cupons de Desconto' },
  { key: 'whitelabel', label: 'Whitelabel' },
];

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<Omit<Plan, 'id'>>(emptyPlan);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (data) setPlans(data as unknown as Plan[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const openCreate = () => {
    setEditingPlan(null);
    setForm({ ...emptyPlan, sort_order: plans.length });
    setDialogOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setEditingPlan(plan);
    const { id, ...rest } = plan;
    setForm(rest);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome é obrigatório'); return; }
    if (form.price < 0) { toast.error('Preço inválido'); return; }

    if (editingPlan) {
      const { error } = await supabase.from('plans').update(form as any).eq('id', editingPlan.id);
      if (error) { toast.error('Erro ao atualizar plano'); return; }
      toast.success('Plano atualizado');
    } else {
      const { error } = await supabase.from('plans').insert(form as any);
      if (error) { toast.error('Erro ao criar plano'); return; }
      toast.success('Plano criado');
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('plans').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir plano. Pode estar vinculado a empresas.'); return; }
    toast.success('Plano excluído');
    setDeleteConfirm(null);
    fetchPlans();
  };

  const toggleActive = async (plan: Plan) => {
    await supabase.from('plans').update({ active: !plan.active } as any).eq('id', plan.id);
    fetchPlans();
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-display font-semibold flex items-center gap-2">
          <CreditCard className="h-5 w-5" /> Planos
        </h2>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo Plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum plano cadastrado. Crie o primeiro plano.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Preço</TableHead>
                    <TableHead className="hidden md:table-cell">Membros</TableHead>
                    <TableHead className="hidden lg:table-cell">Recursos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow key={plan.id}>
                      <TableCell className="font-medium">{plan.name}</TableCell>
                      <TableCell>
                        R${Number(plan.price).toFixed(2).replace('.', ',')}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{plan.members_limit}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {plan.automatic_messages && <Badge variant="outline" className="text-xs">Mensagens</Badge>}
                          {plan.open_scheduling && <Badge variant="outline" className="text-xs">Agendamento</Badge>}
                          {plan.promotions && <Badge variant="outline" className="text-xs">Promoções</Badge>}
                          {plan.discount_coupons && <Badge variant="outline" className="text-xs">Cupons</Badge>}
                          {plan.whitelabel && <Badge variant="outline" className="text-xs">Whitelabel</Badge>}
                          {!plan.automatic_messages && !plan.open_scheduling && !plan.promotions && !plan.discount_coupons && !plan.whitelabel && (
                            <span className="text-xs text-muted-foreground">Básico</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-xs cursor-pointer ${plan.active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}
                          onClick={() => toggleActive(plan)}
                        >
                          {plan.active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteConfirm(plan.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome do plano</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Profissional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Preço mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Limite de membros</Label>
                <Input type="number" min={1} value={form.members_limit} onChange={(e) => setForm(f => ({ ...f, members_limit: parseInt(e.target.value) || 1 }))} />
              </div>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label className="text-xs text-muted-foreground">Recursos inclusos</Label>
              {featureLabels.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <Label className="text-sm">{label}</Label>
                  <Switch
                    checked={form[key] as boolean}
                    onCheckedChange={(v) => setForm(f => ({ ...f, [key]: v }))}
                  />
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t">
              <Label className="text-sm">Plano ativo</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm(f => ({ ...f, active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>{editingPlan ? 'Salvar' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir plano?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita. Planos vinculados a empresas não podem ser excluídos.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminPlans;
