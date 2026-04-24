import { useEffect, useState, useCallback, useRef } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import { Star, Trophy, Gift, ArrowUpDown, Settings, Eye, Plus, Pencil, Trash2, AlertTriangle, CheckCircle, XCircle, Search, Upload, ImageIcon, ScanLine, Wallet, Sparkles } from 'lucide-react';
import CashbackTab from '@/components/loyalty/CashbackTab';
import { RewardQRScannerDialog } from '@/components/RewardQRScannerDialog';
import { SmartRewardCard } from '@/components/loyalty/SmartRewardCard';
import { suggestSmartReward } from '@/lib/smart-rewards';
import { PlanFeatureGate } from '@/components/PlanFeatureGate';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

const Loyalty = () => {
  const { companyId } = useAuth();
  const [activeModule, setActiveModule] = useState<'points' | 'cashback'>('points');
  const [tab, setTab] = useState('overview');

  // Config state
  const [config, setConfig] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [scoringType, setScoringType] = useState('per_service');
  const [pointsPerService, setPointsPerService] = useState(10);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
  const [pointValue, setPointValue] = useState(0.05);
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
  const [rewardRealValue, setRewardRealValue] = useState(0);
  const [rewardStockTotal, setRewardStockTotal] = useState<number | ''>('');
  const [rewardImageFile, setRewardImageFile] = useState<File | null>(null);
  const [rewardImagePreview, setRewardImagePreview] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Transactions
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txFilter, setTxFilter] = useState('');

  // Redemptions
  const [redemptions, setRedemptions] = useState<any[]>([]);
  const [validateCode, setValidateCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);

  // Overview stats
  const [stats, setStats] = useState({ totalIssued: 0, totalRedeemed: 0, totalActive: 0 });
  const [topClients, setTopClients] = useState<any[]>([]);
  // Smart rewards: per-client appointment history (top clients only)
  const [topClientsHistory, setTopClientsHistory] = useState<Record<string, Array<{ service_name: string | null; total_price: number; created_at: string }>>>({});

  // Auto-calculate points from real value
  const calculatedPoints = pointValue > 0 ? Math.ceil(rewardRealValue / pointValue) : 0;

  const fetchConfig = useCallback(async () => {
    if (!companyId) return;
    setConfigLoading(true);
    const { data } = await supabase
      .from('loyalty_config' as any)
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (data) {
      const d = data as any;
      setConfig(d);
      setEnabled(d.enabled);
      setScoringType(d.scoring_type);
      setPointsPerService(d.points_per_service);
      setPointsPerCurrency(Number(d.points_per_currency));
      setPointValue(Number(d.point_value) || 0.05);
      setParticipatingServices(d.participating_services);
      setParticipatingProfessionals(d.participating_professionals);
      setSpecificServiceIds(d.specific_service_ids || []);
      setSpecificProfessionalIds(d.specific_professional_ids || []);
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

  // Fetch appointment history for top clients (smart rewards)
  useEffect(() => {
    if (!companyId || topClients.length === 0) return;
    const ids = topClients.slice(0, 5).map((c) => c.id);
    if (ids.length === 0) return;
    (async () => {
      const { data } = await supabase
        .from('appointments')
        .select('client_id, start_time, total_price, appointment_services(price, service:services(name))')
        .eq('company_id', companyId)
        .in('client_id', ids)
        .order('start_time', { ascending: false })
        .limit(200);
      if (!data) return;
      const map: Record<string, Array<{ service_name: string | null; total_price: number; created_at: string }>> = {};
      for (const apt of data as any[]) {
        const items = (apt.appointment_services || []).map((s: any) => ({
          service_name: s.service?.name ?? null,
          total_price: Number(s.price) || 0,
          created_at: apt.start_time,
        }));
        if (!map[apt.client_id]) map[apt.client_id] = [];
        map[apt.client_id].push(...items);
      }
      setTopClientsHistory(map);
    })();
  }, [companyId, topClients]);

  const saveConfig = async () => {
    if (!companyId) return;
    const payload = {
      company_id: companyId,
      enabled,
      scoring_type: scoringType,
      points_per_service: pointsPerService,
      points_per_currency: pointsPerCurrency,
      point_value: pointValue,
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

  const uploadRewardImage = async (file: File): Promise<string | null> => {
    if (!companyId) return null;
    setUploadingImage(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${companyId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('loyalty-rewards').upload(path, file, { upsert: true });
      if (error) {
        // Bucket may not exist yet - just skip image
        console.error('Upload error:', error);
        toast.error('Erro ao fazer upload da imagem');
        return null;
      }
      const { data: urlData } = supabase.storage.from('loyalty-rewards').getPublicUrl(path);
      return urlData.publicUrl;
    } finally {
      setUploadingImage(false);
    }
  };

  const saveRewardItem = async () => {
    if (!companyId || !rewardName.trim()) return;

    let imageUrl = editingReward?.image_url || null;
    if (rewardImageFile) {
      const uploaded = await uploadRewardImage(rewardImageFile);
      if (uploaded) imageUrl = uploaded;
    }

    const autoPoints = pointValue > 0 ? Math.ceil(rewardRealValue / pointValue) : 0;

    // Validate stock: required, non-negative integer
    const parsedStock = typeof rewardStockTotal === 'number'
      ? rewardStockTotal
      : parseInt(String(rewardStockTotal), 10);
    if (Number.isNaN(parsedStock) || parsedStock < 0) {
      toast.error('Informe a quantidade disponível (0 ou mais).');
      return;
    }

    const payload = {
      company_id: companyId,
      name: rewardName,
      description: rewardDesc,
      item_type: rewardType,
      real_value: rewardRealValue,
      points_required: autoPoints,
      extra_cost: 0,
      image_url: imageUrl,
      stock_total: parsedStock,
    };

    if (editingReward) {
      await supabase.from('loyalty_reward_items' as any).update(payload as any).eq('id', editingReward.id);
    } else {
      await supabase.from('loyalty_reward_items' as any).insert(payload as any);
    }
    setRewardDialog(false);
    resetRewardForm();
    fetchRewardItems();
    toast.success(editingReward ? 'Item atualizado!' : 'Item cadastrado!');
  };

  const resetRewardForm = () => {
    setEditingReward(null);
    setRewardName('');
    setRewardDesc('');
    setRewardType('service');
    setRewardRealValue(0);
    setRewardStockTotal('');
    setRewardImageFile(null);
    setRewardImagePreview(null);
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

    await handleValidateRedemption((data as any).id, 'confirmed');
    setValidateCode('');
  };

  const openEditReward = (item: any) => {
    setEditingReward(item);
    setRewardName(item.name);
    setRewardDesc(item.description || '');
    setRewardType(item.item_type);
    setRewardRealValue(Number(item.real_value) || 0);
    setRewardStockTotal(item.stock_total ?? '');
    setRewardImageFile(null);
    setRewardImagePreview(item.image_url || null);
    setRewardDialog(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRewardImageFile(file);
    const reader = new FileReader();
    reader.onload = () => setRewardImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const typeLabel: Record<string, string> = { product: 'Produto', service: 'Serviço', discount: 'Desconto' };
  const txTypeLabel: Record<string, string> = { earn: 'Ganho', redeem: 'Resgate', expire: 'Expirado', cancel: 'Cancelamento' };
  const txTypeColor: Record<string, string> = { earn: 'text-success', redeem: 'text-destructive', expire: 'text-muted-foreground', cancel: 'text-warning' };

  const filteredTransactions = txFilter
    ? transactions.filter((t: any) => (t.clients?.name || '').toLowerCase().includes(txFilter.toLowerCase()))
    : transactions;

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold flex items-center gap-2">
            {activeModule === 'points' ? <Star className="h-5 w-5 text-amber-500" /> : <Wallet className="h-5 w-5 text-amber-500" />}
            {activeModule === 'points' ? 'Fidelidade por Pontos' : 'Programa de Cashback'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {activeModule === 'points' 
              ? 'Gerencie pontos, recompensas e resgates dos seus clientes' 
              : 'Gerencie regras de cashback e saldo dos seus clientes'}
          </p>
        </div>

        <div className="flex p-1 bg-muted rounded-lg w-fit border">
          <button 
            onClick={() => { setActiveModule('points'); setTab('overview'); }}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeModule === 'points' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Star className={cn("h-4 w-4", activeModule === 'points' && "text-amber-500")} /> Pontos
          </button>
          <button 
            onClick={() => { setActiveModule('cashback'); setTab('overview'); }}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2",
              activeModule === 'cashback' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wallet className={cn("h-4 w-4", activeModule === 'cashback' && "text-amber-500")} /> Cashback
          </button>
        </div>
      </div>

      {activeModule === 'points' ? (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full justify-start border-b rounded-none bg-transparent h-auto p-0 mb-4 overflow-x-auto flex-nowrap">
            <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 h-auto">Resumo</TabsTrigger>
            <TabsTrigger value="rewards" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 h-auto">Recompensas</TabsTrigger>
            <TabsTrigger value="redemptions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 h-auto">Resgates</TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 h-auto">Movimentações</TabsTrigger>
            <TabsTrigger value="settings" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3 h-auto">Configurações</TabsTrigger>
          </TabsList>


        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos emitidos</p>
                <p className="text-2xl font-bold text-primary">{stats.totalIssued.toLocaleString('pt-BR')}</p>
                {pointValue > 0 && <p className="text-xs text-muted-foreground mt-1">≈ {formatCurrency(stats.totalIssued * pointValue)}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos resgatados</p>
                <p className="text-2xl font-bold text-destructive">{stats.totalRedeemed.toLocaleString('pt-BR')}</p>
                {pointValue > 0 && <p className="text-xs text-muted-foreground mt-1">≈ {formatCurrency(stats.totalRedeemed * pointValue)}</p>}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Pontos ativos</p>
                <p className="text-2xl font-bold text-success">{stats.totalActive.toLocaleString('pt-BR')}</p>
                {pointValue > 0 && <p className="text-xs text-muted-foreground mt-1">≈ {formatCurrency(stats.totalActive * pointValue)}</p>}
              </CardContent>
            </Card>
          </div>


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
                      <div className="text-right">
                        <Badge variant="secondary">{c.balance} pts</Badge>
                        {pointValue > 0 && <p className="text-[10px] text-muted-foreground mt-0.5">≈ {formatCurrency(c.balance * pointValue)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Smart Rewards (premium / gated by plan loyalty feature) */}
          <PlanFeatureGate
            feature="loyalty"
            upgradePrompt={{
              title: 'Recompensas Inteligentes (Premium)',
              description: 'Sugestões automáticas da próxima recompensa ideal para cada cliente com base no histórico de serviços. Disponível em planos superiores.',
            }}
          >
            {topClients.length > 0 && rewardItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" /> Recompensas Inteligentes
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Sugestão automática da próxima recompensa ideal para os top clientes, com base no serviço favorito e no saldo atual.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {topClients.slice(0, 5).map((c) => {
                    const history = topClientsHistory[c.id] || [];
                    const suggestion = suggestSmartReward({
                      currentBalance: c.balance,
                      appointmentHistory: history,
                      rewards: rewardItems as any,
                    });
                    if (!suggestion) return null;
                    return (
                      <div key={c.id} className="space-y-1.5">
                        <p className="text-sm font-medium">{c.name} <span className="text-xs text-muted-foreground">· {c.balance} pts</span></p>
                        <SmartRewardCard suggestion={suggestion} pointValue={pointValue} compact />
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </PlanFeatureGate>
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

                  {/* Point value for redemption */}
                  <div className="space-y-1 p-4 rounded-lg border border-primary/20 bg-primary/5">
                    <Label className="text-sm font-medium">Valor de cada ponto no resgate (R$)</Label>
                    <Input type="number" min={0.01} step={0.01} value={pointValue} onChange={e => setPointValue(parseFloat(e.target.value) || 0.01)} className="max-w-xs" />
                    <p className="text-xs text-muted-foreground">
                      1 ponto = {formatCurrency(pointValue)} · 100 pontos = {formatCurrency(100 * pointValue)} · 1000 pontos = {formatCurrency(1000 * pointValue)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Este valor é usado para calcular automaticamente quantos pontos são necessários para resgatar cada item.
                    </p>
                  </div>

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
            <Button size="sm" onClick={() => { resetRewardForm(); setRewardDialog(true); }}>
              <Plus className="h-4 w-4 mr-1" /> Novo item
            </Button>
          </div>

          {pointValue <= 0 && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 flex gap-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
              <p className="text-xs text-warning">Configure o "Valor de cada ponto no resgate" nas Configurações para que os pontos sejam calculados automaticamente.</p>
            </div>
          )}

          {rewardItems.length === 0 ? (
            <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum item cadastrado. Crie itens de resgate para seus clientes.</CardContent></Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rewardItems.map((item: any) => {
                const itemRealValue = Number(item.real_value) || 0;
                const itemPoints = Number(item.points_required) || 0;
                return (
                  <Card key={item.id} className={cn(!item.active && 'opacity-50')}>
                    <CardContent className="pt-4 space-y-2">
                      <div className="aspect-square w-full rounded-lg overflow-hidden bg-muted mb-2 flex items-center justify-center">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.name} className="aspect-square w-full object-cover" />
                        ) : (
                          <Gift className="h-10 w-10 text-muted-foreground/50" />
                        )}
                      </div>
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
                      <div className="space-y-1 mt-2 p-2 rounded bg-muted/50">
                        <div className="flex items-center gap-2">
                          <Star className="h-4 w-4 text-amber-500" />
                          <span className="font-bold text-sm">{itemPoints.toLocaleString('pt-BR')} pontos</span>
                        </div>
                        {itemRealValue > 0 && (
                          <p className="text-xs text-muted-foreground">Valor do item: {formatCurrency(itemRealValue)}</p>
                        )}
                        {item.stock_total !== null && item.stock_total !== undefined && (
                          <p className={cn(
                            'text-xs font-medium',
                            (item.stock_available ?? 0) <= 0 ? 'text-destructive' : 'text-muted-foreground'
                          )}>
                            {(item.stock_available ?? 0) <= 0
                              ? '⛔ Esgotado'
                              : `📦 Disponível: ${item.stock_available} ${item.stock_available === 1 ? 'unidade' : 'unidades'}`}
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Reward dialog */}
          <Dialog open={rewardDialog} onOpenChange={setRewardDialog}>
            <DialogContent className="sm:max-w-[640px]">
              <DialogHeader>
                <DialogTitle>{editingReward ? 'Editar item' : 'Novo item de resgate'}</DialogTitle>
                <DialogDescription>Configure o item que os clientes poderão resgatar com pontos.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

                <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 md:gap-5">
                  {/* Image column */}
                  <div className="flex flex-col items-center md:items-start gap-1.5">
                    {rewardImagePreview ? (
                      <div
                        className="group relative aspect-square w-[160px] md:w-[180px] rounded-lg overflow-hidden bg-muted border cursor-pointer"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <img src={rewardImagePreview} alt="Preview" className="aspect-square w-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Upload className="h-5 w-5 text-white" />
                          <span className="text-xs font-medium text-white">Trocar imagem</span>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="aspect-square w-[160px] md:w-[180px] rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-1.5 hover:border-primary/50 hover:bg-muted/30 transition-colors"
                      >
                        <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">+ Adicionar imagem</span>
                      </button>
                    )}
                    <p className="text-[11px] text-muted-foreground w-[160px] md:w-[180px] text-center">
                      1:1 recomendado (500x500px+)
                    </p>
                  </div>

                  {/* Form column */}
                  <div className="space-y-3 min-w-0">
                    <div className="space-y-1">
                      <Label>Nome</Label>
                      <Input value={rewardName} onChange={e => setRewardName(e.target.value)} placeholder="Ex: Pomada Modeladora" />
                    </div>
                    <div className="space-y-1">
                      <Label>Descrição</Label>
                      <Input value={rewardDesc} onChange={e => setRewardDesc(e.target.value)} placeholder="Opcional" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
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
                      <div className="space-y-1">
                        <Label>Quantidade *</Label>
                        <Input
                          type="number"
                          min={0}
                          step={1}
                          placeholder="Ex: 10"
                          value={rewardStockTotal}
                          onChange={e => {
                            const v = e.target.value;
                            if (v === '') { setRewardStockTotal(''); return; }
                            const n = parseInt(v, 10);
                            setRewardStockTotal(Number.isNaN(n) ? '' : Math.max(0, n));
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Valor real do item (R$)</Label>
                      <Input type="number" min={0} step={0.01} value={rewardRealValue} onChange={e => setRewardRealValue(parseFloat(e.target.value) || 0)} />
                      <p className="text-xs text-muted-foreground">Informe o valor de mercado do item</p>
                    </div>
                  </div>
                </div>

                {/* Auto-calculated points display */}
                {rewardRealValue > 0 && pointValue > 0 && (
                  <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 space-y-1">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500" />
                      Este item custa: <span className="font-bold text-primary">{calculatedPoints.toLocaleString('pt-BR')} pontos</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Cálculo: {formatCurrency(rewardRealValue)} ÷ {formatCurrency(pointValue)} por ponto = {calculatedPoints.toLocaleString('pt-BR')} pontos
                    </p>
                  </div>
                )}

                <Button className="w-full" onClick={saveRewardItem} disabled={uploadingImage}>
                  {uploadingImage ? 'Enviando imagem...' : editingReward ? 'Salvar' : 'Cadastrar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>
        {/* REDEMPTIONS TAB */}
        <TabsContent value="redemptions" className="space-y-4 mt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Validar resgate</CardTitle></CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setScannerOpen(true)} className="gap-2">
                <ScanLine className="h-4 w-4" /> Escanear QR
              </Button>
              <div className="flex gap-2 flex-1">
                <Input placeholder="Ou digite o código" value={validateCode} onChange={e => setValidateCode(e.target.value.toUpperCase())} className="max-w-xs" />
                <Button variant="outline" onClick={handleValidateCode}>Validar</Button>
              </div>
            </CardContent>
          </Card>

          <RewardQRScannerDialog
            open={scannerOpen}
            onOpenChange={setScannerOpen}
            onConfirmed={() => { fetchRedemptions(); fetchTransactions(); fetchStats(); fetchRewardItems(); }}
          />

          <Card>
            <CardHeader><CardTitle className="text-base">Histórico de resgates</CardTitle></CardHeader>
            <CardContent>
              {redemptions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum resgate encontrado.</p>
              ) : (
                <div className="space-y-2">
                  {redemptions.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border">
                      <div>
                        <p className="font-medium">{r.clients?.name || 'Cliente'}</p>
                        <p className="text-xs text-muted-foreground">Código: <span className="font-mono font-bold">{r.redemption_code}</span> · {r.total_points} pts</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {format(parseISO(r.created_at), 'dd/MM/yy HH:mm')} · 
                          <span className={cn(
                            "ml-1",
                            r.status === 'pending' ? "text-amber-500" : r.status === 'confirmed' ? "text-success" : "text-destructive"
                          )}>
                            {r.status === 'pending' ? 'Pendente' : r.status === 'confirmed' ? 'Confirmado' : 'Cancelado'}
                          </span>
                        </p>
                      </div>
                      {r.status === 'pending' && (
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleValidateRedemption(r.id, 'cancelled')}><XCircle className="h-4 w-4 mr-1" /> Cancelar</Button>
                          <Button size="sm" onClick={() => handleValidateRedemption(r.id, 'confirmed')}><CheckCircle className="h-4 w-4 mr-1" /> Confirmar</Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
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
                        <th className="text-right p-3 font-medium">Valor equiv.</th>
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
                          <td className="p-3 text-right text-xs text-muted-foreground">
                            {pointValue > 0 ? formatCurrency(Math.abs(t.points) * pointValue) : '—'}
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
      ) : (
        <CashbackTab />
      )}
    </div>
  );
};

export default Loyalty;
