import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Star, Trophy, Gift, ArrowUpDown, Settings, Eye, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, XCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const Loyalty = () => {
  const { companyId } = useAuth();
  const [tab, setTab] = useState('overview');

  // Config state
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [scoringType, setScoringType] = useState('per_service');
  const [pointsPerService, setPointsPerService] = useState(10);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
  const [participatingServices, setParticipatingServices] = useState('all');
  const [participatingProfessionals, setParticipatingProfessionals] = useState('all');
  const [specificServiceIds, setSpecificServiceIds] = useState<string[]>([]);
  const [specificProfessionalIds, setSpecificProfessionalIds] = useState<string[]>([]);

  // Reference data
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);

  // Reward items
  const [rewardItems, setRewardItems] = useState<any[]>([]);
  const [rewardDialog, setRewardDialog] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null);
  const [rewardName, setRewardName] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardType, setRewardType] = useState('service');
  const [rewardPoints, setRewardPoints] = useState(100);
  const [rewardExtraCost, setRewardExtraCost] = useState(0);

  // Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState('');

  // Redemptions
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [validateDialog, setValidateDialog] = useState(false);
  const [validateCode, setValidateCode] = useState('');

  // Overview stats
  const [stats, setStats] = useState({ totalIssued: 0, totalRedeemed: 0, totalActive: 0 });
  const [topClients, setTopClients] = useState<any[]>([]);

  const fetchConfig = useCallback(async () => {
    if (!companyId) return;
    setConfigLoading(true);
    const { data } = await supabase
      .from('loyalty_config' as any)
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      setConfig(data);
      setEnabled((data as any).enabled);
      setScoringType((data as any).scoring_type);
      setPointsPerService((data as any).points_per_service);
      setPointsPerCurrency(Number((data as any).points_per_currency));
      setParticipatingServices((data as any).participating_services);
      setParticipatingProfessionals((data as any).participating_professionals);
      setSpecificServiceIds((data as any).specific_service_ids || []);
      setSpecificProfessionalIds((data as any).specific_professional_ids || []);
    }
    setConfigLoading(false);
  }, [companyId]);

  const fetchServices = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase.from('services').select('id, name').eq('company_id', companyId).eq('active', true).order('name');
    if (data) setServices(data);
  }, [companyId]);

  const fetchProfessionals = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, profiles:profile_id(full_name)')
      .eq('company_id', companyId)
      .eq('active', true);
    if (data) setProfessionals(data.map((c: any) => ({ id: c.profile_id, name: c.profiles?.full_name || 'Profissional' })));
  }, [companyId]);

  const fetchRewardItems = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('loyalty_reward_items' as any)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (data) setRewardItems(data as any);
  }, [companyId]);

  const fetchTransactions = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('loyalty_points_transactions' as any)
      .select('*, clients:client_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setTransactions(data as any);
  }, [companyId]);

  const fetchRedemptions = useCallback(async () => {
    if (!companyId) return;
    const { data } = await supabase
      .from('loyalty_redemptions' as any)
      .select('*, clients:client_id(name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (data) setRedemptions(data as any);
  }, [companyId]);

  const fetchStats = useCallback(async () => {
    if (!companyId) return;
    const { data: txs } = await supabase
      .from('loyalty_points_transactions' as any)
      .select('points, transaction_type')
      .eq('company_id', companyId);

    if (txs) {
      let issued = 0, redeemed = 0;
      (txs as any[]).forEach(t => {
        if (t.transaction_type === 'earn') issued += t.points;
        if (t.transaction_type === 'redeem') redeemed += Math.abs(t.points);
        if (t.transaction_type === 'expire') redeemed += Math.abs(t.points);
      });
      setStats({ totalIssued: issued, totalRedeemed: redeemed, totalActive: issued - redeemed });
    }

    // Top clients by balance
    const { data: clientTx } = await supabase
      .from('loyalty_points_transactions' as any)
      .select('client_id, points, transaction_type, clients:client_id(name)')
      .eq('company_id', companyId);

    if (clientTx) {
      const balanceMap: Record<string, { name: string; balance: number }> = {};
      (clientTx as any[]).forEach(t => {
        if (!balanceMap[t.client_id]) balanceMap[t.client_id] = { name: t.clients?.name || 'Cliente', balance: 0 };
        balanceMap[t.client_id].balance += t.points;
      });
      const sorted = Object.entries(balanceMap)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => b.balance - a.balance)
        .slice(0, 10);
      setTopClients(sorted);
    }
  }, [companyId]);

  useEffect(() => {
    fetchConfig();
    fetchServices();
    fetchProfessionals();
    fetchRewardItems();
    fetchTransactions();
    fetchRedemptions();
    fetchStats();
  }, [fetchConfig, fetchServices, fetchProfessionals, fetchRewardItems, fetchTransactions, fetchRedemptions, fetchStats]);

  const saveConfig = async () => {
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      enabled,
      scoring_type: scoringType,
      points_per_service: pointsPerService,
      points_per_currency: pointsPerCurrency,
      participating_services: participatingServices,
      participating_professionals: participatingProfessionals,
      specific_service_ids: specificServiceIds,
      specific_professional_ids: specificProfessionalIds,
    };

    if (config) {
      await supabase.from('loyalty_config' as any).update(payload as any).eq('id', (config as any).id);
    } else {
      await supabase.from('loyalty_config' as any).insert(payload as any);
    }
    toast.success('Configurações salvas!');
    fetchConfig();
  };

  const saveRewardItem = async () => {
    if (!companyId || !rewardName.trim()) return;
    const payload = {
      company_id: companyId,
      name: rewardName,
      description: rewardDesc,
      item_type: rewardType,
      points_required: rewardPoints,
      extra_cost: rewardExtraCost,
    };

    if (editingReward) {
      await supabase.from('loyalty_reward_items' as any).update(payload as any).eq('id', editingReward.id);
    } else {
      await supabase.from('loyalty_reward_items' as any).insert(payload as any);
    }
    setRewardDialog(false);
    setEditingReward(null);
    setRewardName(''); setRewardDesc(''); setRewardType('service'); setRewardPoints(100); setRewardExtraCost(0);
    fetchRewardItems();
    toast.success(editingReward ? 'Item atualizado!' : 'Item cadastrado!');
  };

  const deleteRewardItem = async (id: string) => {
    await supabase.from('loyalty_reward_items' as any).delete().eq('id', id);
    fetchRewardItems();
    toast.success('Item removido');
  };

  const handleValidateRedemption = async (redemptionId: string, action: 'confirmed' | 'cancelled') => {
    const redemption = redemptions.find((r: any) => r.id === redemptionId);
    if (!redemption) return;

    await supabase.from('loyalty_redemptions' as any).update({
      status: action,
      confirmed_at: action === 'confirmed' ? new Date().toISOString() : null,
    } as any).eq('id', redemptionId);

    if (action === 'cancelled' && redemption.client_id && companyId) {
      // Return points
      const { data: lastTx } = await supabase
        .from('loyalty_points_transactions' as any)
        .select('balance_after')
        .eq('company_id', companyId)
        .eq('client_id', redemption.client_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = (lastTx as any)?.balance_after || 0;
      await supabase.from('loyalty_points_transactions' as any).insert({
        company_id: companyId,
        client_id: redemption.client_id,
        points: Math.abs(redemption.total_points),
        transaction_type: 'cancel',
        reference_type: 'redemption_cancel',
        reference_id: redemptionId,
        description: `Cancelamento do resgate ${redemption.redemption_code}`,
        balance_after: currentBalance + Math.abs(redemption.total_points),
      } as any);
    }

    fetchRedemptions();
    fetchTransactions();
    fetchStats();
    toast.success(action === 'confirmed' ? 'Resgate confirmado!' : 'Resgate cancelado, pontos devolvidos.');
  };

  const handleValidateCode = async () => {
    if (!validateCode.trim() || !companyId) return;
    const { data } = await supabase
      .from('loyalty_redemptions' as any)
      .select('*, clients:client_id(name)')
      .eq('company_id', companyId)
      .eq('redemption_code', validateCode.trim().toUpperCase())
      .maybeSingle();

    if (!data) {
      toast.error('Código não encontrado');
      return;
    }
    if ((data as any).status !== 'pending') {
      toast.error(`Este resgate já foi ${(data as any).status === 'confirmed' ? 'confirmado' : 'cancelado'}`);
      return;
    }

    // Confirm it
    await handleValidateRedemption((data as any).id, 'confirmed');
    setValidateDialog(false);
    setValidateCode('');
  };

  const openEditReward = (item: any) => {
    setEditingReward(item);
    setRewardName(item.name);
    setRewardDesc(item.description || '');
    setRewardType(item.item_type);
    setRewardPoints(item.points_required);
    setRewardExtraCost(Number(item.extra_cost));
    setRewardDialog(true);
  };

  const typeLabel: Record<string, string> = { product: 'Produto', service: 'Serviço', discount: 'Desconto' };
  const txTypeLabel: Record<string, string> = { earn: 'Ganho', redeem: 'Resgate', expire: 'Expirado', cancel: 'Cancelamento' };
  const txTypeColor: Record<string, string> = { earn: 'text-success', redeem: 'text-destructive', expire: 'text-muted-foreground', cancel: 'text-warning' };

  const filteredTransactions = txFilter
    ? transactions.filter((t: any) => (t.clients?.name || '').toLowerCase().includes(txFilter.toLowerCase()))
    : transactions;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold flex items-center gap-2"><Star className="h-5 w-5 text-amber-500" /> Programa de Fidelidade</h2>
        <p className="text-sm text-muted-foreground">Gerencie pontos, recompensas e resgates dos seus clientes</p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full grid grid-cols-4">
          <TabsTrigger value="overview" className="gap-1.5"><Eye className="h-4 w-4" /> Visão geral</TabsTrigger>
          <TabsTrigger value="settings" className="gap-1.5"><Settings className="h-4 w-4" /> Configurações</TabsTrigger>
          <TabsTrigger value="rewards" className="gap-1.5"><Gift className="h-4 w-4" /> Itens de resgate</TabsTrigger>
          <TabsTrigger value="transactions" className="gap-1.5"><ArrowUpDown className="h-4 w-4" /> Movimentações</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos emitidos</p>
                <p className="text-2xl font-bold text-primary">{stats.totalIssued.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos resgatados</p>
                <p className="text-2xl font-bold text-destructive">{stats.totalRedeemed.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos ativos</p>
                <p className="text-2xl font-bold text-success">{stats.totalActive.toLocaleString('pt-BR')}</p>
              </CardContent>
            </Card>
          </div>

          {/* Validate redemption code */}
          <Card>
            <CardHeader><CardTitle className="text-base">Validar código de resgate</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input placeholder="Ex: FID-83921" value={validateCode} onChange={e => setValidateCode(e.target.value.toUpperCase())} className="max-w-xs" />
              <Button onClick={handleValidateCode}>Validar</Button>
            </CardContent>
          </Card>

          {/* Pending redemptions */}
          {redemptions.filter((r: any) => r.status === 'pending').length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Resgates pendentes</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {redemptions.filter((r: any) => r.status === 'pending').map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div>
                      <p className="font-medium">{r.clients?.name || 'Cliente'}</p>
                      <p className="text-xs text-muted-foreground">Código: <span className="font-mono font-bold">{r.redemption_code}</span> · {r.total_points} pts</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleValidateRedemption(r.id, 'cancelled')}><XCircle className="h-4 w-4 mr-1" /> Cancelar</Button>
                      <Button size="sm" onClick={() => handleValidateRedemption(r.id, 'confirmed')}><CheckCircle className="h-4 w-4 mr-1" /> Confirmar</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top clients */}
          {topClients.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Trophy className="h-4 w-4 text-amber-500" /> Ranking de clientes</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {topClients.map((c, i) => (
                    <div key={c.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className={cn('text-sm font-bold', i === 0 && 'text-amber-500', i === 1 && 'text-gray-400', i === 2 && 'text-amber-700')}>
                          #{i + 1}
                        </span>
                        <span className="text-sm font-medium">{c.name}</span>
                      </div>
                      <Badge variant="secondary">{c.balance} pts</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* SETTINGS TAB */}
        <TabsContent value="settings" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Programa de Fidelidade</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="font-medium">Ativar programa de fidelidade</Label>
                  <p className="text-xs text-muted-foreground">Quando ativo, clientes acumulam pontos a cada serviço concluído</p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} />
              </div>

              {enabled && (
                <>
                  <div className="space-y-2">
                    <Label className="font-medium">Tipo de pontuação</Label>
                    <Select value={scoringType} onValueChange={setScoringType}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="per_service">Pontuar por serviço realizado</SelectItem>
                        <SelectItem value="per_value">Pontuar por valor gasto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {scoringType === 'per_service' && (
                    <div className="space-y-1">
                      <Label className="text-sm">Pontos por serviço concluído</Label>
                      <Input type="number" min={1} value={pointsPerService} onChange={e => setPointsPerService(parseInt(e.target.value) || 1)} className="max-w-xs" />
                      <p className="text-xs text-muted-foreground">Ex: Cada serviço realizado gera {pointsPerService} pontos</p>
                    </div>
                  )}

                  {scoringType === 'per_value' && (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label className="text-sm">Pontos por real gasto</Label>
                        <Input type="number" min={0.1} step={0.1} value={pointsPerCurrency} onChange={e => setPointsPerCurrency(parseFloat(e.target.value) || 0.1)} className="max-w-xs" />
                        <p className="text-xs text-muted-foreground">Ex: R$1 = {pointsPerCurrency} ponto(s). Calculado sobre o valor final pago.</p>
                      </div>
                      <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                        <p className="text-xs text-warning">Configure a pontuação de forma que o custo do resgate seja menor que o valor gerado pelo cliente. Isso evita prejuízo.</p>
                      </div>
                    </div>
                  )}

                  {/* Participating services */}
                  <div className="space-y-2">
                    <Label className="font-medium">Serviços participantes</Label>
                    <Select value={participatingServices} onValueChange={setParticipatingServices}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os serviços</SelectItem>
                        <SelectItem value="specific">Selecionar serviços específicos</SelectItem>
                      </SelectContent>
                    </Select>
                    {participatingServices === 'specific' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                        {services.map(s => (
                          <label key={s.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                            <Checkbox
                              checked={specificServiceIds.includes(s.id)}
                              onCheckedChange={(checked) => {
                                setSpecificServiceIds(prev => checked ? [...prev, s.id] : prev.filter(x => x !== s.id));
                              }}
                            />
                            <span className="text-sm">{s.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Participating professionals */}
                  <div className="space-y-2">
                    <Label className="font-medium">Profissionais participantes</Label>
                    <Select value={participatingProfessionals} onValueChange={setParticipatingProfessionals}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos os profissionais</SelectItem>
                        <SelectItem value="specific">Selecionar profissionais</SelectItem>
                      </SelectContent>
                    </Select>
                    {participatingProfessionals === 'specific' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                        {professionals.map(p => (
                          <label key={p.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                            <Checkbox
                              checked={specificProfessionalIds.includes(p.id)}
                              onCheckedChange={(checked) => {
                                setSpecificProfessionalIds(prev => checked ? [...prev, p.id] : prev.filter(x => x !== p.id));
                              }}
                            />
                            <span className="text-sm">{p.name}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              <Button onClick={saveConfig}>Salvar configurações</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* REWARD ITEMS TAB */}
        <TabsContent value="rewards" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Itens disponíveis para resgate</h3>
            <Button size="sm" onClick={() => { setEditingReward(null); setRewardName(''); setRewardDesc(''); setRewardType('service'); setRewardPoints(100); setRewardExtraCost(0); setRewardDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          </div>

          {rewardItems.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum item cadastrado. Crie itens de resgate para seus clientes.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewardItems.map((item: any) => (
                <Card key={item.id} className={cn(!item.active && 'opacity-50')}>
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <Badge variant="outline" className="text-xs mt-1">{typeLabel[item.item_type]}</Badge>
                      </div>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditReward(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteRewardItem(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {item.description && <p className="text-xs text-muted-foreground">{item.description}</p>}
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      <span className="font-bold text-sm">{item.points_required} pontos</span>
                      {Number(item.extra_cost) > 0 && <span className="text-xs text-muted-foreground">+ R$ {Number(item.extra_cost).toFixed(2)}</span>}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Reward dialog */}
          <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingReward ? 'Editar item' : 'Novo item de resgate'}</DialogTitle>
                <DialogDescription>Configure o item que os clientes poderão resgatar com pontos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>Nome</Label>
                  <Input value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="Ex: Corte Masculino" />
                </div>
                <div className="space-y-1">
                  <Label>Descrição</Label>
                  <Input value={rewardDesc} onChange={e => setRewardDesc(e.target.value)} placeholder="Opcional" />
                </div>
                <div className="space-y-1">
                  <Label>Tipo</Label>
                  <Select value={rewardType} onValueChange={setRewardType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="product">Produto</SelectItem>
                      <SelectItem value="service">Serviço</SelectItem>
                      <SelectItem value="discount">Desconto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>Pontos necessários</Label>
                    <Input type="number" min={1} value={rewardPoints} onChange={e => setRewardPoints(parseInt(e.target.value) || 1)} />
                  </div>
                  <div className="space-y-1">
                    <Label>Valor adicional (R$)</Label>
                    <Input type="number" min={0} step={0.01} value={rewardExtraCost} onChange={e => setRewardExtraCost(parseFloat(e.target.value) || 0)} />
                    <p className="text-[10px] text-muted-foreground">0 = somente pontos</p>
                  </div>
                </div>
                <Button className="w-full" onClick={saveRewardItem}>{editingReward ? 'Salvar' : 'Cadastrar'}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* TRANSACTIONS TAB */}
        <TabsContent value="transactions" className="space-y-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Filtrar por cliente..." value={txFilter} onChange={e => setTxFilter(e.target.value)} className="pl-9" />
            </div>
          </div>

          {filteredTransactions.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhuma movimentação encontrada.</CardContent></Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-3 font-medium">Data</th>
                        <th className="text-left p-3 font-medium">Cliente</th>
                        <th className="text-left p-3 font-medium">Tipo</th>
                        <th className="text-right p-3 font-medium">Pontos</th>
                        <th className="text-right p-3 font-medium">Saldo</th>
                        <th className="text-left p-3 font-medium">Descrição</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTransactions.map((t: any) => (
                        <tr key={t.id} className="border-b last:border-0">
                          <td className="p-3 text-xs text-muted-foreground">{format(parseISO(t.created_at), 'dd/MM/yy HH:mm')}</td>
                          <td className="p-3">{t.clients?.name || '—'}</td>
                          <td className="p-3"><span className={cn('text-xs font-medium', txTypeColor[t.transaction_type])}>{txTypeLabel[t.transaction_type]}</span></td>
                          <td className={cn('p-3 text-right font-medium', t.points > 0 ? 'text-success' : 'text-destructive')}>
                            {t.points > 0 ? '+' : ''}{t.points}
                          </td>
                          <td className="p-3 text-right">{t.balance_after}</td>
                          <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{t.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Loyalty;
