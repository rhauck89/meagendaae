import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalCache } from '@/hooks/useLocalCache';
import { ClientPortalSkeleton } from '@/components/ClientPortalSkeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PlatformLogo } from '@/components/PlatformLogo';
import { RedemptionQRDialog, type Redemption } from '@/components/RedemptionQRDialog';
import {
  Calendar, DollarSign, Star, Gift, User, LogOut, CheckCircle2,
  Sparkles, Home, ShoppingBag, KeyRound, ArrowRight,
  Building2, ChevronRight, Bell, Repeat, Wallet,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ClientRecord {
  id: string; company_id: string; name: string;
  whatsapp: string | null; email: string | null; birth_date: string | null;
  registration_complete: boolean;
  postal_code: string | null; street: string | null; address_number: string | null;
  district: string | null; city: string | null; state: string | null;
}
interface CompanyInfo { id: string; name: string; logo_url: string | null; slug?: string | null; }
interface AppointmentRow {
  id: string; start_time: string; end_time: string; total_price: number;
  status: string; company_id: string;
  company: { id: string; name: string; logo_url: string | null; slug: string | null } | null;
  professional: { id: string; full_name: string; avatar_url: string | null } | null;
  appointment_services: { service: { name: string } | null; price: number }[];
}
interface CashbackRow {
  id: string; amount: number; status: string; expires_at: string;
  created_at: string; company_id: string; promotion: { title: string } | null;
}
interface LoyaltyTx {
  id: string; points: number; transaction_type: string;
  description: string | null; balance_after: number; created_at: string; company_id: string;
}
interface RewardItem {
  id: string; name: string; description: string | null; image_url: string | null;
  item_type: string; points_required: number; real_value: number; extra_cost: number; company_id: string;
  stock_total: number | null; stock_available: number | null;
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente', confirmed: 'Confirmado', cancelled: 'Cancelado',
  completed: 'Concluído', no_show: 'Não compareceu',
};
const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-600', confirmed: 'bg-blue-500/10 text-blue-600',
  cancelled: 'bg-red-500/10 text-red-600', completed: 'bg-green-500/10 text-green-600',
  no_show: 'bg-muted text-muted-foreground',
};

