import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus, Pencil, Copy, ArrowUp, ArrowDown, CreditCard, Crown, Star, Check, Power,
} from 'lucide-react';
import { toast } from 'sonner';

interface Plan {
  id: string;
  slug: string | null;
  name: string;
  badge: string | null;
  monthly_price: number;
  yearly_price: number;
  yearly_discount: number;
  members_limit: number;
  marketplace_priority: number;
  // base feature flags
  automatic_messages: boolean;
  open_scheduling: boolean;
  promotions: boolean;
  discount_coupons: boolean;
  whitelabel: boolean;
  feature_requests: boolean;
  feature_financial_level: string;
  custom_branding: boolean;
  // new feature flags
  cashback: boolean;
  loyalty: boolean;
  open_agenda: boolean;
  automation: boolean;
  monthly_reports: boolean;
  advanced_reports: boolean;
  whatsapp_default: boolean;
  premium_templates: boolean;
  custom_domain: boolean;
  custom_colors: boolean;
  support_priority: boolean;
  multi_location_ready: boolean;
  active: boolean;
  sort_order: number;
}

const emptyPlan: Omit<Plan, 'id'> = {
  slug: '',
  name: '',
  badge: null,
  monthly_price: 0,
  yearly_price: 0,
  yearly_discount: 0,
  members_limit: 1,
  marketplace_priority: 0,
  automatic_messages: false,
  open_scheduling: false,
  promotions: false,
  discount_coupons: false,
  whitelabel: false,
  feature_requests: false,
  feature_financial_level: 'none',
  custom_branding: false,
  cashback: false,
  loyalty: false,
  open_agenda: false,
  automation: false,
  monthly_reports: false,
  advanced_reports: false,
  whatsapp_default: false,
  premium_templates: false,
  custom_domain: false,
  custom_colors: false,
  support_priority: false,
  multi_location_ready: false,
  active: true,
  sort_order: 0,
};

const featureGroups: Array<{ title: string; items: Array<{ key: keyof Plan; label: string }> }> = [
  {
    title: 'Agenda & operação',
    items: [
      { key: 'open_scheduling', label: 'Agendamento aberto' },
      { key: 'open_agenda', label: 'Agenda Aberta (eventos)' },
      { key: 'feature_requests', label: 'Solicitações de horário' },
      { key: 'automation', label: 'Automações' },
      { key: 'automatic_messages', label: 'Mensagens automáticas' },
      { key: 'whatsapp_default', label: 'WhatsApp padrão' },
    ],
  },
  {
    title: 'Engajamento & retenção',
    items: [
      { key: 'promotions', label: 'Promoções' },
      { key: 'cashback', label: 'Cashback' },
      { key: 'loyalty', label: 'Programa de Fidelidade' },
      { key: 'discount_coupons', label: 'Cupons de desconto' },
    ],
  },
  {
    title: 'Marca & marketplace',
    items: [
      { key: 'premium_templates', label: 'Templates premium' },
      { key: 'custom_branding', label: 'Identidade personalizada' },
      { key: 'custom_colors', label: 'Cores personalizadas' },
      { key: 'custom_domain', label: 'Domínio próprio' },
      { key: 'whitelabel', label: 'Whitelabel completo' },
    ],
  },
  {
    title: 'Relatórios & suporte',
    items: [
      { key: 'monthly_reports', label: 'Relatório mensal' },
      { key: 'advanced_reports', label: 'Relatórios avançados' },
      { key: 'support_priority', label: 'Suporte prioritário' },
      { key: 'multi_location_ready', label: 'Multi-localização' },
    ],
  },
];

const slugify = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const formatBRL = (n: number) =>
  `R$${Number(n || 0).toFixed(2).replace('.', ',')}`;

