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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar, Clock, DollarSign, Star, Gift, Bell, User, LogOut, ChevronRight, CheckCircle2, AlertCircle, Sparkles, X, MapPin, Info } from 'lucide-react';
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
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    email: '', birth_date: '',
    postal_code: '', street: '', address_number: '', district: '', city: '', state: '',
  });

  const [companyCashbackActive, setCompanyCashbackActive] = useState<Record<string, boolean>>({});
  const [companyLoyaltyActive, setCompanyLoyaltyActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) { navigate('/cliente/auth?tab=signup'); return; }
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

    if (profileData?.whatsapp) {
      await supabase.rpc('link_client_to_user', {
        p_user_id: user!.id,
        p_phone: profileData.whatsapp,
      });
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

    // Check cashback and loyalty status per company
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

    // Load appointments for all clients
    const clientIds = clientData.map(c => c.id);
    const { data: aptData } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, total_price, status, company_id, company:companies(name), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(price, service:services(name))')
      .in('client_id', clientIds)
      .order('start_time', { ascending: false })
      .limit(100);
    setAppointments((aptData || []) as any);

    // Pre-fill profile form
    const client = clientData[0];
    if (!client.email || !client.birth_date) {
      setProfileForm(f => ({
        ...f,
        email: client.email || '',
        birth_date: client.birth_date || '',
        postal_code: (client as any).postal_code || '',
        street: (client as any).street || '',
        address_number: (client as any).address_number || '',
        district: (client as any).district || '',
        city: (client as any).city || '',
        state: (client as any).state || '',
      }));
    }
    setLoading(false);
  };

  // Filtered data for selected company
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

  // Multi-company cashback summary
  const cashbackByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    allCashbacks.filter(c => c.status === 'active' && !isPast(parseISO(c.expires_at))).forEach(c => {
      map[c.company_id] = (map[c.company_id] || 0) + Number(c.amount);
    });
    return map;
  }, [allCashbacks]);

  // Multi-company loyalty summary
  const pointsByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    const seen = new Set<string>();
    allLoyaltyTxs.forEach(t => {
      if (!seen.has(t.company_id)) {
        seen.add(t.company_id);
        map[t.company_id] = t.balance_after;
      }
    });
    return map;
  }, [allLoyaltyTxs]);

  // Notifications
  const notifications = useMemo(() => {
    const items: { icon: React.ReactNode; text: string; type: string }[] = [];
    if (cashbackTotal > 0) {
      const expiringSoon = activeCashback.filter(c => differenceInDays(parseISO(c.expires_at), new Date()) <= 10);
      if (expiringSoon.length > 0) {
        items.push({ icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, text: `Cashback de R$ ${expiringSoon.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)} expira em breve!`, type: 'warning' });
      }
    }
    companyRewards.forEach(r => {
      const diff = r.points_required - loyaltyBalance;
      if (diff <= 0) {
        items.push({ icon: <Gift className="h-4 w-4 text-green-500" />, text: `🎁 Você já pode resgatar: ${r.name}`, type: 'success' });
      } else if (diff <= r.points_required * 0.2) {
        items.push({ icon: <Star className="h-4 w-4 text-primary" />, text: `⭐ Faltam apenas ${diff} pontos para resgatar ${r.name}`, type: 'info' });
      }
    });
    return items;
  }, [cashbackTotal, activeCashback, companyRewards, loyaltyBalance]);

  const handleCompleteProfile = async () => {
    if (!currentClient) return;
    const updates: any = {};
    if (profileForm.email) updates.email = profileForm.email;
    if (profileForm.birth_date) updates.birth_date = profileForm.birth_date;
    if (profileForm.postal_code) updates.postal_code = profileForm.postal_code;
    if (profileForm.street) updates.street = profileForm.street;
    if (profileForm.address_number) updates.address_number = profileForm.address_number;
    if (profileForm.district) updates.district = profileForm.district;
    if (profileForm.city) updates.city = profileForm.city;
    if (profileForm.state) updates.state = profileForm.state;
    updates.registration_complete = !!(profileForm.email && profileForm.birth_date);

    // Update all client records for this user
    for (const client of clients) {
      await supabase
        .from('clients')
        .update(updates)
        .eq('id', client.id);
    }

    toast.success('Cadastro atualizado com sucesso!');
    setShowCompleteProfile(false);
    loadClientData();
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <p className="text-muted-foreground">Carregando...</p>
    </div>
  );

  if (clients.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <User className="h-16 w-16 mx-auto text-muted-foreground/40" />
        <h2 className="text-xl font-semibold">Nenhum registro encontrado</h2>
        <p className="text-muted-foreground text-sm">Faça um agendamento para começar a acumular benefícios.</p>
        <Button onClick={() => navigate('/')}>Voltar ao início</Button>
      </div>
    </div>
  );

  const totalCashbackAll = Object.values(cashbackByCompany).reduce((s, v) => s + v, 0);
  const totalPointsAll = Object.values(pointsByCompany).reduce((s, v) => s + v, 0);

  if (!loading && clients.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center space-y-4">
          <User className="h-12 w-12 mx-auto text-muted-foreground" />
          <h2 className="text-xl font-bold">Nenhum agendamento encontrado</h2>
          <p className="text-sm text-muted-foreground">
            Ainda não encontramos agendamentos vinculados à sua conta. Após realizar um agendamento, seus dados aparecerão aqui automaticamente.
          </p>
          <Button onClick={() => navigate('/')} className="w-full">
            Explorar estabelecimentos
          </Button>
          <Button variant="ghost" onClick={signOut} className="w-full text-sm">
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display font-bold text-xl">Minha Conta</h1>
            <p className="text-sm text-muted-foreground">{currentClient?.name}</p>
          </div>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Company selector */}
        {Object.keys(companies).length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Object.entries(companies).map(([id, name]) => (
              <Button
                key={id}
                variant={selectedCompanyId === id ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCompanyId(id)}
                className="whitespace-nowrap"
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
                  <p className="font-semibold text-sm">👋 Complete seu cadastro para liberar benefícios:</p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {isCashbackActive && <li>💰 Cashback em serviços</li>}
                    {isLoyaltyActive && <li>⭐ Pontos de fidelidade</li>}
                    <li>📅 Histórico completo de agendamentos</li>
                    <li>🔔 Avisos de promoções e horários disponíveis</li>
                  </ul>
                  <Button size="sm" onClick={() => setShowCompleteProfile(true)}>
                    Completar cadastro
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Multi-company benefits info */}
        {Object.keys(companies).length > 1 && (
          <Card className="border-blue-500/20 bg-blue-500/5">
            <CardContent className="p-3 flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                💡 Seus benefícios são válidos apenas na empresa onde foram gerados.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Multi-company summary */}
        {Object.keys(companies).length > 1 && (totalCashbackAll > 0 || totalPointsAll > 0) && (
          <div className="space-y-2">
            {totalCashbackAll > 0 && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">💰 Cashback por empresa</p>
                  {Object.entries(cashbackByCompany).map(([cid, amt]) => (
                    <div key={cid} className="flex justify-between text-sm">
                      <span>{companies[cid]}</span>
                      <span className="font-semibold text-green-600">R$ {amt.toFixed(2)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
            {totalPointsAll > 0 && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">⭐ Pontos por empresa</p>
                  {Object.entries(pointsByCompany).map(([cid, pts]) => (
                    <div key={cid} className="flex justify-between text-sm">
                      <span>{companies[cid]}</span>
                      <span className="font-semibold text-yellow-600">{pts} pontos</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{upcomingAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Próximos</p>
            </CardContent>
          </Card>
          {isCashbackActive && (
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-bold">R$ {cashbackTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Cashback</p>
              </CardContent>
            </Card>
          )}
          {isLoyaltyActive && (
            <Card>
              <CardContent className="p-3 text-center">
                <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-lg font-bold">{loyaltyBalance}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
                {pointValue > 0 && (
                  <p className="text-[10px] text-muted-foreground">≈ R$ {balanceEquivalent.toFixed(2)}</p>
                )}
              </CardContent>
            </Card>
          )}
          {!isCashbackActive && !isLoyaltyActive && (
            <>
              <Card>
                <CardContent className="p-3 text-center">
                  <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-500" />
                  <p className="text-lg font-bold">{pastAppointments.filter(a => a.status === 'completed').length}</p>
                  <p className="text-xs text-muted-foreground">Concluídos</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-3 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{companyAppointments.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Benefit highlights */}
        {(cashbackTotal > 0 || loyaltyBalance > 0) && selectedCompanyId && (
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="p-3">
              <p className="text-sm font-semibold">🎁 Você tem benefícios disponíveis nesta barbearia</p>
            </CardContent>
          </Card>
        )}

        {/* Notifications */}
        {notifications.length > 0 && (
          <div className="space-y-2">
            {notifications.map((n, i) => (
              <Card key={i} className="border-l-4 border-l-primary/50">
                <CardContent className="p-3 flex items-center gap-3">
                  {n.icon}
                  <p className="text-sm">{n.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="appointments" className="w-full">
          <TabsList className="w-full grid grid-cols-4">
            <TabsTrigger value="appointments" className="text-xs">📅 Agenda</TabsTrigger>
            {isCashbackActive && <TabsTrigger value="cashback" className="text-xs">💰 Cashback</TabsTrigger>}
            {isLoyaltyActive && <TabsTrigger value="loyalty" className="text-xs">⭐ Pontos</TabsTrigger>}
            {isLoyaltyActive && <TabsTrigger value="rewards" className="text-xs">🎁 Resgatar</TabsTrigger>}
            {!isCashbackActive && !isLoyaltyActive && <TabsTrigger value="notifications" className="text-xs">🔔 Avisos</TabsTrigger>}
          </TabsList>

          {/* Appointments Tab */}
          <TabsContent value="appointments" className="space-y-4 mt-4">
            {upcomingAppointments.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground">Próximos agendamentos</h3>
                {upcomingAppointments.map(apt => (
                  <Card key={apt.id}>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
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
                          🔄 Remarcar
                        </Button>
                        <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => navigate(`/cancel/${apt.id}`)}>
                          ❌ Cancelar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground">Histórico</h3>
              {pastAppointments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum agendamento anterior</p>
              ) : (
                pastAppointments.slice(0, 20).map(apt => (
                  <Card key={apt.id} className="opacity-80">
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">
                          {format(parseISO(apt.start_time), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {apt.appointment_services?.map(s => s.service?.name).filter(Boolean).join(', ')}
                        </p>
                        {apt.company && Object.keys(companies).length > 1 && (
                          <p className="text-xs text-muted-foreground">📍 {apt.company.name}</p>
                        )}
                      </div>
                      <div className="text-right">
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

          {/* Cashback Tab */}
          {isCashbackActive && (
            <TabsContent value="cashback" className="space-y-4 mt-4">
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Cashback disponível</p>
                  <p className="text-3xl font-bold text-green-600">R$ {cashbackTotal.toFixed(2)}</p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Detalhes</h3>
                {companyCashbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum cashback registrado</p>
                ) : (
                  companyCashbacks.map(cb => {
                    const daysLeft = differenceInDays(parseISO(cb.expires_at), new Date());
                    return (
                      <Card key={cb.id}>
                        <CardContent className="p-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">R$ {Number(cb.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {cb.promotion?.title || 'Promoção'}
                            </p>
                            {companies[cb.company_id] && Object.keys(companies).length > 1 && (
                              <p className="text-xs text-muted-foreground">📍 {companies[cb.company_id]}</p>
                            )}
                          </div>
                          <div className="text-right">
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

          {/* Loyalty Points Tab */}
          {isLoyaltyActive && (
            <TabsContent value="loyalty" className="space-y-4 mt-4">
              <Card className="bg-yellow-500/5 border-yellow-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Seus pontos</p>
                  <p className="text-3xl font-bold text-yellow-600">{loyaltyBalance}</p>
                  {pointValue > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Equivalente: R$ {balanceEquivalent.toFixed(2)}
                    </p>
                  )}
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Movimentações</h3>
                {companyLoyaltyTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação</p>
                ) : (
                  companyLoyaltyTxs.map(tx => (
                    <Card key={tx.id}>
                      <CardContent className="p-3 flex justify-between items-center">
                        <div>
                          <p className="text-sm font-medium">
                            {tx.transaction_type === 'earn' ? '+' : '-'}{tx.points} pontos
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {tx.description || (tx.transaction_type === 'earn' ? 'Serviço concluído' : 'Resgate')}
                          </p>
                        </div>
                        <div className="text-right">
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

          {/* Rewards Tab */}
          {isLoyaltyActive && (
            <TabsContent value="rewards" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Seu saldo: <strong>{loyaltyBalance} pontos</strong></p>
              </div>

              {companyRewards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma recompensa disponível</p>
              ) : (
                <div className="grid gap-3">
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
                              <img src={reward.image_url} alt={reward.name} className="w-16 h-16 rounded-lg object-cover" />
                            ) : (
                              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                                <Gift className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1">
                              <p className="font-semibold text-sm">{reward.name}</p>
                              {reward.description && (
                                <p className="text-xs text-muted-foreground">{reward.description}</p>
                              )}
                              <p className="text-sm font-bold mt-1">{reward.points_required} pontos</p>
                              {canRedeem ? (
                                <Badge className="bg-green-500/10 text-green-600 mt-1">Disponível para resgate</Badge>
                              ) : partial ? (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Use seus pontos + R$ {cashNeeded.toFixed(2)}
                                </p>
                              ) : (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Faltam {diff} pontos
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

          {/* Notifications Tab (fallback) */}
          {!isCashbackActive && !isLoyaltyActive && (
            <TabsContent value="notifications" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação no momento</p>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Complete Profile Dialog */}
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

            <div className="border-t pt-4">
              <p className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Endereço (opcional)
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">CEP</Label>
                    <Input
                      value={profileForm.postal_code}
                      onChange={e => setProfileForm(f => ({ ...f, postal_code: e.target.value }))}
                      placeholder="00000-000"
                      maxLength={9}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Número</Label>
                    <Input
                      value={profileForm.address_number}
                      onChange={e => setProfileForm(f => ({ ...f, address_number: e.target.value }))}
                      placeholder="123"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Rua</Label>
                  <Input
                    value={profileForm.street}
                    onChange={e => setProfileForm(f => ({ ...f, street: e.target.value }))}
                    placeholder="Rua / Avenida"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Bairro</Label>
                  <Input
                    value={profileForm.district}
                    onChange={e => setProfileForm(f => ({ ...f, district: e.target.value }))}
                    placeholder="Bairro"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Cidade</Label>
                    <Input
                      value={profileForm.city}
                      onChange={e => setProfileForm(f => ({ ...f, city: e.target.value }))}
                      placeholder="Cidade"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Estado</Label>
                    <Input
                      value={profileForm.state}
                      onChange={e => setProfileForm(f => ({ ...f, state: e.target.value }))}
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={handleCompleteProfile} disabled={!profileForm.email || !profileForm.birth_date}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
