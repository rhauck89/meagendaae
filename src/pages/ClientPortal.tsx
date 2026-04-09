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
import { Calendar, Clock, DollarSign, Star, Gift, Bell, User, LogOut, ChevronRight, CheckCircle2, AlertCircle, Sparkles, X } from 'lucide-react';
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
}

interface AppointmentRow {
  id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  status: string;
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
  promotion: { title: string } | null;
}

interface LoyaltyTx {
  id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  balance_after: number;
  created_at: string;
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
  const [cashbacks, setCashbacks] = useState<CashbackRow[]>([]);
  const [loyaltyTxs, setLoyaltyTxs] = useState<LoyaltyTx[]>([]);
  const [rewards, setRewards] = useState<RewardItem[]>([]);
  const [loyaltyConfig, setLoyaltyConfig] = useState<any>(null);
  const [companies, setCompanies] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ email: '', birth_date: '' });

  // Check if company has cashback/loyalty active
  const [companyCashbackActive, setCompanyCashbackActive] = useState(false);
  const [companyLoyaltyActive, setCompanyLoyaltyActive] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/auth'); return; }
    loadClientData();
  }, [user]);

  useEffect(() => {
    if (selectedCompanyId) loadCompanyData(selectedCompanyId);
  }, [selectedCompanyId]);

  const currentClient = useMemo(() =>
    clients.find(c => c.company_id === selectedCompanyId) || clients[0],
    [clients, selectedCompanyId]
  );

  const loadClientData = async () => {
    setLoading(true);
    // First link any unlinked client records by phone
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

    // Fetch all client records for this user
    const { data: clientData } = await supabase
      .from('clients')
      .select('id, company_id, name, whatsapp, email, birth_date, registration_complete')
      .eq('user_id', user!.id);

    if (clientData && clientData.length > 0) {
      setClients(clientData);
      const firstCompany = clientData[0].company_id;
      setSelectedCompanyId(firstCompany);

      // Get company names
      const companyIds = [...new Set(clientData.map(c => c.company_id))];
      const { data: companyData } = await supabase
        .from('companies')
        .select('id, name')
        .in('id', companyIds);
      if (companyData) {
        const map: Record<string, string> = {};
        companyData.forEach(c => { map[c.id] = c.name; });
        setCompanies(map);
      }

      // Check incomplete registration
      const client = clientData[0];
      if (!client.email || !client.birth_date) {
        setShowCompleteProfile(true);
        setProfileForm({
          email: client.email || '',
          birth_date: client.birth_date || '',
        });
      }
    }
    setLoading(false);
  };

  const loadCompanyData = async (companyId: string) => {
    const client = clients.find(c => c.company_id === companyId);
    if (!client) return;

    // Load appointments, cashback, loyalty, rewards in parallel
    const [aptsRes, cashRes, loyaltyTxRes, rewardsRes, loyaltyConfigRes, promoCheck] = await Promise.all([
      supabase
        .from('appointments')
        .select('id, start_time, end_time, total_price, status, company:companies(name), professional:profiles!appointments_professional_id_fkey(full_name), appointment_services(price, service:services(name))')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('start_time', { ascending: false })
        .limit(50),
      supabase
        .from('client_cashback')
        .select('id, amount, status, expires_at, created_at, promotion:promotions!client_cashback_promotion_id_fkey(title)')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false }),
      supabase
        .from('loyalty_points_transactions')
        .select('*')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('loyalty_reward_items')
        .select('*')
        .eq('company_id', companyId)
        .eq('active', true),
      supabase
        .from('loyalty_config')
        .select('*')
        .eq('company_id', companyId)
        .single(),
      supabase
        .from('promotions')
        .select('id')
        .eq('company_id', companyId)
        .eq('promotion_type', 'cashback')
        .eq('status', 'active')
        .limit(1),
    ]);

    setAppointments((aptsRes.data || []) as any);
    setCashbacks((cashRes.data || []) as any);
    setLoyaltyTxs(loyaltyTxRes.data || []);
    setRewards((rewardsRes.data || []) as any);
    setLoyaltyConfig(loyaltyConfigRes.data);
    setCompanyCashbackActive(!!(promoCheck.data && promoCheck.data.length > 0));
    setCompanyLoyaltyActive(!!loyaltyConfigRes.data?.enabled);
  };

  const activeCashback = cashbacks.filter(c => c.status === 'active' && !isPast(parseISO(c.expires_at)));
  const cashbackTotal = activeCashback.reduce((s, c) => s + Number(c.amount), 0);

  const loyaltyBalance = loyaltyTxs.length > 0 ? loyaltyTxs[0].balance_after : 0;
  const pointValue = loyaltyConfig?.point_value || 0.05;
  const balanceEquivalent = loyaltyBalance * pointValue;

  const upcomingAppointments = appointments.filter(a => !isPast(parseISO(a.start_time)) && !['cancelled', 'no_show'].includes(a.status));
  const pastAppointments = appointments.filter(a => isPast(parseISO(a.start_time)) || ['cancelled', 'no_show'].includes(a.status));

  // Notifications
  const notifications = useMemo(() => {
    const items: { icon: React.ReactNode; text: string; type: string }[] = [];
    if (cashbackTotal > 0) {
      const expiringSoon = activeCashback.filter(c => differenceInDays(parseISO(c.expires_at), new Date()) <= 10);
      if (expiringSoon.length > 0) {
        items.push({ icon: <AlertCircle className="h-4 w-4 text-yellow-500" />, text: `Cashback de R$ ${expiringSoon.reduce((s, c) => s + Number(c.amount), 0).toFixed(2)} expira em breve!`, type: 'warning' });
      }
    }
    // Rewards reachable
    rewards.forEach(r => {
      const diff = r.points_required - loyaltyBalance;
      if (diff <= 0) {
        items.push({ icon: <Gift className="h-4 w-4 text-green-500" />, text: `🎁 Você já pode resgatar: ${r.name}`, type: 'success' });
      } else if (diff <= r.points_required * 0.2) {
        items.push({ icon: <Star className="h-4 w-4 text-primary" />, text: `⭐ Faltam apenas ${diff} pontos para resgatar ${r.name}`, type: 'info' });
      }
    });
    return items;
  }, [cashbackTotal, activeCashback, rewards, loyaltyBalance]);

  const handleCompleteProfile = async () => {
    if (!currentClient) return;
    const updates: any = {};
    if (profileForm.email) updates.email = profileForm.email;
    if (profileForm.birth_date) updates.birth_date = profileForm.birth_date;
    updates.registration_complete = true;

    const { error } = await supabase
      .from('clients')
      .update(updates)
      .eq('id', currentClient.id);

    if (error) { toast.error('Erro ao atualizar cadastro'); return; }
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
        {/* Company selector if multiple */}
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
        {currentClient && (!currentClient.email || !currentClient.birth_date) && (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Sparkles className="h-6 w-6 text-primary mt-0.5 shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="font-semibold text-sm">👋 Olá {currentClient.name}!</p>
                  <p className="text-xs text-muted-foreground">
                    Complete seu cadastro e aproveite benefícios como:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {companyCashbackActive && <li>💰 Cashback em serviços</li>}
                    {companyLoyaltyActive && <li>⭐ Pontos no programa de fidelidade</li>}
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

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="p-3 text-center">
              <Calendar className="h-5 w-5 mx-auto mb-1 text-primary" />
              <p className="text-lg font-bold">{upcomingAppointments.length}</p>
              <p className="text-xs text-muted-foreground">Próximos</p>
            </CardContent>
          </Card>
          {companyCashbackActive && (
            <Card>
              <CardContent className="p-3 text-center">
                <DollarSign className="h-5 w-5 mx-auto mb-1 text-green-500" />
                <p className="text-lg font-bold">R$ {cashbackTotal.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Cashback</p>
              </CardContent>
            </Card>
          )}
          {companyLoyaltyActive && (
            <Card>
              <CardContent className="p-3 text-center">
                <Star className="h-5 w-5 mx-auto mb-1 text-yellow-500" />
                <p className="text-lg font-bold">{loyaltyBalance}</p>
                <p className="text-xs text-muted-foreground">Pontos</p>
              </CardContent>
            </Card>
          )}
          {!companyCashbackActive && !companyLoyaltyActive && (
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
                  <p className="text-lg font-bold">{appointments.length}</p>
                  <p className="text-xs text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

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
            {companyCashbackActive && <TabsTrigger value="cashback" className="text-xs">💰 Cashback</TabsTrigger>}
            {companyLoyaltyActive && <TabsTrigger value="loyalty" className="text-xs">⭐ Pontos</TabsTrigger>}
            {companyLoyaltyActive && <TabsTrigger value="rewards" className="text-xs">🎁 Resgatar</TabsTrigger>}
            {!companyCashbackActive && !companyLoyaltyActive && <TabsTrigger value="notifications" className="text-xs">🔔 Avisos</TabsTrigger>}
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
          {companyCashbackActive && (
            <TabsContent value="cashback" className="space-y-4 mt-4">
              <Card className="bg-green-500/5 border-green-500/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground">Cashback disponível</p>
                  <p className="text-3xl font-bold text-green-600">R$ {cashbackTotal.toFixed(2)}</p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-muted-foreground">Detalhes</h3>
                {cashbacks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhum cashback registrado</p>
                ) : (
                  cashbacks.map(cb => {
                    const daysLeft = differenceInDays(parseISO(cb.expires_at), new Date());
                    return (
                      <Card key={cb.id}>
                        <CardContent className="p-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">R$ {Number(cb.amount).toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">
                              {cb.promotion?.title || 'Promoção'}
                            </p>
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
          {companyLoyaltyActive && (
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
                {loyaltyTxs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">Nenhuma movimentação</p>
                ) : (
                  loyaltyTxs.map(tx => (
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
          {companyLoyaltyActive && (
            <TabsContent value="rewards" className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Seu saldo: <strong>{loyaltyBalance} pontos</strong></p>
              </div>

              {rewards.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhuma recompensa disponível</p>
              ) : (
                <div className="grid gap-3">
                  {rewards.map(reward => {
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
          {!companyCashbackActive && !companyLoyaltyActive && (
            <TabsContent value="notifications" className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação no momento</p>
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Complete Profile Dialog */}
      <Dialog open={showCompleteProfile} onOpenChange={setShowCompleteProfile}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Completar cadastro</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={e => setProfileForm(f => ({ ...f, email: e.target.value }))}
                placeholder="seu@email.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento</Label>
              <Input
                type="date"
                value={profileForm.birth_date}
                onChange={e => setProfileForm(f => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
            <Button className="w-full" onClick={handleCompleteProfile}>
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientPortal;