const SuperAdminPlans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [form, setForm] = useState<Omit<Plan, 'id'>>(emptyPlan);

  const fetchPlans = async () => {
    const { data, error } = await supabase
      .from('plans')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) toast.error('Erro ao carregar planos');
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
    if (form.monthly_price < 0) { toast.error('Preço inválido'); return; }
    const payload = { ...form, slug: form.slug?.trim() ? form.slug.trim() : slugify(form.name) };

    if (editingPlan) {
      const { error } = await supabase.from('plans').update(payload as any).eq('id', editingPlan.id);
      if (error) { toast.error('Erro ao atualizar plano'); return; }
      toast.success('Plano atualizado');
    } else {
      const { error } = await supabase.from('plans').insert(payload as any);
      if (error) { toast.error(error.message.includes('duplicate') ? 'Já existe um plano com esse identificador' : 'Erro ao criar plano'); return; }
      toast.success('Plano criado');
    }
    setDialogOpen(false);
    fetchPlans();
  };

  const toggleActive = async (plan: Plan) => {
    const { error } = await supabase.from('plans').update({ active: !plan.active } as any).eq('id', plan.id);
    if (error) toast.error('Erro ao atualizar');
    else { toast.success(plan.active ? 'Plano desativado' : 'Plano ativado'); fetchPlans(); }
  };

  const duplicatePlan = async (plan: Plan) => {
    const { id, ...rest } = plan;
    const baseSlug = (plan.slug || slugify(plan.name)) + '-copia';
    const payload = {
      ...rest,
      name: `${plan.name} (cópia)`,
      slug: baseSlug,
      active: false,
      sort_order: plans.length,
    };
    const { error } = await supabase.from('plans').insert(payload as any);
    if (error) {
      toast.error('Erro ao duplicar plano');
    } else {
      toast.success('Plano duplicado');
      fetchPlans();
    }
  };

  const movePlan = async (plan: Plan, direction: -1 | 1) => {
    const idx = plans.findIndex(p => p.id === plan.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= plans.length) return;
    const other = plans[swapIdx];
    const updates = [
      supabase.from('plans').update({ sort_order: other.sort_order } as any).eq('id', plan.id),
      supabase.from('plans').update({ sort_order: plan.sort_order } as any).eq('id', other.id),
    ];
    await Promise.all(updates);
    fetchPlans();
  };

  const getEnabledFeatures = (plan: Plan) => {
    const out: string[] = [];
    featureGroups.forEach(g => g.items.forEach(it => {
      if (plan[it.key]) out.push(it.label);
    }));
    if (plan.feature_financial_level === 'basic') out.push('Financeiro básico');
    if (plan.feature_financial_level === 'full') out.push('Financeiro completo');
    return out;
  };

  const planAccent = (plan: Plan) => {
    if (plan.slug === 'elite' || plan.badge?.toUpperCase().includes('PREMIUM')) {
      return 'border-amber-500/40 bg-gradient-to-br from-amber-500/5 to-transparent';
    }
    if (plan.slug === 'studio' || plan.badge?.toUpperCase().includes('VENDIDO')) {
      return 'border-primary/50 bg-gradient-to-br from-primary/5 to-transparent ring-1 ring-primary/20';
    }
    return '';
  };

  const planIcon = (plan: Plan) => {
    if (plan.slug === 'elite') return <Crown className="h-5 w-5 text-amber-500" />;
    if (plan.slug === 'studio') return <Star className="h-5 w-5 text-primary" />;
    return <CreditCard className="h-5 w-5 text-muted-foreground" />;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-display font-semibold flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Planos comerciais
          </h2>
          <p className="text-sm text-muted-foreground">Gerencie os planos exibidos para empresas e marketplace.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo plano
        </Button>
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum plano cadastrado. Crie o primeiro plano.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map((plan, idx) => {
            const features = getEnabledFeatures(plan);
            return (
              <Card key={plan.id} className={`relative flex flex-col ${planAccent(plan)}`}>
                {plan.badge && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground shadow">
                    {plan.badge}
                  </Badge>
                )}
                <CardContent className="p-5 flex flex-col gap-4 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {planIcon(plan)}
                      <div>
                        <p className="font-display font-semibold text-lg leading-tight">{plan.name}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">{plan.slug || '—'}</p>
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] cursor-pointer ${plan.active ? 'bg-success/10 text-success border-success/30' : 'bg-muted text-muted-foreground'}`}
                      onClick={() => toggleActive(plan)}
                    >
                      {plan.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold">{formatBRL(plan.monthly_price)}</span>
                      <span className="text-sm text-muted-foreground">/mês</span>
                    </div>
                    {Number(plan.yearly_price) > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        ou {formatBRL(plan.yearly_price)}/ano
                        {Number(plan.yearly_discount) > 0 && (
                          <span className="ml-1 text-success">(-{plan.yearly_discount}%)</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                      <p className="text-[10px] text-muted-foreground">Membros</p>
                      <p className="font-medium">{plan.members_limit === 0 ? 'Ilimitado' : plan.members_limit}</p>
                    </div>
                    <div className="rounded-md bg-muted/50 px-2 py-1.5">
                      <p className="text-[10px] text-muted-foreground">Destaque marketplace</p>
                      <p className="font-medium">{['Básico', 'Médio', 'Máximo'][plan.marketplace_priority] || plan.marketplace_priority}</p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-1 overflow-hidden">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium">Recursos</p>
                    {features.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Apenas recursos básicos</p>
                    ) : (
                      <ul className="space-y-1">
                        {features.slice(0, 6).map(f => (
                          <li key={f} className="flex items-center gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-success shrink-0" />
                            <span className="truncate">{f}</span>
                          </li>
                        ))}
                        {features.length > 6 && (
                          <li className="text-xs text-muted-foreground">+{features.length - 6} outros</li>
                        )}
                      </ul>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-1 pt-3 border-t">
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === 0} onClick={() => movePlan(plan, -1)} title="Mover para cima">
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" disabled={idx === plans.length - 1} onClick={() => movePlan(plan, 1)} title="Mover para baixo">
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicatePlan(plan)} title="Duplicar">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(plan)} title={plan.active ? 'Desativar' : 'Ativar'}>
                        <Power className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="outline" size="sm" className="h-7" onClick={() => openEdit(plan)}>
                        <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do plano</Label>
                <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value, slug: f.slug || slugify(e.target.value) }))} placeholder="Ex: Studio" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Identificador (slug)</Label>
                <Input value={form.slug ?? ''} onChange={(e) => setForm(f => ({ ...f, slug: slugify(e.target.value) }))} placeholder="studio" />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Mensal (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.monthly_price} onChange={(e) => setForm(f => ({ ...f, monthly_price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Anual (R$)</Label>
                <Input type="number" min={0} step={0.01} value={form.yearly_price} onChange={(e) => setForm(f => ({ ...f, yearly_price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Desconto anual (%)</Label>
                <Input type="number" min={0} max={100} step={0.01} value={form.yearly_discount} onChange={(e) => setForm(f => ({ ...f, yearly_discount: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Membros (0=ilim.)</Label>
                <Input type="number" min={0} value={form.members_limit} onChange={(e) => setForm(f => ({ ...f, members_limit: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Badge (opcional)</Label>
                <Input value={form.badge ?? ''} onChange={(e) => setForm(f => ({ ...f, badge: e.target.value || null }))} placeholder="Ex: MAIS VENDIDO" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Destaque marketplace</Label>
                <Select value={String(form.marketplace_priority)} onValueChange={(v) => setForm(f => ({ ...f, marketplace_priority: parseInt(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Básico</SelectItem>
                    <SelectItem value="1">Médio</SelectItem>
                    <SelectItem value="2">Máximo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Financeiro</Label>
              <Select value={form.feature_financial_level} onValueChange={(v) => setForm(f => ({ ...f, feature_financial_level: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem acesso</SelectItem>
                  <SelectItem value="basic">Relatório geral</SelectItem>
                  <SelectItem value="full">Financeiro completo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {featureGroups.map(g => (
              <div key={g.title} className="space-y-2 pt-2 border-t">
                <Label className="text-xs text-muted-foreground uppercase tracking-wide">{g.title}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                  {g.items.map(it => (
                    <div key={String(it.key)} className="flex items-center justify-between">
                      <Label className="text-sm">{it.label}</Label>
                      <Switch
                        checked={Boolean(form[it.key])}
                        onCheckedChange={(v) => setForm(f => ({ ...f, [it.key]: v }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}

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
    </div>
  );
};

export default SuperAdminPlans;