/** Company logo + name */
const CompanyHeader = ({ company, size = 'sm' }: { company?: CompanyInfo; size?: 'sm' | 'md' | 'lg' }) => {
  if (!company) return null;
  const dim = size === 'lg' ? 'h-12 w-12' : size === 'md' ? 'h-10 w-10' : 'h-7 w-7';
  const txt = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs';
  return (
    <div className="flex items-center gap-2 min-w-0">
      {company.logo_url ? (
        <img src={company.logo_url} alt={company.name} className={`${dim} rounded-md object-cover shrink-0 border`} />
      ) : (
        <div className={`${dim} rounded-md bg-muted flex items-center justify-center shrink-0`}>
          <Building2 className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
      <span className={`${txt} font-medium truncate`}>{company.name}</span>
    </div>
  );
};

const ClientPortal = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [allCashbacks, setAllCashbacks] = useState<CashbackRow[]>([]);
  const [allLoyaltyTxs, setAllLoyaltyTxs] = useState<LoyaltyTx[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loyaltyConfigs, setLoyaltyConfigs] = useState<Record<string, any>>({});
  const [companies, setCompanies] = useState<Record<string, CompanyInfo>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('home');
  const [benefitsTab, setBenefitsTab] = useState('cashback');
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '', whatsapp: '', email: '', birth_date: '',
    postal_code: '', street: '', address_number: '', district: '', city: '', state: '',
  });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirm: '' });

  const [companyCashbackActive, setCompanyCashbackActive] = useState<Record<string, boolean>>({});
  const [companyLoyaltyActive, setCompanyLoyaltyActive] = useState<Record<string, boolean>>({});

  const [rewardsCompanyId, setRewardsCompanyId] = useState<string | null>(null);

  // Redemptions (QR + history)
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [activeRedemption, setActiveRedemption] = useState<Redemption | null>(null);
  const [activeRedemptionRewardName, setActiveRedemptionRewardName] = useState<string | undefined>(undefined);
  const [showRedemptionDialog, setShowRedemptionDialog] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // ---------- Cache (instant render + background revalidation) ----------
  const cacheKey = `client_portal_${user?.id || 'anon'}`;
  const { read: readCache, write: writeCache } = useLocalCache<{
    clients: ClientRecord[];
    appointments: AppointmentRow[];
    allCashbacks: CashbackRow[];
    allLoyaltyTxs: LoyaltyTx[];
    rewards: RewardItem[];
    companies: Record<string, CompanyInfo>;
    loyaltyConfigs: Record<string, any>;
    companyCashbackActive: Record<string, boolean>;
    companyLoyaltyActive: Record<string, boolean>;
  }>(cacheKey);

  const hasCacheRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    // Hydrate from cache instantly (no skeleton flash)
    const cached = readCache();
    if (cached) {
      hasCacheRef.current = true;
      setClients(cached.clients || []);
      setAppointments(cached.appointments || []);
      setAllCashbacks(cached.allCashbacks || []);
      setAllLoyaltyTxs(cached.allLoyaltyTxs || []);
      setRewards(cached.rewards || []);
      setCompanies(cached.companies || {});
      setLoyaltyConfigs(cached.loyaltyConfigs || {});
      setCompanyCashbackActive(cached.companyCashbackActive || {});
      setCompanyLoyaltyActive(cached.companyLoyaltyActive || {});
      setLoading(false);
      // Revalidate in background (do not block UI)
      loadClientData(true);
    } else {
      loadClientData(false);
    }

    // Background revalidation every 30s
    const interval = setInterval(() => {
      loadClientData(true);
    }, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const primaryClient = clients[0];
  const isRegistrationIncomplete = useMemo(() => {
    if (!primaryClient) return true;
    return !primaryClient.email || !primaryClient.birth_date;
  }, [primaryClient]);

  const loadClientData = async (isRevalidation = false) => {
    if (!isRevalidation) setLoading(true);
    try {
      const { data: profileData } = await supabase
        .from('profiles').select('whatsapp').eq('user_id', user!.id).single();

      if (profileData?.whatsapp || user!.email) {
        await supabase.rpc('link_client_to_user', {
          p_user_id: user!.id,
          p_phone: profileData?.whatsapp || '',
          p_email: user!.email || '',
        } as any);
      }

      const { data: clientData } = await supabase
        .from('clients')
        .select('id, company_id, name, whatsapp, email, birth_date, registration_complete, postal_code, street, address_number, district, city, state')
        .eq('user_id', user!.id);

      if (!clientData || clientData.length === 0) {
        if (!isRevalidation) { setClients([]); setLoading(false); }
        return;
      }
      setClients(clientData as ClientRecord[]);

      const companyIds = [...new Set(clientData.map(c => c.company_id))];
      const [companyRes, cashbackRes, loyaltyTxRes, rewardsRes] = await Promise.all([
        supabase.from('companies').select('id, name, logo_url, slug').in('id', companyIds),
        supabase.from('client_cashback')
          .select('id, amount, status, expires_at, created_at, company_id, promotion:promotions!client_cashback_promotion_id_fkey(title)')
          .in('client_id', clientData.map(c => c.id))
          .order('created_at', { ascending: false }),
        supabase.from('loyalty_points_transactions')
          .select('*')
          .in('client_id', clientData.map(c => c.id))
          .order('created_at', { ascending: false }).limit(300),
        // Loja: busca TODOS os itens ativos com info da empresa embutida (sem depender de vínculo client→company)
        supabase.from('loyalty_reward_items')
          .select(`
            id, name, description, points_required, real_value, extra_cost, image_url, item_type, company_id, stock_total, stock_available,
            company:companies!loyalty_reward_items_company_id_fkey(id, name, logo_url, slug)
          `)
          .eq('active', true),
      ]);

      // Load redemptions (history + active QR codes) — separate so it can be refreshed independently
      const { data: redemptionsData } = await supabase
        .from('loyalty_redemptions')
        .select('id, redemption_code, status, created_at, total_points, reward_id, company_id, client_id')
        .in('client_id', clientData.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(50);
      setRedemptions((redemptionsData || []) as Redemption[]);

      const companiesMap: Record<string, CompanyInfo> = {};
      if (companyRes.data) {
        companyRes.data.forEach((c: any) => { companiesMap[c.id] = { id: c.id, name: c.name, logo_url: c.logo_url, slug: c.slug }; });
      }
      // Hidrata o mapa de empresas com as que vieram via recompensas (multi-empresa real)
      if (rewardsRes.data) {
        for (const r of rewardsRes.data as any[]) {
          if (r.company && !companiesMap[r.company.id]) {
            companiesMap[r.company.id] = { id: r.company.id, name: r.company.name, logo_url: r.company.logo_url, slug: r.company.slug };
          }
        }
      }
      setCompanies(companiesMap);
      // Auto-select handled by dedicated effect (after points are aggregated)

      console.log('[ClientPortal][Loja] rewards loaded:', {
        count: rewardsRes.data?.length || 0,
        companies: [...new Set((rewardsRes.data || []).map((r: any) => r.company_id))],
        error: rewardsRes.error,
      });

      setAllCashbacks((cashbackRes.data || []) as any);
      setAllLoyaltyTxs((loyaltyTxRes.data || []) as any);
      setRewards((rewardsRes.data || []) as any);

      const cashActive: Record<string, boolean> = {};
      const loyalActive: Record<string, boolean> = {};
      const lcMap: Record<string, any> = {};
      for (const cid of companyIds) {
        const [promoCheck, lcRes] = await Promise.all([
          supabase.from('promotions').select('id').eq('company_id', cid).eq('promotion_type', 'cashback').eq('status', 'active').limit(1),
          supabase.from('loyalty_config').select('*').eq('company_id', cid).single(),
        ]);
        cashActive[cid] = !!(promoCheck.data && promoCheck.data.length > 0);
        loyalActive[cid] = !!lcRes.data?.enabled;
        if (lcRes.data) lcMap[cid] = lcRes.data;
      }
      setCompanyCashbackActive(cashActive);
      setCompanyLoyaltyActive(loyalActive);
      setLoyaltyConfigs(lcMap);

      const clientIds = clientData.map(c => c.id);
      const { data: aptData, error: aptErr } = await supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, total_price, status, company_id,
          company:companies!appointments_company_id_fkey(id, name, logo_url, slug),
          professional:profiles!appointments_professional_id_fkey(id, full_name, avatar_url),
          appointment_services(price, service:services(id, name))
        `)
        .in('client_id', clientIds)
        .order('start_time', { ascending: false }).limit(200);
      if (aptErr) console.error('[ClientPortal] appointments query error:', aptErr);
      setAppointments((aptData || []) as any);

      if (aptData) {
        for (const a of aptData as any[]) {
          if (a.company && !companiesMap[a.company.id]) {
            companiesMap[a.company.id] = { id: a.company.id, name: a.company.name, logo_url: a.company.logo_url, slug: a.company.slug };
          }
        }
        setCompanies({ ...companiesMap });
      }

      const c = clientData[0];
      setProfileForm({
        name: c.name || '', whatsapp: c.whatsapp || '', email: c.email || '',
        birth_date: c.birth_date || '',
        postal_code: (c as any).postal_code || '', street: (c as any).street || '',
        address_number: (c as any).address_number || '', district: (c as any).district || '',
        city: (c as any).city || '', state: (c as any).state || '',
      });

      // Persist snapshot to cache only on success (don't overwrite on errors)
      writeCache({
        clients: clientData as ClientRecord[],
        appointments: (aptData || []) as any,
        allCashbacks: (cashbackRes.data || []) as any,
        allLoyaltyTxs: (loyaltyTxRes.data || []) as any,
        rewards: (rewardsRes.data || []) as any,
        companies: companiesMap,
        loyaltyConfigs: lcMap,
        companyCashbackActive: cashActive,
        companyLoyaltyActive: loyalActive,
      });
    } catch (err) {
      console.error('[ClientPortal] load error:', err);
    } finally {
      if (!isRevalidation) setLoading(false);
    }
  };

  // ---------- Aggregations ----------
  const cashbackByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cb of allCashbacks) {
      if (cb.status === 'active' && !isPast(parseISO(cb.expires_at))) {
        map[cb.company_id] = (map[cb.company_id] || 0) + Number(cb.amount);
      }
    }
    return map;
  }, [allCashbacks]);
  const totalCashback = useMemo(
    () => Object.values(cashbackByCompany).reduce((s, v) => s + v, 0), [cashbackByCompany]);

  const pointsByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of allLoyaltyTxs) {
      if (map[tx.company_id] === undefined) map[tx.company_id] = tx.balance_after;
    }
    return map;
  }, [allLoyaltyTxs]);
  const totalPoints = useMemo(
    () => Object.values(pointsByCompany).reduce((s, v) => s + v, 0), [pointsByCompany]);

  const upcomingAppointments = useMemo(
    () => appointments.filter(a => !isPast(parseISO(a.start_time)) && !['cancelled', 'no_show'].includes(a.status)),
    [appointments]);
  const pastAppointments = useMemo(
    () => appointments.filter(a => isPast(parseISO(a.start_time)) || ['cancelled', 'no_show'].includes(a.status)),
    [appointments]);
  const completedAppointments = pastAppointments.filter(a => a.status === 'completed');
  const completedCount = completedAppointments.length;
  const nextAppointment = [...upcomingAppointments].sort(
    (a, b) => parseISO(a.start_time).getTime() - parseISO(b.start_time).getTime()
  )[0];
  const lastAppointment = completedAppointments[0];

  const rewardsCompany = rewardsCompanyId ? companies[rewardsCompanyId] : null;
  const rewardsList = useMemo(
    () => rewards.filter(r => r.company_id === rewardsCompanyId),
    [rewards, rewardsCompanyId]);
  const rewardsBalance = rewardsCompanyId ? (pointsByCompany[rewardsCompanyId] || 0) : 0;
  const rewardsConfig = rewardsCompanyId ? loyaltyConfigs[rewardsCompanyId] : null;
  const rewardsPointValue = rewardsConfig?.point_value || 0.05;

  const companiesWithCashback = useMemo(
    () => Object.values(companies).filter(c => companyCashbackActive[c.id]),
    [companies, companyCashbackActive]);
  const companiesWithLoyalty = useMemo(
    () => Object.values(companies).filter(c => companyLoyaltyActive[c.id]),
    [companies, companyLoyaltyActive]);

  // Loja: empresas com itens ativos, ordenadas (1) com pontos > 0, (2) com histórico, (3) outras
  const appointmentCompanyIds = useMemo(
    () => new Set(appointments.map(a => a.company_id)),
    [appointments]);
  const companiesWithRewards = useMemo(() => {
    const ids = [...new Set(rewards.map(r => r.company_id))];
    const list = ids.map(id => companies[id]).filter(Boolean) as CompanyInfo[];
    return list.sort((a, b) => {
      const pa = pointsByCompany[a.id] || 0;
      const pb = pointsByCompany[b.id] || 0;
      if (pa !== pb) return pb - pa; // mais pontos primeiro
      const ha = appointmentCompanyIds.has(a.id) ? 1 : 0;
      const hb = appointmentCompanyIds.has(b.id) ? 1 : 0;
      if (ha !== hb) return hb - ha; // histórico primeiro
      return a.name.localeCompare(b.name);
    });
  }, [rewards, companies, pointsByCompany, appointmentCompanyIds]);

  // Auto-seleciona empresa com mais pontos (ou primeira ordenada) quando a Loja carrega
  useEffect(() => {
    if (rewardsCompanyId) return;
    if (companiesWithRewards.length === 0) return;
    setRewardsCompanyId(companiesWithRewards[0].id);
  }, [companiesWithRewards, rewardsCompanyId]);

  const anyCashback = companiesWithCashback.length > 0;
  const anyLoyalty = companiesWithLoyalty.length > 0;
  const anyRewards = companiesWithRewards.length > 0;

  // ---------- Redemptions: refresh + create (transactional via RPC) ----------
  const refreshRedemptions = async () => {
    if (!clients.length) return;
    const { data } = await supabase
      .from('loyalty_redemptions')
      .select('id, redemption_code, status, created_at, total_points, reward_id, company_id, client_id')
      .in('client_id', clients.map(c => c.id))
      .order('created_at', { ascending: false })
      .limit(50);
    setRedemptions((data || []) as Redemption[]);
    return (data || []) as Redemption[];
  };

  const createRedemption = async (
    reward: { id: string; company_id: string; name: string; points_required: number },
  ): Promise<Redemption | null> => {
    const clientRow = clients.find(c => c.company_id === reward.company_id);
    if (!clientRow) {
      toast.error('Você precisa ter um cadastro nesta empresa.');
      return null;
    }
    const { data, error } = await supabase.rpc('redeem_reward', {
      p_client_id: clientRow.id,
      p_company_id: reward.company_id,
      p_reward_id: reward.id,
    });
    if (error) {
      toast.error(error.message || 'Não foi possível criar o resgate.');
      return null;
    }
    const newId = (data as any)?.id as string | undefined;
    const list = await refreshRedemptions();
    const created = list?.find(r => r.id === newId) || null;
    return created;
  };

  const openRedemption = (redemption: Redemption, rewardName?: string) => {
    setActiveRedemption(redemption);
    setActiveRedemptionRewardName(rewardName);
    setShowRedemptionDialog(true);
  };

  const handleRegenerateActive = async () => {
    if (!activeRedemption) return;
    // Find the original reward to call RPC again
    const reward = rewards.find(r => r.id === activeRedemption.reward_id);
    if (!reward) {
      toast.error('Recompensa não encontrada para regenerar.');
      return;
    }
    setRegenerating(true);
    try {
      const created = await createRedemption(reward);
      if (created) {
        setActiveRedemption(created);
        setActiveRedemptionRewardName(reward.name);
        toast.success('Novo código gerado.');
      }
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!primaryClient) return;
    setSavingProfile(true);
    const updates: any = {
      name: profileForm.name, whatsapp: profileForm.whatsapp, email: profileForm.email,
      birth_date: profileForm.birth_date || null,
      postal_code: profileForm.postal_code || null, street: profileForm.street || null,
      address_number: profileForm.address_number || null, district: profileForm.district || null,
      city: profileForm.city || null, state: profileForm.state || null,
      registration_complete: !!(profileForm.email && profileForm.birth_date),
    };
    for (const client of clients) {
      await supabase.from('clients').update(updates).eq('id', client.id);
    }
    toast.success('Perfil atualizado!');
    setShowCompleteProfile(false);
    setSavingProfile(false);
    loadClientData();
  };

  const handleChangePassword = async () => {
    if (passwordForm.newPassword.length < 6) { toast.error('Senha deve ter pelo menos 6 caracteres'); return; }
    if (passwordForm.newPassword !== passwordForm.confirm) { toast.error('As senhas não coincidem'); return; }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    setSavingPassword(false);
    if (error) { toast.error('Erro ao alterar senha'); return; }
    toast.success('Senha alterada com sucesso!');
    setPasswordForm({ newPassword: '', confirm: '' });
    setShowPasswordDialog(false);
  };

  const goRebook = (companyId: string) => {
    const co = companies[companyId];
    if (co?.slug) navigate(`/${co.slug}`);
    else navigate('/');
  };

  // Unauthenticated
  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-5">
        <User className="h-16 w-16 mx-auto text-primary/60" />
        <div>
          <h2 className="text-xl font-bold">Sua conta</h2>
          <p className="text-muted-foreground text-sm mt-2">
            Crie sua conta para acompanhar seus agendamentos, cashback e benefícios.
          </p>
        </div>
        <div className="space-y-3">
          <Button onClick={() => navigate('/cliente/auth?tab=signup')} className="w-full">Criar conta</Button>
          <Button variant="outline" onClick={() => navigate('/cliente/auth?tab=login')} className="w-full">Fazer login</Button>
        </div>
        <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    </div>
  );

  if (loading) return <ClientPortalSkeleton />;

  if (clients.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <User className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Você ainda não possui agendamentos</h2>
        <p className="text-muted-foreground text-sm">Que tal agendar seu primeiro horário?</p>
        <Button onClick={() => navigate('/')} className="w-full">Agendar agora</Button>
        <Button variant="ghost" onClick={signOut} className="w-full text-sm">
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );

  // 4-tab bottom nav
  const bottomTabs = [
    { value: 'home', icon: Home, label: 'Início' },
    { value: 'agenda', icon: Calendar, label: 'Agenda' },
    { value: 'benefits', icon: Gift, label: 'Benefícios' },
    { value: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="min-h-screen bg-muted/30 pb-24">
      {/* ============ HEADER (Agendaê identity) ============ */}
      <header className="bg-card border-b sticky top-0 z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="scale-150 origin-left">
              <PlatformLogo onDarkBackground={false} />
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Notificações">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <p className="text-lg font-bold leading-tight">
              Olá, {primaryClient?.name?.split(' ')[0] || 'cliente'} 👋
            </p>
            <p className="text-xs text-muted-foreground">
              Seus agendamentos, cashback e pontos
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-5">
        {/* Profile incomplete banner */}
        {isRegistrationIncomplete && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="flex-1 space-y-2">
                <p className="font-semibold text-sm">👋 Complete seu cadastro para liberar benefícios</p>
                <Button size="sm" onClick={() => { setActiveTab('profile'); setShowCompleteProfile(true); }}>
                  Completar agora
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* ============ HOME ============ */}
          <TabsContent value="home" className="space-y-5 mt-0">
            {/* Horizontal scroll summary cards */}
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 pb-2" style={{ minWidth: 'max-content' }}>
                <button
                  onClick={() => setActiveTab('agenda')}
                  className="w-56 shrink-0 rounded-2xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground p-4 text-left shadow-md active:scale-95 transition-transform"
                >
                  <Calendar className="h-6 w-6 mb-3 opacity-90" />
                  <p className="text-3xl font-bold">{upcomingAppointments.length}</p>
                  <p className="text-xs opacity-90">Próximos agendamentos</p>
                  <p className="text-[11px] mt-2 flex items-center gap-1 opacity-80">
                    Ver agenda <ArrowRight className="h-3 w-3" />
                  </p>
                </button>

                <button
                  onClick={() => { setActiveTab('benefits'); setBenefitsTab('cashback'); }}
                  className="w-56 shrink-0 rounded-2xl bg-card border p-4 text-left shadow-sm active:scale-95 transition-transform"
                >
                  <Wallet className="h-6 w-6 mb-3 text-green-600" />
                  <p className="text-3xl font-bold text-green-600">R$ {totalCashback.toFixed(2)}</p>
                  <p className="text-xs text-muted-foreground">Cashback total</p>
                  <p className="text-[11px] mt-2 flex items-center gap-1 text-muted-foreground">
                    Ver detalhes <ArrowRight className="h-3 w-3" />
                  </p>
                </button>

                <button
                  onClick={() => { setActiveTab('benefits'); setBenefitsTab('points'); }}
                  className="w-56 shrink-0 rounded-2xl bg-card border p-4 text-left shadow-sm active:scale-95 transition-transform"
                >
                  <Star className="h-6 w-6 mb-3 text-yellow-500" />
                  <p className="text-3xl font-bold text-yellow-600">{totalPoints}</p>
                  <p className="text-xs text-muted-foreground">Pontos totais</p>
                  <p className="text-[11px] mt-2 flex items-center gap-1 text-muted-foreground">
                    Ver detalhes <ArrowRight className="h-3 w-3" />
                  </p>
                </button>

                <button
                  onClick={() => setActiveTab('agenda')}
                  className="w-56 shrink-0 rounded-2xl bg-card border p-4 text-left shadow-sm active:scale-95 transition-transform"
                >
                  <CheckCircle2 className="h-6 w-6 mb-3 text-green-500" />
                  <p className="text-3xl font-bold">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Atendimentos realizados</p>
                  <p className="text-[11px] mt-2 flex items-center gap-1 text-muted-foreground">
                    Ver histórico <ArrowRight className="h-3 w-3" />
                  </p>
                </button>
              </div>
            </div>

            {/* Próximo agendamento */}
            <div>
              <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Próximo agendamento
              </h2>
              {nextAppointment ? (
                <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-transparent overflow-hidden">
                  <CardContent className="p-5 space-y-3">
                    <CompanyHeader company={companies[nextAppointment.company_id]} size="md" />
                    <div className="flex items-baseline gap-3">
                      <p className="text-3xl font-bold">
                        {format(parseISO(nextAppointment.start_time), 'dd/MM', { locale: ptBR })}
                      </p>
                      <p className="text-2xl font-bold text-primary">
                        {format(parseISO(nextAppointment.start_time), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(nextAppointment.start_time), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <div className="space-y-1 pt-1">
                      <p className="text-sm font-medium">
                        {nextAppointment.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                      </p>
                      {nextAppointment.professional && (
                        <p className="text-xs text-muted-foreground">
                          com <strong>{nextAppointment.professional.full_name}</strong>
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" className="flex-1" onClick={() => navigate(`/reschedule/${nextAppointment.id}`)}>
                        Remarcar
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setActiveTab('agenda')}>
                        Ver detalhes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-6 text-center space-y-3">
                    <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Você não tem agendamentos futuros</p>
                    <Button size="sm" onClick={() => navigate('/')}>Agendar agora</Button>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Último atendimento */}
            {lastAppointment && (
              <div>
                <h2 className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-muted-foreground" /> Último atendimento
                </h2>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <CompanyHeader company={companies[lastAppointment.company_id]} />
                    <div>
                      <p className="text-sm font-medium">
                        {lastAppointment.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                      </p>
                      {lastAppointment.professional && (
                        <p className="text-xs text-muted-foreground">com {lastAppointment.professional.full_name}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(parseISO(lastAppointment.start_time), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="w-full" onClick={() => goRebook(lastAppointment.company_id)}>
                      <Repeat className="h-3.5 w-3.5 mr-1.5" /> Repetir agendamento
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Benefícios resumo por empresa */}
            {anyCashback && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" /> Cashback por estabelecimento
                  </h2>
                  <button
                    className="text-xs text-primary font-medium"
                    onClick={() => { setActiveTab('benefits'); setBenefitsTab('cashback'); }}
                  >
                    Ver detalhes
                  </button>
                </div>
                <div className="space-y-2">
                  {companiesWithCashback.map(co => (
                    <Card key={co.id}>
                      <CardContent className="p-3 flex items-center justify-between gap-2">
                        <CompanyHeader company={co} />
                        <p className="text-base font-bold text-green-600">
                          R$ {(cashbackByCompany[co.id] || 0).toFixed(2)}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {anyLoyalty && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Star className="h-4 w-4 text-yellow-500" /> Pontos por estabelecimento
                  </h2>
                  <button
                    className="text-xs text-primary font-medium"
                    onClick={() => { setActiveTab('benefits'); setBenefitsTab('points'); }}
                  >
                    Ver detalhes
                  </button>
                </div>
                <div className="space-y-2">
                  {companiesWithLoyalty.map(co => {
                    const balance = pointsByCompany[co.id] || 0;
                    const companyRewards = rewards.filter(r => r.company_id === co.id);
                    const next = companyRewards
                      .map(r => ({ ...r, diff: r.points_required - balance }))
                      .filter(r => r.diff > 0).sort((a, b) => a.diff - b.diff)[0];
                    return (
                      <Card key={co.id}>
                        <CardContent className="p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <CompanyHeader company={co} />
                            <p className="text-base font-bold text-yellow-600">{balance} pts</p>
                          </div>
                          {next && (
                            <>
                              <Progress value={(balance / next.points_required) * 100} className="h-1.5" />
                              <p className="text-[11px] text-muted-foreground">
                                Faltam <strong>{next.diff}</strong> pontos para <strong>{next.name}</strong>
                              </p>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* ============ AGENDA ============ */}
          <TabsContent value="agenda" className="space-y-5 mt-0">
            <Tabs defaultValue="upcoming">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="upcoming">Próximos</TabsTrigger>
                <TabsTrigger value="history">Histórico</TabsTrigger>
              </TabsList>

              <TabsContent value="upcoming" className="space-y-4 mt-4">
                {upcomingAppointments.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <Calendar className="h-10 w-10 mx-auto text-muted-foreground/40" />
                      <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
                      <Button size="sm" onClick={() => navigate('/')}>Agendar</Button>
                    </CardContent>
                  </Card>
                ) : (
                  Object.entries(
                    upcomingAppointments.reduce<Record<string, AppointmentRow[]>>((acc, a) => {
                      (acc[a.company_id] ||= []).push(a); return acc;
                    }, {})
                  ).map(([cid, list]) => (
                    <div key={cid} className="space-y-3">
                      {list.map(apt => {
                        const co = companies[cid];
                        const serviceNames = apt.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ');
                        return (
                          <Card key={apt.id} className="rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                            <CardContent className="p-5 space-y-4">
                              {/* HEADER: company + professional */}
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  {co?.logo_url ? (
                                    <img src={co.logo_url} alt={co.name} className="h-11 w-11 rounded-lg object-cover border shrink-0" />
                                  ) : (
                                    <div className="h-11 w-11 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                      <Building2 className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="font-semibold text-sm truncate">{co?.name || apt.company?.name || 'Empresa não encontrada'}</p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {apt.professional?.avatar_url && (
                                        <img src={apt.professional.avatar_url} alt="" className="h-4 w-4 rounded-full object-cover" />
                                      )}
                                      <p className="text-xs text-muted-foreground truncate">
                                        com {apt.professional?.full_name || 'Profissional não informado'}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                <Badge className={`${statusColors[apt.status] || 'bg-muted'} shrink-0`}>
                                  {statusLabels[apt.status] || apt.status}
                                </Badge>
                              </div>

                              {/* BODY: service */}
                              <div className="border-t border-b py-3">
                                <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5">Serviço</p>
                                <p className="text-base font-semibold leading-snug">
                                  {serviceNames || '—'}
                                </p>
                              </div>

                              {/* FOOTER: date + time + actions */}
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-xs text-muted-foreground capitalize">
                                    {format(parseISO(apt.start_time), "EEE, dd 'de' MMM", { locale: ptBR })}
                                  </p>
                                  <p className="text-xl font-bold text-primary leading-tight">
                                    {format(parseISO(apt.start_time), 'HH:mm')}
                                  </p>
                                </div>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => navigate(`/reschedule/${apt.id}`)}>
                                    Remarcar
                                  </Button>
                                  <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive" onClick={() => navigate(`/cancel/${apt.id}`)}>
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-3 mt-4">
                {pastAppointments.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum agendamento anterior
                    </CardContent>
                  </Card>
                ) : (
                  pastAppointments.slice(0, 50).map(apt => (
                    <Card key={apt.id}>
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-start gap-2">
                          <CompanyHeader company={companies[apt.company_id]} />
                          <Badge className={`${statusColors[apt.status] || 'bg-muted'} text-xs`}>
                            {statusLabels[apt.status] || apt.status}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-end gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">
                              {format(parseISO(apt.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {apt.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                              {apt.professional && ` · ${apt.professional.full_name}`}
                            </p>
                          </div>
                          <p className="text-sm font-semibold shrink-0">R$ {Number(apt.total_price).toFixed(2)}</p>
                        </div>
                        {apt.status === 'completed' && (
                          <Button size="sm" variant="outline" className="w-full" onClick={() => goRebook(apt.company_id)}>
                            <Repeat className="h-3.5 w-3.5 mr-1.5" /> Repetir
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ============ BENEFITS (sub-tabs) ============ */}
          <TabsContent value="benefits" className="space-y-4 mt-0">
            <Tabs value={benefitsTab} onValueChange={setBenefitsTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="cashback">Cashback</TabsTrigger>
                <TabsTrigger value="points">Pontos</TabsTrigger>
                <TabsTrigger value="store">Loja</TabsTrigger>
              </TabsList>

              {/* CASHBACK */}
              <TabsContent value="cashback" className="space-y-4 mt-4">
                {!anyCashback ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <DollarSign className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold">Você ainda não acumulou pontos ou cashback</p>
                      <p className="text-sm text-muted-foreground">
                        Agende um serviço para começar a ganhar benefícios.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="bg-gradient-to-br from-green-500/10 to-transparent border-green-500/20">
                      <CardContent className="p-5 text-center">
                        <p className="text-xs text-muted-foreground">Cashback total disponível</p>
                        <p className="text-4xl font-bold text-green-600 mt-1">R$ {totalCashback.toFixed(2)}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Em {companiesWithCashback.length} {companiesWithCashback.length === 1 ? 'estabelecimento' : 'estabelecimentos'}
                        </p>
                      </CardContent>
                    </Card>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Saldo por estabelecimento</h3>
                      {companiesWithCashback.map(co => (
                        <Card key={co.id}>
                          <CardContent className="p-3 flex items-center justify-between gap-2">
                            <CompanyHeader company={co} size="md" />
                            <div className="text-right">
                              <p className="text-lg font-bold text-green-600">
                                R$ {(cashbackByCompany[co.id] || 0).toFixed(2)}
                              </p>
                              <p className="text-[10px] text-muted-foreground">disponível</p>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
                      {allCashbacks.length === 0 ? (
                        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                          Nenhum cashback registrado ainda
                        </CardContent></Card>
                      ) : (
                        allCashbacks.map(cb => {
                          const daysLeft = differenceInDays(parseISO(cb.expires_at), new Date());
                          return (
                            <Card key={cb.id}>
                              <CardContent className="p-3">
                                <div className="flex justify-between items-start gap-2">
                                  <div className="min-w-0 space-y-1">
                                    <CompanyHeader company={companies[cb.company_id]} />
                                    <p className="text-sm font-medium">+ R$ {Number(cb.amount).toFixed(2)}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {cb.promotion?.title || 'Promoção'}
                                    </p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    {cb.status === 'active' && daysLeft > 0 ? (
                                      <Badge className={daysLeft <= 10 ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600'}>
                                        {daysLeft <= 10 ? `Expira em ${daysLeft}d` : `${daysLeft}d restantes`}
                                      </Badge>
                                    ) : cb.status === 'used' ? (
                                      <Badge className="bg-blue-500/10 text-blue-600">Usado</Badge>
                                    ) : (
                                      <Badge className="bg-muted text-muted-foreground">Expirado</Badge>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* POINTS */}
              <TabsContent value="points" className="space-y-4 mt-4">
                {!anyLoyalty ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <Star className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold">Você ainda não possui pontos</p>
                      <p className="text-sm text-muted-foreground">
                        Quando os estabelecimentos ativarem o programa de fidelidade, seus pontos aparecerão aqui.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <Card className="bg-gradient-to-br from-yellow-500/10 to-transparent border-yellow-500/20">
                      <CardContent className="p-5 text-center">
                        <p className="text-xs text-muted-foreground">Total de pontos</p>
                        <p className="text-4xl font-bold text-yellow-600 mt-1">{totalPoints}</p>
                        <p className="text-[11px] text-muted-foreground mt-1">
                          Em {companiesWithLoyalty.length} {companiesWithLoyalty.length === 1 ? 'estabelecimento' : 'estabelecimentos'}
                        </p>
                      </CardContent>
                    </Card>

                    {companiesWithLoyalty.map(co => {
                      const balance = pointsByCompany[co.id] || 0;
                      const cfg = loyaltyConfigs[co.id];
                      const pointVal = cfg?.point_value || 0.05;
                      const companyRewards = rewards.filter(r => r.company_id === co.id);
                      const next = companyRewards
                        .map(r => ({ ...r, diff: r.points_required - balance }))
                        .filter(r => r.diff > 0).sort((a, b) => a.diff - b.diff)[0];
                      return (
                        <Card key={co.id}>
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between gap-2">
                              <CompanyHeader company={co} size="md" />
                              <div className="text-right">
                                <p className="text-2xl font-bold text-yellow-600">{balance}</p>
                                <p className="text-[10px] text-muted-foreground">pontos</p>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-2">
                            {pointVal > 0 && balance > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Equivalente a R$ {(balance * pointVal).toFixed(2)}
                              </p>
                            )}
                            {next ? (
                              <>
                                <div className="flex justify-between text-xs">
                                  <span className="font-medium truncate">Próxima: {next.name}</span>
                                  <span className="text-muted-foreground shrink-0">{balance}/{next.points_required}</span>
                                </div>
                                <Progress value={(balance / next.points_required) * 100} />
                                <p className="text-xs text-muted-foreground">
                                  Faltam <strong>{next.diff}</strong> pontos para recompensa
                                </p>
                              </>
                            ) : (
                              <p className="text-xs text-muted-foreground">Sem recompensas configuradas.</p>
                            )}
                            <Button size="sm" variant="outline" className="w-full mt-2" onClick={() => {
                              setRewardsCompanyId(co.id); setBenefitsTab('store');
                            }}>
                              Ver recompensas <ChevronRight className="h-3 w-3 ml-1" />
                            </Button>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">Movimentações recentes</h3>
                      {allLoyaltyTxs.length === 0 ? (
                        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                          Nenhuma movimentação ainda
                        </CardContent></Card>
                      ) : (
                        allLoyaltyTxs.slice(0, 30).map(tx => (
                          <Card key={tx.id}>
                            <CardContent className="p-3">
                              <div className="flex justify-between items-center gap-2">
                                <div className="min-w-0 space-y-1">
                                  <CompanyHeader company={companies[tx.company_id]} />
                                  <p className="text-sm font-medium">
                                    {tx.transaction_type === 'earn' ? '+' : '-'}{tx.points} pontos
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {tx.description || (tx.transaction_type === 'earn' ? 'Serviço concluído' : 'Resgate')}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-xs text-muted-foreground">
                                    {format(parseISO(tx.created_at), 'dd/MM/yy')}
                                  </p>
                                  <p className="text-xs">Saldo: {tx.balance_after}</p>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </TabsContent>

              {/* STORE */}
              <TabsContent value="store" className="space-y-4 mt-4">
                {!anyRewards ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold">Loja indisponível</p>
                      <p className="text-sm text-muted-foreground">
                        Nenhum estabelecimento publicou recompensas no momento.
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Seletor horizontal estilo Livelo: logos coloridas (com pontos) vs grayscale (sem pontos) */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-2">
                        Escolha o estabelecimento:
                      </p>
                      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                        {companiesWithRewards.map(co => {
                          const pts = pointsByCompany[co.id] || 0;
                          const hasPoints = pts > 0;
                          const isSelected = rewardsCompanyId === co.id;
                          return (
                            <button
                              key={co.id}
                              onClick={() => setRewardsCompanyId(co.id)}
                              className={`shrink-0 flex flex-col items-center gap-2 w-24 transition-all duration-200 ${
                                isSelected ? 'scale-110' : hasPoints ? 'hover:scale-105' : ''
                              }`}
                            >
                              <div className={`relative h-20 w-20 rounded-full border-2 flex items-center justify-center overflow-hidden bg-card transition-all ${
                                isSelected
                                  ? 'border-primary ring-4 ring-primary/20 shadow-lg'
                                  : hasPoints
                                    ? 'border-primary/40 shadow-sm'
                                    : 'border-border/40'
                              } ${!hasPoints && !isSelected ? 'grayscale opacity-40' : ''}`}>
                                {co.logo_url ? (
                                  <img src={co.logo_url} alt={co.name} className="h-full w-full object-cover" />
                                ) : (
                                  <Building2 className="h-8 w-8 text-muted-foreground" />
                                )}
                                {hasPoints && (
                                  <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-[10px] font-bold rounded-full h-6 min-w-6 px-1.5 flex items-center justify-center shadow-md ring-2 ring-background">
                                    {pts > 999 ? '999+' : pts}
                                  </span>
                                )}
                              </div>
                              <span className={`text-[11px] font-medium text-center line-clamp-2 leading-tight ${
                                isSelected ? 'text-foreground font-semibold' : 'text-muted-foreground'
                              }`}>
                                {co.name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Saldo na empresa selecionada */}
                    {rewardsCompany && (
                      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                        <CardContent className="p-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            {rewardsCompany.logo_url ? (
                              <img src={rewardsCompany.logo_url} alt={rewardsCompany.name} className="h-10 w-10 rounded-lg object-cover border" />
                            ) : (
                              <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                                <Building2 className="h-5 w-5 text-muted-foreground" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xs text-muted-foreground">Seus pontos nesta empresa</p>
                              <p className="text-sm font-semibold truncate">{rewardsCompany.name}</p>
                            </div>
                          </div>
                          <p className="text-2xl font-bold text-primary shrink-0">{rewardsBalance}<span className="text-sm font-medium ml-1">pts</span></p>
                        </CardContent>
                      </Card>
                    )}

                    {rewardsList.length === 0 ? (
                      <Card>
                        <CardContent className="p-6 text-center space-y-2">
                          <Gift className="h-8 w-8 mx-auto text-muted-foreground/40" />
                          <p className="text-sm text-muted-foreground">
                            Sem recompensas neste estabelecimento.
                          </p>
                        </CardContent>
                      </Card>
                    ) : (() => {
                      const sorted = [...rewardsList].sort(
                        (a, b) => (a.points_required - rewardsBalance) - (b.points_required - rewardsBalance)
                      );
                      const featured = sorted.filter(r => rewardsBalance >= r.points_required);
                      const closest = sorted.filter(r => rewardsBalance < r.points_required);

                      const handleRedeem = async (reward: typeof rewardsList[number]) => {
                        // Reuse an existing pending+non-expired redemption for this reward, if any
                        const existing = redemptions.find(r =>
                          r.reward_id === reward.id &&
                          r.status === 'pending' &&
                          (Date.now() - new Date(r.created_at).getTime()) < 15 * 60_000
                        );
                        if (existing) {
                          openRedemption(existing, reward.name);
                          return;
                        }
                        const created = await createRedemption(reward);
                        if (created) {
                          openRedemption(created, reward.name);
                          toast.success('Resgate criado! Apresente o QR Code.');
                        }
                      };

                      const renderCard = (reward: typeof rewardsList[number]) => {
                        const hasStockControl = reward.stock_total !== null;
                        const stockLeft = reward.stock_available;
                        const outOfStock = hasStockControl && (stockLeft ?? 0) <= 0;
                        const hasPoints = rewardsBalance >= reward.points_required;
                        const canRedeem = hasPoints && !outOfStock;
                        const diff = reward.points_required - rewardsBalance;
                        const progress = Math.min(100, (rewardsBalance / reward.points_required) * 100);
                        return (
                          <Card
                            key={reward.id}
                            className={`overflow-hidden transition-all duration-200 hover:shadow-lg ${
                              canRedeem
                                ? 'border-green-500/50 shadow-md ring-1 ring-green-500/20'
                                : 'shadow-md hover:-translate-y-0.5'
                            }`}
                          >
                            <CardContent className="p-0">
                              {/* 1. EMPRESA */}
                              <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-primary/5 via-primary/[0.02] to-transparent border-b">
                                <div className="relative shrink-0">
                                  {rewardsCompany?.logo_url ? (
                                    <img
                                      src={rewardsCompany.logo_url}
                                      alt={rewardsCompany.name}
                                      className="h-12 w-12 rounded-xl object-cover border-2 border-background shadow-sm ring-1 ring-border"
                                    />
                                  ) : (
                                    <div className="h-12 w-12 rounded-xl bg-primary/10 border-2 border-background shadow-sm ring-1 ring-border flex items-center justify-center">
                                      <Building2 className="h-6 w-6 text-primary" />
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold truncate text-foreground">{rewardsCompany?.name}</p>
                                  <p className="text-[10px] text-muted-foreground leading-tight flex items-center gap-1 mt-0.5">
                                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary/60" />
                                    Resgatável apenas neste estabelecimento
                                  </p>
                                </div>
                              </div>

                              {/* 2. PRODUTO */}
                              <div className="p-4 flex gap-4">
                                <div className="w-24 h-24 rounded-xl overflow-hidden border shadow-sm shrink-0 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                                  {reward.image_url ? (
                                    <img
                                      src={reward.image_url}
                                      alt={reward.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : (
                                    <Gift className="h-9 w-9 text-primary/70" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col">
                                  <p className="font-semibold text-sm leading-tight text-foreground line-clamp-2">{reward.name}</p>
                                  {reward.description && (
                                    <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{reward.description}</p>
                                  )}
                                  <div className="mt-auto pt-2.5 flex items-center gap-2 flex-wrap">
                                    <div className="inline-flex items-baseline gap-1 bg-primary/10 text-primary rounded-full px-3 py-1 border border-primary/20">
                                      <span className="text-lg font-extrabold leading-none">{reward.points_required}</span>
                                      <span className="text-[10px] font-semibold uppercase tracking-wide">pts</span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground">
                                      Você tem <strong className="text-foreground">{rewardsBalance}</strong>
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Status / progresso / estoque */}
                              <div className="px-4 pb-2 space-y-1.5">
                                {hasPoints ? (
                                  <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/20 text-[11px] border-0 font-semibold">
                                    ✓ Disponível para resgate
                                  </Badge>
                                ) : (
                                  <div className="space-y-1.5">
                                    <Progress value={progress} className="h-2" />
                                    <p className="text-[11px] text-muted-foreground">
                                      Faltam <span className="font-bold text-foreground">{diff}</span> pontos para resgatar
                                    </p>
                                    {reward.extra_cost > 0 && (
                                      <p className="text-[11px] text-muted-foreground">
                                        Ou complete com <span className="font-semibold text-foreground">R$ {Number(reward.extra_cost).toFixed(2).replace('.', ',')}</span>
                                      </p>
                                    )}
                                  </div>
                                )}
                                {hasStockControl && (
                                  <p className={`text-[11px] font-medium ${outOfStock ? 'text-destructive' : 'text-muted-foreground'}`}>
                                    {outOfStock ? '⛔ Esgotado' : `📦 Restam ${stockLeft} unidade${stockLeft === 1 ? '' : 's'}`}
                                  </p>
                                )}
                              </div>

                              {/* 4. AÇÃO */}
                              <div className="px-4 pb-4 pt-2 space-y-2">
                                <Button
                                  size="default"
                                  className="w-full h-12 text-sm font-semibold shadow-sm"
                                  disabled={!canRedeem}
                                  onClick={() => handleRedeem(reward)}
                                >
                                  {outOfStock ? 'Esgotado' : canRedeem ? '🎁 Resgatar agora' : 'Pontos insuficientes'}
                                </Button>
                                {!hasPoints && !outOfStock && (
                                  <p className="text-[11px] text-center text-muted-foreground leading-relaxed">
                                    Agende mais um serviço para desbloquear ✨
                                  </p>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      };

                      return (
                        <div className="space-y-5">
                          {featured.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                                <span>🔥</span> Recompensas em destaque
                              </h3>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {featured.map(renderCard)}
                              </div>
                            </div>
                          )}
                          {closest.length > 0 && (
                            <div className="space-y-2">
                              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                                <span>🎯</span> Mais perto de você resgatar
                              </h3>
                              <div className="grid sm:grid-cols-2 gap-3">
                                {closest.map(renderCard)}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </>
                )}

                {/* ============ MEUS RESGATES (histórico) ============ */}
                {redemptions.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      <span>🎟️</span> Meus resgates
                    </h3>
                    <div className="space-y-2">
                      {redemptions.slice(0, 10).map(r => {
                        const reward = rewards.find(rw => rw.id === r.reward_id);
                        const company = companies[r.company_id];
                        const ageMs = Date.now() - new Date(r.created_at).getTime();
                        const localExpired = r.status === 'pending' && ageMs >= 15 * 60_000;
                        const effectiveStatus = localExpired ? 'expired' : r.status;
                        const statusMeta: Record<string, { label: string; cls: string }> = {
                          pending:   { label: 'Pendente',   cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30' },
                          confirmed: { label: 'Confirmado', cls: 'bg-green-500/15 text-green-700 border-green-500/30' },
                          expired:   { label: 'Expirado',   cls: 'bg-amber-500/15 text-amber-700 border-amber-500/30' },
                          canceled:  { label: 'Cancelado',  cls: 'bg-destructive/10 text-destructive border-destructive/30' },
                          cancelled: { label: 'Cancelado',  cls: 'bg-destructive/10 text-destructive border-destructive/30' },
                        };
                        const meta = statusMeta[effectiveStatus] || statusMeta.pending;
                        const canOpen = effectiveStatus === 'pending';
                        return (
                          <Card key={r.id} className={!canOpen ? 'opacity-80' : ''}>
                            <CardContent className="p-3 flex items-center gap-3">
                              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <Gift className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium truncate">
                                  {reward?.name || 'Recompensa'}
                                </p>
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {company?.name || ''} · {format(parseISO(r.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                                </p>
                                <div className="mt-1 flex items-center gap-2">
                                  <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.label}</Badge>
                                  <span className="text-[10px] font-mono text-muted-foreground">{r.redemption_code}</span>
                                </div>
                              </div>
                              <Button
                                size="sm"
                                variant={canOpen ? 'default' : 'outline'}
                                onClick={() => openRedemption(r, reward?.name)}
                                className="shrink-0"
                              >
                                {canOpen ? 'Ver QR' : 'Detalhes'}
                              </Button>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ============ PROFILE ============ */}
          <TabsContent value="profile" className="space-y-4 mt-0">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados pessoais</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Compartilhados com todos os estabelecimentos onde você é cliente.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))} maxLength={100} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input value={profileForm.whatsapp}
                      onChange={e => setProfileForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="(11) 99999-9999" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={profileForm.email}
                      onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input type="date" value={profileForm.birth_date}
                    onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))} />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={profileForm.city}
                      onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input value={profileForm.state}
                      onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))} maxLength={2} />
                  </div>
                </div>
                <Button onClick={handleSaveProfile} disabled={savingProfile} className="w-full">
                  {savingProfile ? 'Salvando...' : 'Salvar alterações'}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Estabelecimentos vinculados
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.values(companies).map(co => (
                  <div key={co.id} className="flex items-center justify-between gap-2 py-1">
                    <CompanyHeader company={co} />
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <KeyRound className="h-4 w-4" /> Segurança
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Button variant="outline" onClick={() => setShowPasswordDialog(true)} className="w-full">
                  Alterar senha
                </Button>
              </CardContent>
            </Card>

            <Button variant="outline" onClick={signOut} className="w-full">
              <LogOut className="h-4 w-4 mr-2" /> Sair da conta
            </Button>
          </TabsContent>
        </Tabs>
      </div>

      {/* ============ BOTTOM NAV (4 tabs, mobile-first, always visible) ============ */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t shadow-[0_-2px_10px_rgba(0,0,0,0.04)]">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {bottomTabs.map(t => {
            const active = activeTab === t.value;
            return (
              <button
                key={t.value}
                onClick={() => setActiveTab(t.value)}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <div className={`p-1.5 rounded-xl transition-colors ${active ? 'bg-primary/10' : ''}`}>
                  <t.icon className="h-5 w-5" />
                </div>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Alterar senha</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input type="password" value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input type="password" value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))} />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword} className="w-full">
              {savingPassword ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Profile Dialog */}
      <Dialog open={showCompleteProfile} onOpenChange={setShowCompleteProfile}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Completar cadastro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input type="email" value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                placeholder="seu@email.com" />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento *</Label>
              <Input type="date" value={profileForm.birth_date}
                onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
            <Button className="w-full" onClick={handleSaveProfile}
              disabled={!profileForm.email || !profileForm.birth_date || savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Redemption QR Dialog */}
      <RedemptionQRDialog
        open={showRedemptionDialog}
        onOpenChange={(v) => {
          setShowRedemptionDialog(v);
          if (!v) {
            // Refresh on close to reflect any status change while open
            refreshRedemptions();
          }
        }}
        redemption={activeRedemption}
        rewardName={activeRedemptionRewardName}
        onRegenerate={handleRegenerateActive}
        regenerating={regenerating}
      />
    </div>
  );
};

export default ClientPortal;
