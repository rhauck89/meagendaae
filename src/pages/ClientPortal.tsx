import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Calendar, Clock, DollarSign, Star, Gift, User, LogOut, CheckCircle2,
  AlertCircle, Sparkles, MapPin, Info, LayoutDashboard, History, ShoppingBag, KeyRound, ArrowRight,
} from 'lucide-react';
import { format, parseISO, differenceInDays, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface ClientRecord {
  id: string;
  company_id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  registration_complete: boolean;
  postal_code: string | null;
  street: string | null;
  address_number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
}

interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: string;
  company_id: string;
  company: { name: string } | null;
  professional: { full_name: string } | null;
  appointment_services: { service: { name: string } | null; price: number }[];
}

interface CashbackRow {
  id: string;
  amount: number;
  status: string;
  expires_at: string;
  created_at: string;
  company_id: string;
  promotion: { title: string } | null;
}

interface LoyaltyTx {
  id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
  company_id: string;
}

interface RewardItem {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  item_type: string;
  points_required: number;
  real_value: number;
  company_id: string;
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

const ClientPortal = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<AppointmentRow[]>([]);
  const [allCashbacks, setAllCashbacks] = useState<CashbackRow[]>([]);
  const [allLoyaltyTxs, setAllLoyaltyTxs] = useState<LoyaltyTx[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loyaltyConfigs, setLoyaltyConfigs] = useState<Record<string, any>>({});
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
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

  useEffect(() => {
    if (!user) return;
    loadClientData();
  }, [user]);

  const currentClient = useMemo(() =>
    clients.find(c => c.company_id === selectedCompanyId) || clients[0],
    [clients, selectedCompanyId]
  );

  const isRegistrationIncomplete = useMemo(() => {
    if (!currentClient) return true;
    return !currentClient.email || !currentClient.birth_date;
  }, [currentClient]);

  const loadClientData = async () => {
    setLoading(true);
    const { data: profileData } = await supabase
      .from('profiles')
      .select('whatsapp')
      .eq('user_id', user!.id)
      .single();

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
      setClients([]);
      setLoading(false);
      return;
    }

    setClients(clientData as ClientRecord[]);
    const firstCompany = clientData[0].company_id;
    setSelectedCompanyId(firstCompany);

    const companyIds = [...new Set(clientData.map(c => c.company_id))];
    const [companyRes, cashbackRes, loyaltyTxRes, rewardsRes] = await Promise.all([
      supabase.from('companies').select('id, name').in('id', companyIds),
      supabase.from('client_cashback')
        .select('id, amount, status, expires_at, created_at, company_id, promotion:promotions!client_cashback_promotion_id_fkey(title)')
        .in('client_id', clientData.map(c => c.id))
        .order('created_at', { ascending: false }),
      supabase.from('loyalty_points_transactions')
        .select('*')
        .in('client_id', clientData.map(c => c.id))
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('loyalty_reward_items')
        .select('*')
        .in('company_id', companyIds)
        .eq('active', true),
    ]);

    if (companyRes.data) {
      const map: Record<string, string> = {};
      companyRes.data.forEach(c => { map[c.id] = c.name; });
      setCompanies(map);
    }

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
    const { data: aptData } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, total_price, status, company_id, company:companies(name), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(price, service:services(name))')
      .in('client_id', clientIds)
      .order('start_time', { ascending: false })
      .limit(100);
    setAppointments((aptData || []) as any);

