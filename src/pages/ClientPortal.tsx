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
import { UnifiedAppointmentCard } from '@/components/appointments/UnifiedAppointmentCard';
import { RedemptionQRDialog, type Redemption } from '@/components/RedemptionQRDialog';
import { SmartRewardCard } from '@/components/loyalty/SmartRewardCard';
import { suggestSmartReward } from '@/lib/smart-rewards';
import {
  Calendar, DollarSign, Star, Gift, User, LogOut, CheckCircle2,
  Sparkles, Home, ShoppingBag, KeyRound, ArrowRight,
  Building2, ChevronRight, Bell, Repeat, Wallet, Plus, Pause, History as HistoryIcon,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  status: string; company_id: string; promotion_id: string | null;
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
  reference_id?: string | null; reference_type?: string | null;
}
interface CashbackTx {
  id: string;
  amount: number;
  type: 'credit' | 'debit' | 'expiration' | 'expire';
  description: string | null;
  created_at: string;
  company_id: string;
  reference_id: string | null;
}
interface RewardItem {
  id: string; name: string; description: string | null; image_url: string | null;
  item_type: string; points_required: number; real_value: number; extra_cost: number; company_id: string;
  stock_total: number | null; stock_available: number | null;
}

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
  const { user, signOut: authSignOut, isAdmin, profile } = useAuth();
  const navigate = useNavigate();

  // Custom signOut to handle admin vs client sessions
  const signOut = async () => {
    if (isAdmin) {
      // If admin is logged in, just clear the local identity session
      // This allows them to stay logged in to the dashboard
      const companyIds = clients.map(c => c.company_id);
      companyIds.forEach(id => {
        localStorage.removeItem(`whatsapp_session_${id}`);
      });
      toast.success('Sessão de cliente encerrada');
      window.location.reload();
    } else {
      // Standard user logout
      await authSignOut();
    }
  };

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [pointsData, setPointsData] = useState<any>(null);
  const [cashbackData, setCashbackData] = useState<any>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
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
  const [redeemingId, setRedeemingId] = useState<string | null>(null);

  // ---------- Cache (instant render + background revalidation) ----------
  const cacheKey = `client_portal_v2_${user?.id || 'anon'}`;
  const { read: readCache, write: writeCache } = useLocalCache<{
    clients: ClientRecord[];
    summary: any;
    pointsData: any;
    cashbackData: any;
    appointments: AppointmentRow[];
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
      setSummary(cached.summary);
      setPointsData(cached.pointsData);
      setCashbackData(cached.cashbackData);
      setAppointments(cached.appointments || []);
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
      console.log('[CLIENT_PORTAL_DEBUG] Starting data load');
      console.log('[CLIENT_PORTAL_DEBUG] auth.uid():', user?.id);
      console.log('[CLIENT_PORTAL_DEBUG] user.email:', user?.email);
      
      const [
        summaryRes,
        apptsRes,
        pointsRes,
        cashbackRes,
        rewardsRes,
        clientsRes,
        redemptionsRes
      ] = await Promise.all([
        supabase.rpc('get_client_portal_summary'),
        supabase.rpc('get_client_portal_appointments'),
        supabase.rpc('get_client_portal_points'),
        supabase.rpc('get_client_portal_cashback'),
        supabase.from('loyalty_reward_items').select('id, name, description, points_required, real_value, extra_cost, image_url, item_type, company_id, stock_total, stock_available, company:companies!loyalty_reward_items_company_id_fkey(id, name, logo_url, slug)').eq('active', true),
        supabase.from('clients').select('*').eq('user_id', user?.id),
        supabase.from('loyalty_redemptions').select('id, redemption_code, status, created_at, total_points, reward_id, company_id, client_id').eq('user_id', user?.id).order('created_at', { ascending: false }).limit(50)
      ]);

      console.log('[CLIENT_PORTAL_DEBUG] summaryRes:', summaryRes.data);
      console.log('[CLIENT_PORTAL_DEBUG] apptsRes:', apptsRes.data);
      console.log('[CLIENT_PORTAL_DEBUG] pointsRes:', pointsRes.data);
      console.log('[CLIENT_PORTAL_DEBUG] cashbackRes:', cashbackRes.data);
      console.log('[CLIENT_PORTAL_DEBUG] clientsRes:', clientsRes.data);

      const summaryData = summaryRes.data as any;
      const appointmentsData = (apptsRes.data || []) as any[];
      const pointsDataObj = pointsRes.data as any;
      const cashbackDataObj = cashbackRes.data as any;
      const rewardsData = (rewardsRes.data || []) as any[];
      const clientsData = (clientsRes.data || []) as ClientRecord[];
      const redemptionsData = (redemptionsRes.data || []) as Redemption[];


      setSummary(summaryData);
      setAppointments(appointmentsData);
      setPointsData(pointsDataObj);
      setCashbackData(cashbackDataObj);
      setRewards(rewardsData);
      setClients(clientsData);
      setRedemptions(redemptionsData);

      // Map companies
      const companiesMap: Record<string, CompanyInfo> = {};
      
      // Collect all company IDs from all data sources to ensure we load their names/logos
      const companyIds = [...new Set([
        ...appointmentsData.map(a => a.company_id),
        ...rewardsData.map(r => r.company_id),
        ...Object.keys(pointsDataObj?.balances || {}),
        ...Object.keys(cashbackDataObj?.balances || {}),
        ...(pointsDataObj?.history || []).map((h: any) => h.company_id),
        ...(cashbackDataObj?.history || []).map((h: any) => h.company_id)
      ])].filter(Boolean) as string[];
      
      console.log('[CLIENT_PORTAL_DEBUG] All involved company IDs:', companyIds);
      
      if (companyIds.length > 0) {
        const { data: companyData } = await supabase.from('companies').select('id, name, logo_url, slug').in('id', companyIds);
        if (companyData) {
          companyData.forEach((c: any) => { 
            companiesMap[c.id] = { id: c.id, name: c.name, logo_url: c.logo_url, slug: c.slug }; 
          });
        }
      }
      setCompanies(companiesMap);

      // Load specific loyalty configs
      const cashActive: Record<string, boolean> = {};
      const loyalActive: Record<string, boolean> = {};
      const lcMap: Record<string, any> = {};
      
      await Promise.all(companyIds.map(async (cid) => {
        const [promoCheck, lcRes] = await Promise.all([
          supabase.from('promotions').select('id').eq('company_id', cid).eq('promotion_type', 'cashback').eq('status', 'active').limit(1),
          supabase.from('loyalty_config').select('*').eq('company_id', cid).single(),
        ]);
        cashActive[cid] = !!(promoCheck.data && promoCheck.data.length > 0);
        loyalActive[cid] = !!lcRes.data?.enabled;
        if (lcRes.data) lcMap[cid] = lcRes.data;
      }));

      setCompanyCashbackActive(cashActive);
      setCompanyLoyaltyActive(loyalActive);
      setLoyaltyConfigs(lcMap);

      // Profile form initialization
      if (clientsData.length > 0) {
        const c = clientsData[0];
        setProfileForm({
          name: c.name || '', whatsapp: c.whatsapp || '', email: c.email || '',
          birth_date: c.birth_date || '',
          postal_code: c.postal_code || '', street: c.street || '',
          address_number: c.address_number || '', district: c.district || '',
          city: c.city || '', state: c.state || '',
        });
      }

      // Persist to cache
      writeCache({
        clients: clientsData,
        summary: summaryData,
        pointsData: pointsDataObj,
        cashbackData: cashbackDataObj,
        appointments: appointmentsData,
        rewards: rewardsData,
        companies: companiesMap,
        loyaltyConfigs: lcMap,
        companyCashbackActive: cashActive,
        companyLoyaltyActive: loyalActive,
      });
    } catch (err) {
      console.error('[ClientPortal] critical data load error:', err);
    } finally {
      if (!isRevalidation) setLoading(false);
    }
  };

  // ---------- Aggregations ----------
  const cashbackByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    if (cashbackData?.balances) {
      Object.entries(cashbackData.balances).forEach(([cid, bal]: [string, any]) => {
        map[cid] = Number(bal.available) || 0;
      });
    }
    return map;
  }, [cashbackData]);

  const cashbackTotals = useMemo(() => {
    return {
      gained: summary?.cashback_active || 0,
      used: 0, // We'll focus on what's available
      expired: 0
    };
  }, [summary]);

  const totalCashback = summary?.cashback_active || 0;

  const pointsByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    if (pointsData?.balances) {
      Object.entries(pointsData.balances).forEach(([cid, bal]: [string, any]) => {
        map[cid] = Number(bal) || 0;
      });
    }
    return map;
  }, [pointsData]);

  const totalPoints = summary?.total_points || 0;

  const mergedLoyaltyMovements = useMemo(() => {
    return (pointsData?.history || []).map((h: any) => ({
      ...h,
      isTransaction: h.type === 'transaction'
    }));
  }, [pointsData]);

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
    () => Object.values(companies).filter(c => 
      companyCashbackActive[c.id] || (cashbackByCompany[c.id] || 0) > 0
    ),
    [companies, companyCashbackActive, cashbackByCompany]);
    
  const companiesWithLoyalty = useMemo(
    () => Object.values(companies).filter(c => 
      companyLoyaltyActive[c.id] || (pointsByCompany[c.id] || 0) > 0
    ),
    [companies, companyLoyaltyActive, pointsByCompany]);

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
    
    // Refresh client data to update points balance immediately
    await loadClientData(true);
    
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

  if (clients.length === 0 && appointments.length === 0) return (
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
              Olá, {(primaryClient?.name || user?.user_metadata?.full_name || 'cliente')?.split(' ')[0]} 👋
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
                  <p className="text-xs text-muted-foreground">Minha Carteira</p>
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
                      {list.map(apt => (
                        <UnifiedAppointmentCard
                          key={apt.id}
                          appointment={apt}
                          variant="client"
                          isAdmin={false}
                          showCompany={true}
                          onReschedule={(apt) => navigate(`/reschedule/${apt.id}`)}
                          onCancel={(apt) => navigate(`/cancel/${apt.id}`)}
                        />
                      ))}
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
                    <UnifiedAppointmentCard
                      key={apt.id}
                      appointment={apt}
                      variant="client"
                      isAdmin={false}
                      showCompany={true}
                      onClick={(apt) => {
                        if (apt.status === 'completed') goRebook(apt.company_id);
                      }}
                    />
                  ))
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* ============ BENEFITS (sub-tabs) ============ */}
          <TabsContent value="benefits" className="space-y-4 mt-0">
            <Tabs value={benefitsTab} onValueChange={setBenefitsTab}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="cashback">Minha Carteira</TabsTrigger>
                <TabsTrigger value="points">Pontos</TabsTrigger>
                <TabsTrigger value="store">Loja</TabsTrigger>
              </TabsList>

              {/* CASHBACK */}
              <TabsContent value="cashback" className="space-y-4 mt-4">
                {!anyCashback && (cashbackData?.history || []).length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center space-y-3">
                      <Wallet className="h-12 w-12 mx-auto text-muted-foreground/40" />
                      <p className="font-semibold">Sua carteira está vazia</p>
                      <p className="text-sm text-muted-foreground">
                        Agende novos horários para acumular cashback e transformar seus agendamentos em economia! 💈
                      </p>
                      <Button size="sm" onClick={() => navigate('/')}>Agendar Agora</Button>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3">
                      {/* Resumo visual no topo estilo Wallet */}
                      <Card className="bg-gradient-to-br from-primary/10 via-background to-background border-primary/20 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                          <Wallet className="h-16 w-16 rotate-12" />
                        </div>
                        <CardContent className="p-5">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[10px] font-bold uppercase tracking-wider text-primary/70">Saldo Disponível</p>
                              <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-primary">R$</span>
                                <span className="text-5xl font-black text-primary tracking-tighter">
                                  {totalCashback.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1 font-medium">
                                {totalCashback > 20 
                                  ? "Você já pode usar seu saldo em benefícios 🎁" 
                                  : totalCashback > 0 
                                    ? "Seu cashback acumulado está crescendo 🚀"
                                    : "Agende novos horários para acumular cashback 💈"}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-primary/10">
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Ganho</p>
                                <p className="text-lg font-bold text-green-600">
                                  + R$ {cashbackTotals.gained.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Usado</p>
                                <p className="text-lg font-bold text-red-500">
                                  - R$ {cashbackTotals.used.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Botões de ação (Base pronta) */}
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1 text-[11px] h-9 gap-1.5" onClick={() => navigate('/')}>
                          <Calendar className="h-3.5 w-3.5" /> Usar no próximo
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 text-[11px] h-9 gap-1.5" onClick={() => navigate('/help-center')}>
                          <Star className="h-3.5 w-3.5" /> Ver regras
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <HistoryIcon className="h-3 w-3" /> Extrato Detalhado
                      </h3>
                      
                      {/* Saldo por estabelecimento */}
                      <div className="space-y-2">
                        {companiesWithCashback.map(co => (
                          <div key={co.id} className="flex items-center justify-between p-3 rounded-xl bg-card border shadow-sm">
                            <CompanyHeader company={co} size="sm" />
                            <div className="text-right">
                              <p className="text-sm font-bold text-primary">
                                R$ {(cashbackByCompany[co.id] || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Lista cronológica do extrato */}
                      <div className="space-y-2">
                        {(cashbackData?.history || []).length === 0 ? (
                          <Card><CardContent className="p-6 text-center text-sm text-muted-foreground italic">
                            Nenhuma movimentação registrada ainda
                          </CardContent></Card>
                        ) : (
                          (cashbackData?.history || []).map((tx: any) => {
                            const isCredit = tx.type === 'credit';
                            const isDebit = tx.type === 'debit';
                            const isExpiration = tx.type === 'expiration' || (tx as any).type === 'expire';
                            
                            return (
                              <div key={tx.id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:bg-accent/5 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center shrink-0",
                                    isCredit ? "bg-green-500/10 text-green-600" : 
                                    isDebit ? "bg-red-500/10 text-red-500" : 
                                    "bg-orange-500/10 text-orange-500"
                                  )}>
                                    {isCredit ? <Plus className="h-5 w-5" /> : 
                                     isDebit ? <ArrowRight className="h-5 w-5" /> : 
                                     <Pause className="h-5 w-5" />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-bold truncate">
                                      {tx.description || (isCredit ? 'Cashback ganho' : isDebit ? 'Cashback utilizado' : 'Cashback expirado')}
                                    </p>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">
                                        {format(parseISO(tx.created_at), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                                      </span>
                                      <span className="text-[10px] text-muted-foreground opacity-50">•</span>
                                      <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">
                                        {companies[tx.company_id]?.name}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className={cn(
                                    "text-sm font-black tracking-tight",
                                    isCredit ? "text-green-600" : isDebit ? "text-red-500" : "text-orange-500"
                                  )}>
                                    {isCredit ? '+' : '-'} R$ {Number(tx.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </p>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
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
                      // Smart suggestion based on this company's appointment history
                      const companyApts = appointments.filter(a => a.company_id === co.id);
                      const aptHistory = companyApts.flatMap(a =>
                        (a.appointment_services || []).map(s => ({
                          service_name: s.service?.name ?? null,
                          total_price: Number(s.price) || 0,
                          created_at: a.start_time,
                        }))
                      );
                      const smart = suggestSmartReward({
                        currentBalance: balance,
                        appointmentHistory: aptHistory,
                        rewards: companyRewards,
                      });
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
                            {smart ? (
                              <SmartRewardCard suggestion={smart} pointValue={pointVal} compact />
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
                      {mergedLoyaltyMovements.length === 0 ? (
                        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
                          Nenhuma movimentação ainda
                        </CardContent></Card>
                      ) : (
                        mergedLoyaltyMovements.slice(0, 30).map(tx => (
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
                                  {typeof tx.balance_after === 'number' && (
                                    <p className="text-xs">Saldo: {tx.balance_after}</p>
                                  )}
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
                        if (redeemingId) return; // proteção contra duplo clique
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
                        setRedeemingId(reward.id);
                        try {
                          const created = await createRedemption(reward);
                          if (created) {
                            openRedemption(created, reward.name);
                            toast.success('Resgate criado! Apresente o QR Code.');
                          }
                        } finally {
                          setRedeemingId(null);
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
                                  className="w-full h-12 text-sm font-semibold shadow-sm transition-transform active:scale-[0.98]"
                                  disabled={!canRedeem || redeemingId === reward.id}
                                  onClick={() => handleRedeem(reward)}
                                >
                                  {redeemingId === reward.id
                                    ? (<><span className="mr-2 inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin" />Gerando QR...</>)
                                    : outOfStock ? 'Esgotado' : canRedeem ? '🎁 Resgatar agora' : 'Pontos insuficientes'}
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
                      {[...redemptions]
                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                        .slice(0, 10).map(r => {
                        const reward = rewards.find(rw => rw.id === r.reward_id);
                        const company = companies[r.company_id];
                        const ageMs = Date.now() - new Date(r.created_at).getTime();
                        const localExpired = r.status === 'pending' && ageMs >= 15 * 60_000;
                        const effectiveStatus = localExpired ? 'expired' : r.status;
                        const statusMeta: Record<string, { label: string; cls: string; icon: string }> = {
                          pending:   { label: 'Pendente',   cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30', icon: '⏳' },
                          confirmed: { label: 'Confirmado', cls: 'bg-green-500/15 text-green-700 border-green-500/30', icon: '✅' },
                          expired:   { label: 'Expirado',   cls: 'bg-muted text-muted-foreground border-border', icon: '⚠️' },
                          canceled:  { label: 'Cancelado',  cls: 'bg-destructive/10 text-destructive border-destructive/30', icon: '❌' },
                          cancelled: { label: 'Cancelado',  cls: 'bg-destructive/10 text-destructive border-destructive/30', icon: '❌' },
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
                                  <Badge variant="outline" className={`text-[10px] ${meta.cls}`}>{meta.icon} {meta.label}</Badge>
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
