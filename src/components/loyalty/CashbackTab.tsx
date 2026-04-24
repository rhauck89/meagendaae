import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Plus, Pencil, Trash2, Wallet, Pause, Play, Calendar, Search, History, Users, Settings2, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';


interface CashbackRule {
  id: string;
  title: string;
  description: string | null;
  service_id: string | null;
  service_ids: string[] | null;
  discount_type: string;
  discount_value: number | null;
  cashback_validity_days: number | null;
  cashback_rules_text: string | null;
  cashback_cumulative: boolean;
  start_date: string;
  end_date: string;
  status: string;
  created_at: string;
}

interface ClientBalance {
  client_id: string;
  client_name: string;
  total_active: number;
}

export default function CashbackTab() {
  const { companyId } = useAuth();
  const [rules, setRules] = useState<CashbackRule[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [balances, setBalances] = useState<ClientBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CashbackRule | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [serviceMode, setServiceMode] = useState<'all' | 'specific'>('all');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed_amount'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [validityDays, setValidityDays] = useState('30');
  const [rulesText, setRulesText] = useState('');
  const [cumulative, setCumulative] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchRules = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    const { data } = await supabase
      .from('promotions')
      .select('*')
      .eq('company_id', companyId)
      .eq('promotion_type', 'cashback')
      .order('created_at', { ascending: false });
    if (data) setRules(data as unknown as CashbackRule[]);
    setLoading(false);
  }, [companyId]);

  const fetchServices = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('services')
      .select('id, name')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name');
    if (data) setServices(data);
  }, [companyId]);

  const fetchBalances = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('client_cashback')
      .select('client_id, amount, status, expires_at, clients:client_id(name)')
      .eq('company_id', companyId)
      .eq('status', 'active');
    if (data) {
      const now = new Date();
      const map = new Map<string, ClientBalance>();
      (data as any[]).forEach(c => {
        if (c.expires_at && new Date(c.expires_at) < now) return;
        const existing = map.get(c.client_id);
        if (existing) {
          existing.total_active += Number(c.amount || 0);
        } else {
          map.set(c.client_id, {
            client_id: c.client_id,
            client_name: c.clients?.name || 'Cliente',
            total_active: Number(c.amount || 0),
          });
        }
      });
      setBalances(Array.from(map.values()).sort((a, b) => b.total_active - a.total_active));
    }
  }, [companyId]);

  useEffect(() => {
    fetchRules();
    fetchServices();
    fetchBalances();
  }, [fetchRules, fetchServices, fetchBalances]);

  const resetForm = () => {
    setEditing(null);
    setTitle('');
    setDescription('');
    setServiceMode('all');
    setSelectedServiceIds([]);
    setDiscountType('percentage');
    setDiscountValue('');
    setValidityDays('30');
    setRulesText('');
    setCumulative(false);
    setStartDate('');
    setEndDate('');
  };

  const openNew = () => {
    resetForm();
    const today = new Date();
    const oneYear = new Date();
    oneYear.setFullYear(oneYear.getFullYear() + 1);
    setStartDate(format(today, 'yyyy-MM-dd'));
    setEndDate(format(oneYear, 'yyyy-MM-dd'));
    setDialogOpen(true);
  };

  const openEdit = (rule: CashbackRule) => {
    setEditing(rule);
    setTitle(rule.title);
    setDescription(rule.description || '');
    const ids = rule.service_ids && rule.service_ids.length > 0
      ? rule.service_ids
      : (rule.service_id ? [rule.service_id] : []);
    setServiceMode(ids.length > 0 ? 'specific' : 'all');
    setSelectedServiceIds(ids);
    setDiscountType((rule.discount_type === 'fixed_amount' ? 'fixed_amount' : 'percentage'));
    setDiscountValue(rule.discount_value != null ? String(rule.discount_value) : '');
    setValidityDays(String(rule.cashback_validity_days ?? 30));
    setRulesText(rule.cashback_rules_text || '');
    setCumulative(!!rule.cashback_cumulative);
    setStartDate(rule.start_date);
    setEndDate(rule.end_date);
    setDialogOpen(true);
  };

  const save = async () => {
    if (!companyId) return;
    if (!title.trim()) return toast.error('Informe o título');
    const val = parseFloat(discountValue);
    if (!val || val <= 0) return toast.error('Informe o valor do cashback');
    if (discountType === 'percentage' && val >= 100) return toast.error('Percentual deve ser menor que 100%');
    if (serviceMode === 'specific' && selectedServiceIds.length === 0) return toast.error('Selecione ao menos um serviço');
    if (!startDate || !endDate) return toast.error('Informe o período de validade da regra');

    const ids = serviceMode === 'specific' ? selectedServiceIds : [];

    const payload: any = {
      company_id: companyId,
      title,
      description: description || null,
      promotion_type: 'cashback',
      service_id: ids[0] || null,
      service_ids: ids.length > 1 ? ids : null,
      discount_type: discountType,
      discount_value: val,
      promotion_price: null,
      original_price: null,
      cashback_validity_days: parseInt(validityDays) || 30,
      cashback_rules_text: rulesText || null,
      cashback_cumulative: cumulative,
      start_date: startDate,
      end_date: endDate,
      start_time: null,
      end_time: null,
      max_slots: 0,
      client_filter: 'all',
      professional_filter: 'all',
      status: editing?.status || 'active',
    };

    if (editing) {
      const { error } = await supabase.from('promotions').update(payload).eq('id', editing.id);
      if (error) return toast.error('Erro ao salvar: ' + error.message);
      toast.success('Regra atualizada');
    } else {
      const slug = title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const { error } = await supabase.from('promotions').insert({ ...payload, slug: `${slug}-${Date.now()}` });
      if (error) return toast.error('Erro ao criar: ' + error.message);
      toast.success('Regra de cashback criada');
    }
    setDialogOpen(false);
    resetForm();
    fetchRules();
  };

  const toggleStatus = async (rule: CashbackRule) => {
    const newStatus = rule.status === 'active' ? 'paused' : 'active';
    await supabase.from('promotions').update({ status: newStatus }).eq('id', rule.id);
    toast.success(newStatus === 'active' ? 'Regra ativada' : 'Regra pausada');
    fetchRules();
  };

  const remove = async (rule: CashbackRule) => {
    if (!confirm(`Excluir a regra "${rule.title}"? Saldos de clientes já gerados não serão afetados.`)) return;
    const { error } = await supabase.from('promotions').delete().eq('id', rule.id);
    if (error) return toast.error('Erro ao excluir: ' + error.message);
    toast.success('Regra excluída');
    fetchRules();
  };

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
  const totalActiveBalance = balances.reduce((s, b) => s + b.total_active, 0);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Regras ativas</p>
            <p className="text-2xl font-bold text-primary">{rules.filter(r => r.status === 'active').length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Clientes com saldo</p>
            <p className="text-2xl font-bold text-success">{balances.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Cashback ativo total</p>
            <p className="text-2xl font-bold">{formatCurrency(totalActiveBalance)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Rules list */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-amber-500" /> Regras de cashback
          </CardTitle>
          <Button onClick={openNew} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> Nova regra
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
          ) : rules.length === 0 ? (
            <div className="text-center py-12">
              <Wallet className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhuma regra de cashback cadastrada.</p>
              <p className="text-xs text-muted-foreground mt-1">Crie a primeira regra para premiar seus clientes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map(rule => {
                const isPercentage = rule.discount_type === 'percentage';
                const valueLabel = isPercentage
                  ? `${rule.discount_value}% de cashback`
                  : `${formatCurrency(Number(rule.discount_value || 0))} de cashback`;
                return (
                  <div key={rule.id} className="border rounded-lg p-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold truncate">{rule.title}</h4>
                          <Badge variant={rule.status === 'active' ? 'default' : 'secondary'}>
                            {rule.status === 'active' ? 'Ativa' : 'Pausada'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          💰 {valueLabel} · ⏳ válido por {rule.cashback_validity_days || 30} dias
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(parseISO(rule.start_date), 'dd/MM/yy')} → {format(parseISO(rule.end_date), 'dd/MM/yy')}
                          {rule.cashback_cumulative && <span className="ml-2">· acumula</span>}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => toggleStatus(rule)} title={rule.status === 'active' ? 'Pausar' : 'Ativar'}>
                          {rule.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openEdit(rule)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(rule)} title="Excluir" className="text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Top balances */}
      {balances.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Clientes com saldo ativo (top 10)</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2 text-xs text-muted-foreground">Cliente</th>
                    <th className="p-2 text-xs text-muted-foreground text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.slice(0, 10).map(b => (
                    <tr key={b.client_id} className="border-b last:border-0">
                      <td className="p-2">{b.client_name}</td>
                      <td className="p-2 text-right font-medium text-success">{formatCurrency(b.total_active)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar regra' : 'Nova regra de cashback'}</DialogTitle>
            <DialogDescription>
              Cliente recebe crédito após o serviço concluído para usar no próximo agendamento.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Cashback Corte" />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da regra" rows={2} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Tipo *</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed_amount">Valor fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor *</Label>
                <Input type="number" inputMode="decimal" value={discountValue} onChange={e => setDiscountValue(e.target.value)} placeholder={discountType === 'percentage' ? '10' : '5.00'} />
              </div>
            </div>

            <div>
              <Label>Validade do cashback (dias)</Label>
              <Input type="number" value={validityDays} onChange={e => setValidityDays(e.target.value)} placeholder="30" />
              <p className="text-xs text-muted-foreground mt-1">Quantos dias o cliente tem para usar o crédito após receber.</p>
            </div>

            <div>
              <Label>Serviços participantes</Label>
              <Select value={serviceMode} onValueChange={(v: any) => setServiceMode(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os serviços</SelectItem>
                  <SelectItem value="specific">Selecionar serviços</SelectItem>
                </SelectContent>
              </Select>
              {serviceMode === 'specific' && (
                <div className="mt-2 max-h-40 overflow-y-auto border rounded-md p-2 space-y-1">
                  {services.map(s => (
                    <label key={s.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedServiceIds.includes(s.id)}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedServiceIds([...selectedServiceIds, s.id]);
                          else setSelectedServiceIds(selectedServiceIds.filter(id => id !== s.id));
                        }}
                      />
                      {s.name}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Início *</Label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Fim *</Label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label>Regras adicionais</Label>
              <Textarea value={rulesText} onChange={e => setRulesText(e.target.value)} placeholder="Ex: cashback não cumulativo com outras promoções" rows={2} />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-md">
              <div>
                <Label className="cursor-pointer">Cashback acumulável</Label>
                <p className="text-xs text-muted-foreground">Permite gerar cashback repetidamente para o mesmo cliente.</p>
              </div>
              <Switch checked={cumulative} onCheckedChange={setCumulative} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar' : 'Criar regra'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