    const client = clientData[0];
    setProfileForm({
      name: client.name || '',
      whatsapp: client.whatsapp || '',
      email: client.email || '',
      birth_date: client.birth_date || '',
      postal_code: (client as any).postal_code || '',
      street: (client as any).street || '',
      address_number: (client as any).address_number || '',
      district: (client as any).district || '',
      city: (client as any).city || '',
      state: (client as any).state || '',
    });
    setLoading(false);
  };

  const companyCashbacks = useMemo(() =>
    allCashbacks.filter(c => c.company_id === selectedCompanyId),
    [allCashbacks, selectedCompanyId]
  );
  const companyLoyaltyTxs = useMemo(() =>
    allLoyaltyTxs.filter(t => t.company_id === selectedCompanyId),
    [allLoyaltyTxs, selectedCompanyId]
  );
  const companyRewards = useMemo(() =>
    rewards.filter(r => r.company_id === selectedCompanyId),
    [rewards, selectedCompanyId]
  );
  const companyAppointments = useMemo(() =>
    selectedCompanyId ? appointments.filter(a => a.company_id === selectedCompanyId) : appointments,
    [appointments, selectedCompanyId]
  );

  const isCashbackActive = selectedCompanyId ? companyCashbackActive[selectedCompanyId] : false;
  const isLoyaltyActive = selectedCompanyId ? companyLoyaltyActive[selectedCompanyId] : false;
  const loyaltyConfig = selectedCompanyId ? loyaltyConfigs[selectedCompanyId] : null;

  const activeCashback = companyCashbacks.filter(c => c.status === 'active' && !isPast(parseISO(c.expires_at)));
  const cashbackTotal = activeCashback.reduce((s, c) => s + Number(c.amount), 0);

  const loyaltyBalance = companyLoyaltyTxs.length > 0 ? companyLoyaltyTxs[0].balance_after : 0;
  const pointValue = loyaltyConfig?.point_value || 0.05;
  const balanceEquivalent = loyaltyBalance * pointValue;

  const upcomingAppointments = companyAppointments.filter(a => !isPast(parseISO(a.start_time)) && !['cancelled', 'no_show'].includes(a.status));
  const pastAppointments = companyAppointments.filter(a => isPast(parseISO(a.start_time)) || ['cancelled', 'no_show'].includes(a.status));
  const completedCount = pastAppointments.filter(a => a.status === 'completed').length;
  const nextAppointment = upcomingAppointments[upcomingAppointments.length - 1] || upcomingAppointments[0];
  const lastCompleted = pastAppointments.find(a => a.status === 'completed');

  // Closest reward (smallest positive distance)
  const nextReward = useMemo(() => {
    const remaining = companyRewards
      .map(r => ({ ...r, diff: r.points_required - loyaltyBalance }))
      .filter(r => r.diff > 0)
      .sort((a, b) => a.diff - b.diff);
    return remaining[0] || null;
  }, [companyRewards, loyaltyBalance]);

  const handleSaveProfile = async () => {
    if (!currentClient) return;
    setSavingProfile(true);
    const updates: any = {
      name: profileForm.name,
      whatsapp: profileForm.whatsapp,
      email: profileForm.email,
      birth_date: profileForm.birth_date || null,
      postal_code: profileForm.postal_code || null,
      street: profileForm.street || null,
      address_number: profileForm.address_number || null,
      district: profileForm.district || null,
      city: profileForm.city || null,
      state: profileForm.state || null,
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
    if (passwordForm.newPassword.length < 6) {
      toast.error('Senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirm) {
      toast.error('As senhas não coincidem');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwordForm.newPassword });
    setSavingPassword(false);
    if (error) {
      toast.error('Erro ao alterar senha');
      return;
    }
    toast.success('Senha alterada com sucesso!');
    setPasswordForm({ newPassword: '', confirm: '' });
    setShowPasswordDialog(false);
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
          <Button onClick={() => navigate('/cliente/auth?tab=signup')} className="w-full">
            Criar conta
          </Button>
          <Button variant="outline" onClick={() => navigate('/cliente/auth?tab=login')} className="w-full">
            Fazer login
          </Button>
        </div>
        <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/')}>
          Voltar ao início
        </Button>
      </div>
    </div>
  );

  // Loading skeleton
  if (loading) return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="h-16 bg-muted/50 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-24 bg-muted/40 rounded-lg animate-pulse" />)}
        </div>
        <div className="h-40 bg-muted/40 rounded-lg animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-lg animate-pulse" />
      </div>
    </div>
  );

  if (clients.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm text-center space-y-4">
        <User className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Você ainda não possui agendamentos</h2>
        <p className="text-muted-foreground text-sm">
          Que tal agendar seu primeiro horário?
        </p>
        <Button onClick={() => navigate('/')} className="w-full">Agendar agora</Button>
        <Button variant="ghost" onClick={signOut} className="w-full text-sm">
          <LogOut className="h-4 w-4 mr-2" /> Sair
        </Button>
      </div>
    </div>
  );

  const tabs = [
    { value: 'dashboard', icon: LayoutDashboard, label: 'Início' },
    { value: 'appointments', icon: Calendar, label: 'Agenda' },
    ...(isCashbackActive ? [{ value: 'cashback', icon: DollarSign, label: 'Cashback' }] : []),
    ...(isLoyaltyActive ? [{ value: 'loyalty', icon: Star, label: 'Pontos' }] : []),
    ...(isLoyaltyActive ? [{ value: 'rewards', icon: ShoppingBag, label: 'Loja' }] : []),
    { value: 'profile', icon: User, label: 'Perfil' },
  ];

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-6">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl">Minha Conta</h1>
            <p className="text-sm text-muted-foreground truncate max-w-[200px]">{currentClient?.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sair">
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">
        {/* Company selector */}
        {Object.keys(companies).length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Object.entries(companies).map(([id, name]) => (
              <Button
                key={id}
                variant={selectedCompanyId === id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCompanyId(id)}
                className="whitespace-nowrap shrink-0"
              >
                {name}
              </Button>
            ))}
          </div>
        )}

        {/* Incomplete profile banner */}
        {isRegistrationIncomplete && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-sm">👋 Complete seu cadastro para liberar benefícios</p>
                  <Button size="sm" onClick={() => { setActiveTab('profile'); setShowCompleteProfile(true); }}>
                    Completar agora
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Desktop top tabs */}
          <TabsList className="hidden md:grid w-full" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
            {tabs.map(t => (
              <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
                <t.icon className="h-4 w-4" />
                <span className="text-xs">{t.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Dashboard */}
          <TabsContent value="dashboard" className="space-y-4 mt-4">
            {/* Quick stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-3 text-center">
                  <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{upcomingAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Próximos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-bold">{completedCount}</p>
                  <p className="text-xs text-muted-foreground">Realizados</p>
                </CardContent>
              </Card>
              {isCashbackActive ? (
                <Card>
                  <CardContent className="p-3 text-center">
                    <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
                    <p className="text-lg font-bold">R$ {cashbackTotal.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">Cashback</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-3 text-center">
                    <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                    <p className="text-lg font-bold">{companyAppointments.length}</p>
                    <p className="text-xs text-muted-foreground">Total</p>
                  </CardContent>
                </Card>
              )}
              {isLoyaltyActive ? (
                <Card>
                  <CardContent className="p-3 text-center">
                    <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                    <p className="text-lg font-bold">{loyaltyBalance}</p>
                    <p className="text-xs text-muted-foreground">Pontos</p>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-3 text-center">
                    <Gift className="h-5 w-5 mx-auto mb-1 text-primary" />
                    <p className="text-lg font-bold">{Object.keys(companies).length}</p>
                    <p className="text-xs text-muted-foreground">Estab.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Next appointment highlight */}
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" /> Próximo agendamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                {nextAppointment ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold">
                      {format(parseISO(nextAppointment.start_time), "dd 'de' MMMM", { locale: ptBR })}
                    </p>
                    <p className="text-lg text-primary font-semibold">
                      {format(parseISO(nextAppointment.start_time), 'HH:mm', { locale: ptBR })}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {nextAppointment.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                    </p>
                    {nextAppointment.professional && (
                      <p className="text-xs text-muted-foreground">com {nextAppointment.professional.full_name}</p>
                    )}
                    <div className="flex gap-2 pt-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/reschedule/${nextAppointment.id}`)}>
                        Remarcar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setActiveTab('appointments')}>
                        Ver todos <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 space-y-2">
                    <p className="text-sm text-muted-foreground">Você não tem agendamentos futuros</p>
                    <Button size="sm" onClick={() => navigate('/')}>Agendar agora</Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Loyalty progress */}
            {isLoyaltyActive && nextReward && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Gift className="h-4 w-4 text-yellow-500" /> Próxima recompensa
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{nextReward.name}</span>
                    <span className="text-muted-foreground">{loyaltyBalance} / {nextReward.points_required}</span>
                  </div>
                  <Progress value={(loyaltyBalance / nextReward.points_required) * 100} />
                  <p className="text-xs text-muted-foreground">
                    Faltam <strong>{nextReward.diff}</strong> pontos
                  </p>
                  <Button size="sm" variant="outline" className="w-full" onClick={() => setActiveTab('rewards')}>
                    Ver loja de recompensas
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Last completed */}
            {lastCompleted && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <History className="h-4 w-4 text-muted-foreground" /> Último atendimento
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm font-medium">
                    {format(parseISO(lastCompleted.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {lastCompleted.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                  </p>
                  <p className="text-xs mt-1">R$ {Number(lastCompleted.total_price).toFixed(2)}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Appointments */}
          <TabsContent value="appointments" className="space-y-4 mt-4">
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Próximos agendamentos</h3>
              {upcomingAppointments.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center space-y-2">
                    <Calendar className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhum agendamento futuro</p>
                    <Button size="sm" onClick={() => navigate('/')}>Agendar</Button>
                  </CardContent>
                </Card>
              ) : upcomingAppointments.map(apt => (
                <Card key={apt.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1 flex-1 min-w-0">
                        <p className="font-medium text-sm">
                          {format(parseISO(apt.start_time), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                        </p>
                        {apt.professional && (
                          <p className="text-xs text-muted-foreground">Com: {apt.professional.full_name}</p>
                        )}
                        {apt.company && Object.keys(companies).length > 1 && (
                          <p className="text-xs text-muted-foreground">📍 {apt.company.name}</p>
                        )}
                      </div>
                      <Badge className={statusColors[apt.status] || 'bg-muted'}>
                        {statusLabels[apt.status] || apt.status}
                      </Badge>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="outline" className="text-xs" onClick={() => navigate(`/reschedule/${apt.id}`)}>
                        Remarcar
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => navigate(`/cancel/${apt.id}`)}>
                        Cancelar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
              {pastAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum agendamento anterior</p>
              ) : (
                pastAppointments.slice(0, 30).map(apt => (
                  <Card key={apt.id} className="opacity-90">
                    <CardContent className="p-3 flex justify-between items-center gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {format(parseISO(apt.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {apt.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge className={`${statusColors[apt.status] || 'bg-muted'} text-xs`}>
                          {statusLabels[apt.status] || apt.status}
                        </Badge>
                        <p className="text-xs mt-1">R$ {Number(apt.total_price).toFixed(2)}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          {/* Cashback */}
          {isCashbackActive && (
            <TabsContent value="cashback" className="space-y-4 mt-4">
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Cashback disponível</p>
                  <p className="text-4xl font-bold text-green-600 mt-1">R$ {cashbackTotal.toFixed(2)}</p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
                {companyCashbacks.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      Nenhum cashback registrado ainda
                    </CardContent>
                  </Card>
                ) : (
                  companyCashbacks.map(cb => {
                    const daysLeft = differenceInDays(parseISO(cb.expires_at), new Date());
                    return (
                      <Card key={cb.id}>
                        <CardContent className="p-3 flex justify-between items-center gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">R$ {Number(cb.amount).toFixed(2)}</p>
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
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </TabsContent>
          )}

          {/* Loyalty */}
          {isLoyaltyActive && (
            <TabsContent value="loyalty" className="space-y-4 mt-4">
              <Card className="bg-yellow-500/5 border-yellow-500/20">
                <CardContent className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">Seus pontos</p>
                  <p className="text-4xl font-bold text-yellow-600 mt-1">{loyaltyBalance}</p>
                  {pointValue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Equivalente a R$ {balanceEquivalent.toFixed(2)}
                    </p>
                  )}
                </CardContent>
              </Card>

              {nextReward && (
                <Card>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="font-medium">Próxima: {nextReward.name}</span>
                      <span className="text-muted-foreground">{loyaltyBalance}/{nextReward.points_required}</span>
                    </div>
                    <Progress value={(loyaltyBalance / nextReward.points_required) * 100} />
                  </CardContent>
                </Card>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Movimentações</h3>
                {companyLoyaltyTxs.length === 0 ? (
                  <Card>
                    <CardContent className="p-6 text-center text-sm text-muted-foreground">
                      Nenhuma movimentação ainda
                    </CardContent>
                  </Card>
                ) : (
                  companyLoyaltyTxs.map(tx => (
                    <Card key={tx.id}>
                      <CardContent className="p-3 flex justify-between items-center gap-2">
                        <div className="min-w-0">
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
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          )}

          {/* Rewards Store */}
          {isLoyaltyActive && (
            <TabsContent value="rewards" className="space-y-4 mt-4">
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-3 flex items-center justify-between">
                  <p className="text-sm">Seu saldo</p>
                  <p className="text-lg font-bold text-primary">{loyaltyBalance} pontos</p>
                </CardContent>
              </Card>

              {companyRewards.length === 0 ? (
                <Card>
                  <CardContent className="p-6 text-center space-y-2">
                    <Gift className="h-8 w-8 mx-auto text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">Nenhuma recompensa cadastrada</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {companyRewards.map(reward => {
                    const canRedeem = loyaltyBalance >= reward.points_required;
                    const partial = loyaltyBalance > 0 && loyaltyBalance < reward.points_required;
                    const cashNeeded = partial ? (reward.points_required - loyaltyBalance) * pointValue : 0;
                    const diff = reward.points_required - loyaltyBalance;

                    return (
                      <Card key={reward.id} className={canRedeem ? 'border-green-500/30 bg-green-500/5' : ''}>
                        <CardContent className="p-4">
                          <div className="flex gap-3">
                            {reward.image_url ? (
                              <img src={reward.image_url} alt={reward.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                                <Gift className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm">{reward.name}</p>
                              {reward.description && (
                                <p className="text-xs text-muted-foreground line-clamp-2">{reward.description}</p>
                              )}
                              <p className="text-sm font-bold mt-1">{reward.points_required} pts</p>
                              {canRedeem ? (
                                <Badge className="bg-green-500/10 text-green-600 mt-1 text-xs">Disponível</Badge>
                              ) : partial ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  + R$ {cashNeeded.toFixed(2)}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Faltam {diff} pts
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          )}

          {/* Profile */}
          <TabsContent value="profile" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados pessoais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={profileForm.name}
                    onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                    maxLength={100}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>WhatsApp</Label>
                    <Input
                      value={profileForm.whatsapp}
                      onChange={e => setProfileForm(f => ({ ...f, whatsapp: e.target.value }))}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={profileForm.email}
                      onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Data de nascimento</Label>
                  <Input
                    type="date"
                    value={profileForm.birth_date}
                    onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
                  />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={profileForm.city}
                      onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado (UF)</Label>
                    <Input
                      value={profileForm.state}
                      onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))}
                      maxLength={2}
                    />
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

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t">
        <div className="grid" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(t => (
            <button
              key={t.value}
              onClick={() => setActiveTab(t.value)}
              className={`flex flex-col items-center gap-0.5 py-2 text-[10px] transition-colors ${
                activeTab === t.value ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <t.icon className="h-5 w-5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={e => setPasswordForm(f => ({ ...f, newPassword: e.target.value }))}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label>Confirmar nova senha</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={e => setPasswordForm(f => ({ ...f, confirm: e.target.value }))}
              />
            </div>
            <Button onClick={handleChangePassword} disabled={savingPassword} className="w-full">
              {savingPassword ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Complete Profile Dialog (used by banner) */}
      <Dialog open={showCompleteProfile} onOpenChange={setShowCompleteProfile}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Completar cadastro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento *</Label>
              <Input
                type="date"
                value={profileForm.birth_date}
                onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={handleSaveProfile} disabled={!profileForm.email || !profileForm.birth_date || savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
