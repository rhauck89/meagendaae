import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { useRefreshData } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { Search, MessageCircle, Users, ArrowLeft, Calendar, DollarSign, Star, Scissors, Cake, Pencil, UserPlus, Ban, ShieldCheck, ArrowUpDown, ArrowUp, ArrowDown, CalendarCheck, Crown, Info, CreditCard, Activity, CheckCircle2, AlertCircle, Clock, Upload } from 'lucide-react';
import { format, parseISO, isSameMonth, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, formatWhatsApp, openWhatsApp, normalizePhone } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ClientImportModal } from '@/components/clients/ClientImportModal';

// ... keep existing code
  const [duplicateClient, setDuplicateClient] = useState<any>(null);
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);

  const handleAddClient = async () => {
// ... keep existing code
  if (selectedClient) {
    return (
      <ClientProfile
        client={selectedClient}
        companyId={companyId!}
        profileMap={profileMap}
        onBack={() => setSelectedClientId(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold">Clientes</h2>
          <p className="text-muted-foreground text-sm">{filtered.length} {filtered.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {isAdmin && (
            <>
              <Button variant="outline" className="gap-2" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4" /> Importar clientes
              </Button>
              <Button className="gap-2" onClick={() => setAddClientOpen(true)}>
                <UserPlus className="h-4 w-4" /> Cadastrar cliente
              </Button>
            </>
          )}
        </div>
      </div>

      <ClientImportModal 
        open={importModalOpen} 
        onOpenChange={setImportModalOpen} 
        companyId={companyId || ''} 
        onImportSuccess={() => queryClient.invalidateQueries({ queryKey: ['clients'] })}
      />

      {/* Add Client Dialog */}
      <Dialog open={addClientOpen} onOpenChange={(v) => { setAddClientOpen(v); if (!v) setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cadastrar novo cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input value={addClientForm.name} onChange={e => setAddClientForm(f => ({ ...f, name: e.target.value }))} maxLength={100} placeholder="Nome do cliente" />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp *</Label>
              <Input value={addClientForm.whatsapp} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let masked = digits;
                if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                setAddClientForm(f => ({ ...f, whatsapp: masked }));
              }} maxLength={15} placeholder="(31) 99999-9999" />
            </div>
            <div className="space-y-2">
              <Label>Email (opcional)</Label>
              <Input type="email" value={addClientForm.email} onChange={e => setAddClientForm(f => ({ ...f, email: e.target.value }))} maxLength={255} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input type="date" value={addClientForm.birth_date} onChange={e => setAddClientForm(f => ({ ...f, birth_date: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddClientOpen(false)}>Cancelar</Button>
            <Button onClick={handleAddClient} disabled={addClientSaving}>
              {addClientSaving ? 'Salvando...' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Client Dialog */}
      <Dialog open={duplicateDialogOpen} onOpenChange={setDuplicateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cliente já cadastrado</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Já existe um cliente cadastrado com este número de WhatsApp:
          </p>
          {duplicateClient && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <p className="font-medium">{duplicateClient.name}</p>
              <p className="text-sm text-muted-foreground">{duplicateClient.whatsapp}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">Deseja utilizar esse cliente?</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDuplicateDialogOpen(false); setDuplicateClient(null); }}>Cancelar</Button>
            <Button onClick={() => {
              setDuplicateDialogOpen(false);
              setAddClientOpen(false);
              setAddClientForm({ name: '', whatsapp: '', email: '', birth_date: '', notes: '' });
              if (duplicateClient) setSelectedClientId(duplicateClient.id);
              setDuplicateClient(null);
            }}>
              Usar cliente existente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou WhatsApp..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total de Clientes</p>
              <p className="text-2xl font-bold">{metrics.totalClients}</p>
              <p className="text-xs text-muted-foreground">acumulado</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
              <UserPlus className="h-5 w-5 text-green-500" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-xs text-muted-foreground">Clientes no mês</p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs">Clientes cuja primeira visita ocorreu neste período</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-2xl font-bold">{metrics.newClientsMonth}</p>
              <p className="text-xs text-muted-foreground">novos este mês</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
              <CalendarCheck className="h-5 w-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Total de Agendamentos</p>
              <p className="text-2xl font-bold">{metrics.totalAppointments}</p>
              <p className="text-xs text-muted-foreground">realizados</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Crown className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Top Cliente do mês</p>
              {metrics.topClientMonth ? (
                <>
                  <p className="text-sm font-bold truncate">{metrics.topClientMonth.name}</p>
                  <p className="text-xs text-muted-foreground">{metrics.topClientMonth.count} atendimentos</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem dados</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Birthdays */}
      {clientsWithBirthdays.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Cake className="h-4 w-4 text-pink-500" /> Próximos aniversariantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {displayBirthdays.map(c => (
                <div key={c.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="font-medium text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(c.birth_date!), "dd/MM", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={c.daysRemaining === 0 ? 'default' : 'secondary'} className="text-xs">
                      {daysLabel(c.daysRemaining)}
                    </Badge>
                    {c.whatsapp && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-green-600"
                        onClick={() => openWhatsApp(c.whatsapp!, { source: 'clients' })}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {clientsWithBirthdays.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-3 w-full text-xs"
                onClick={() => setShowAllBirthdays(!showAllBirthdays)}
              >
                {showAllBirthdays ? 'Ver menos' : `Ver todos (${clientsWithBirthdays.length})`}
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="text-center text-muted-foreground py-8">
            Nenhum cliente encontrado
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium"
                          onClick={() => toggleSort('name')}
                        >
                          Nome <SortIcon col="name" />
                        </button>
                      </TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium"
                          onClick={() => toggleSort('lastVisit')}
                        >
                          Última visita <SortIcon col="lastVisit" />
                        </button>
                      </TableHead>
                      <TableHead className="text-center">
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium mx-auto"
                          onClick={() => toggleSort('totalVisits')}
                        >
                          Agendamentos <SortIcon col="totalVisits" />
                        </button>
                      </TableHead>
                      <TableHead>
                        <Select value={profFilter} onValueChange={setProfFilter}>
                          <SelectTrigger className="h-auto border-0 p-0 shadow-none font-medium text-muted-foreground hover:text-foreground text-xs gap-1 w-auto">
                            <SelectValue placeholder="Profissional favorito" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos profissionais</SelectItem>
                            {uniqueProfessionals.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableHead>
                      <TableHead className="text-right">
                        <button
                          className="flex items-center gap-0.5 hover:text-foreground transition-colors font-medium ml-auto"
                          onClick={() => toggleSort('totalSpent')}
                        >
                          Total gasto <SortIcon col="totalSpent" />
                        </button>
                      </TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(client => {
                      const stats = clientStatsMap[client.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
                      return (
                        <TableRow
                          key={client.id}
                          className="cursor-pointer"
                          onClick={() => setSelectedClientId(client.id)}
                        >
                          <TableCell className="font-medium">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                {client.name}
                                {client.is_blocked && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                    <Ban className="h-3 w-3 mr-0.5" /> Bloqueado
                                  </Badge>
                                ) || subscriberStatuses[client.id] && (
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border-none ${
                                    subscriberStatuses[client.id] === 'active' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                                  }`}>
                                    <Crown className="h-3 w-3 mr-1" /> {subscriberStatuses[client.id] === 'active' ? 'Assinante' : 'Assinatura Inativa'}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}
                          </TableCell>
                          <TableCell>
                            {stats.lastVisit
                              ? format(parseISO(stats.lastVisit), "dd/MM/yyyy", { locale: ptBR })
                              : '-'}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{stats.totalVisits}</Badge>
                          </TableCell>
                          <TableCell>{stats.favProfName}</TableCell>
                          <TableCell className="text-right">
                            R$ {stats.totalSpent.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            {client.whatsapp && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-green-600"
                                onClick={e => {
                                  e.stopPropagation();
                                  openWhatsApp(client.whatsapp!, { source: 'clients' });
                                }}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map(client => {
              const stats = clientStatsMap[client.id] || { totalVisits: 0, totalSpent: 0, lastVisit: null, favProfName: '-' };
              return (
                <Card
                  key={client.id}
                  className="cursor-pointer active:bg-muted/50 transition-colors"
                  onClick={() => setSelectedClientId(client.id)}
                >
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm flex items-center gap-2">
                        {client.name}
                        {client.is_blocked && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                            <Ban className="h-3 w-3 mr-0.5" /> Bloqueado
                          </Badge>
                        )}
                      </p>
                      <div className="flex items-center gap-1">
                        <Badge variant="secondary" className="text-xs">{stats.totalVisits} visitas</Badge>
                        {client.whatsapp && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-green-600"
                            onClick={e => {
                              e.stopPropagation();
                              openWhatsApp(client.whatsapp!, { source: 'clients' });
                            }}
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>WhatsApp: {client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}</span>
                      <span>Última visita: {stats.lastVisit ? format(parseISO(stats.lastVisit), "dd/MM/yy", { locale: ptBR }) : '-'}</span>
                      <span>Favorito: {stats.favProfName}</span>
                      <span className="font-medium text-foreground">R$ {stats.totalSpent.toFixed(2)}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

// --- Client Profile Sub-component ---

interface ClientProfileProps {
  client: ClientRow;
  companyId: string;
  profileMap: Record<string, string>;
  onBack: () => void;
}

const ClientProfile = ({ client, companyId, profileMap, onBack }: ClientProfileProps) => {
  const { isAdmin, profileId } = useUserRole();
  const { refresh } = useRefreshData();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedHistoryDate, setSelectedHistoryDate] = useState<Date | undefined>(undefined);
  const [editForm, setEditForm] = useState({
    name: client.name,
    whatsapp: client.whatsapp || '',
    email: client.email || '',
    birth_date: client.birth_date || '',
    notes: '',
  });

  // Fetch appointments for this client
  const { data: appointments = [] } = useQuery({
    queryKey: ['client-detail-appointments', client.id, companyId, isAdmin, profileId],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('id, start_time, total_price, status, professional_id')
        .eq('company_id', companyId)
        .eq('client_id', client.id);
      
      if (!isAdmin && profileId) {
        query = query.eq('professional_id', profileId);
      }

      const { data, error } = await query.order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch appointment services
  const appointmentIds = appointments.map(a => a.id);
  const { data: apptServices = [] } = useQuery({
    queryKey: ['client-appt-services', appointmentIds],
    queryFn: async () => {
      if (appointmentIds.length === 0) return [];
      const { data, error } = await supabase
        .from('appointment_services')
        .select('appointment_id, service_id, price, duration_minutes')
        .in('appointment_id', appointmentIds);
      if (error) throw error;
      return data;
    },
    enabled: appointmentIds.length > 0,
  });

  // Fetch services for names
  const { data: services = [] } = useQuery({
    queryKey: ['services-for-client', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('id, name')
        .eq('company_id', companyId);
      if (error) throw error;
      return data;
    },
  });

  // Fetch subscription details for this client using the same source as Assinaturas > Assinantes.
  const { data: clientSubscription } = useQuery({
    queryKey: ['client-detail-subscription', client.id, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select(`
          *,
          subscription_plans(id, name, price_monthly, price_yearly, type, usage_limit, included_services),
          professional:profiles(full_name),
          charges:subscription_charges(id, status, due_date, amount, paid_at, charge_number),
          usage:subscription_usage(id, usage_date, appointment_id, service_id)
        `)
        .eq('company_id', companyId)
        .eq('client_id', client.id)
        .in('status', ['active', 'past_due', 'suspended', 'cancelled'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).find((sub: any) => ['active', 'past_due', 'suspended'].includes(sub.status)) || data?.[0] || null;
    },
  });

  // Fetch loyalty points so the client detail mirrors the client portal/admin fidelity data.
  const { data: loyaltyTransactions = [] } = useQuery({
    queryKey: ['client-detail-loyalty-points', client.id, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_points_transactions')
        .select('id, points, transaction_type, description, balance_after, created_at')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch cashback credits
  const { data: cashbackCredits = [] } = useQuery({
    queryKey: ['client-cashback', client.id, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_cashback')
        .select('id, amount, status, expires_at, created_at, promotion:promotions(title)')
        .eq('client_id', client.id)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const activeCashback = cashbackCredits.filter((c: any) => c.status === 'active' && new Date(c.expires_at) > new Date());
  const cashbackTotal = activeCashback.reduce((sum: number, c: any) => sum + Number(c.amount), 0);

  const serviceMap = Object.fromEntries(services.map(s => [s.id, s.name]));

  useEffect(() => {
    if (!selectedHistoryDate && appointments.length > 0) {
      setSelectedHistoryDate(parseISO(appointments[0].start_time));
    }
  }, [appointments, selectedHistoryDate]);

  const completedAppts = appointments.filter(a => a.status === 'completed');
  const totalVisits = completedAppts.length;
  const totalSpent = completedAppts.reduce((sum, a) => sum + Number(a.total_price), 0);
  const firstVisit = completedAppts.length > 0
    ? completedAppts[completedAppts.length - 1]?.start_time
    : null;

  // Favorite professional
  const profCount: Record<string, number> = {};
  completedAppts.forEach(a => {
    profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1;
  });
  const favProfId = Object.entries(profCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favProfName = favProfId ? profileMap[favProfId] || 'Desconhecido' : '-';

  // Service breakdown
  const serviceCount: Record<string, number> = {};
  apptServices.forEach(as => {
    const name = serviceMap[as.service_id] || 'Desconhecido';
    serviceCount[name] = (serviceCount[name] || 0) + 1;
  });

  const latestPointsBalance = loyaltyTransactions.length > 0
    ? Number((loyaltyTransactions[0] as any).balance_after ?? loyaltyTransactions.reduce((sum: number, tx: any) => sum + Number(tx.points || 0), 0))
    : 0;

  const subscriptionPlan = (clientSubscription as any)?.subscription_plans;
  const subscriptionCharges = ((clientSubscription as any)?.charges || [])
    .slice()
    .sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const subscriptionUsage = ((clientSubscription as any)?.usage || [])
    .slice()
    .sort((a: any, b: any) => new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime());
  const nextOpenCharge = subscriptionCharges.find((charge: any) => charge.status !== 'paid');
  const currentMonthUsage = subscriptionUsage.filter((usage: any) => isSameMonth(parseISO(usage.usage_date), new Date()));
  const getSubscriptionStatusBadge = (status?: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 border-none">Ativo</Badge>;
      case 'past_due':
        return <Badge className="bg-amber-100 text-amber-700 border-none">Em risco</Badge>;
      case 'suspended':
        return <Badge className="bg-orange-100 text-orange-700 border-none">Suspenso</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      default:
        return <Badge variant="secondary">{status || 'Sem status'}</Badge>;
    }
  };

  const getSubscriptionPaymentInfo = () => {
    if (!clientSubscription) return { label: 'Sem assinatura', badge: <Badge variant="secondary">Sem assinatura</Badge>, detail: '-' };
    if (!nextOpenCharge) {
      return { label: 'Em dia', badge: <Badge className="bg-green-100 text-green-700 border-none">Em dia</Badge>, detail: 'Nenhuma cobrança pendente' };
    }
    const diff = differenceInCalendarDays(parseISO(nextOpenCharge.due_date), new Date());
    if (nextOpenCharge.status === 'overdue' || diff < 0) {
      return {
        label: 'Atrasado',
        badge: <Badge className="bg-red-100 text-red-700 border-none">Atrasado</Badge>,
        detail: `Atrasado há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`,
      };
    }
    if (diff === 0) {
      return { label: 'Vence hoje', badge: <Badge className="bg-amber-100 text-amber-700 border-none">Vence hoje</Badge>, detail: 'Vencimento hoje' };
    }
    return {
      label: `Vence em ${diff} dias`,
      badge: <Badge className="bg-blue-100 text-blue-700 border-none">Vence em {diff} dias</Badge>,
      detail: `Próximo vencimento em ${format(parseISO(nextOpenCharge.due_date), 'dd/MM/yyyy')}`,
    };
  };

  const paymentInfo = getSubscriptionPaymentInfo();
  const appointmentDates = appointments.map(a => parseISO(a.start_time));
  const selectedDayAppointments = selectedHistoryDate
    ? appointments.filter(a => isSameDay(parseISO(a.start_time), selectedHistoryDate))
    : [];

  const statusLabel: Record<string, string> = {
    completed: 'Concluído',
    confirmed: 'Confirmado',
    pending: 'Pendente',
    cancelled: 'Cancelado',
    no_show: 'Não compareceu',
  };

  const statusColor: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    confirmed: 'bg-primary/10 text-primary',
    pending: 'bg-yellow-100 text-yellow-800',
    cancelled: 'bg-red-100 text-red-800',
    no_show: 'bg-muted text-muted-foreground',
  };

  const handleSaveClient = async () => {
    if (!editForm.name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    if (editForm.name.length > 100) {
      toast.error('Nome deve ter no máximo 100 caracteres');
      return;
    }
    if (editForm.whatsapp && editForm.whatsapp.length > 20) {
      toast.error('WhatsApp inválido');
      return;
    }

    setSaving(true);
    try {
      const updateData = {
        name: editForm.name.trim(),
        whatsapp: editForm.whatsapp.trim() ? formatWhatsApp(editForm.whatsapp.trim()) : null,
        email: editForm.email.trim() || null,
        birth_date: editForm.birth_date || null,
      };

      const { error } = await supabase
        .from('clients')
        .update(updateData as any)
        .eq('id', client.id)
        .eq('company_id', companyId);

      if (error) throw error;

      client.name = editForm.name.trim();
      client.whatsapp = editForm.whatsapp.trim() || null;
      client.email = editForm.email.trim() || null;
      client.birth_date = editForm.birth_date || null;

      refresh('clients');
      toast.success('Cliente atualizado com sucesso');
      setEditOpen(false);
    } catch (err) {
      toast.error('Erro ao atualizar cliente');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    const newBlocked = !client.is_blocked;
    try {
      const { error } = await supabase
        .from('clients')
        .update({ is_blocked: newBlocked } as any)
        .eq('id', client.id)
        .eq('company_id', companyId);
      if (error) throw error;
      client.is_blocked = newBlocked;
      refresh('clients');
      toast.success(newBlocked ? 'Cliente bloqueado' : 'Cliente desbloqueado');
    } catch {
      toast.error('Erro ao atualizar status do cliente');
    }
  };

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Button>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-display font-bold truncate">{client.name}</h2>
            {clientSubscription && (
              <Badge className="text-xs gap-1 bg-amber-100 text-amber-800 border-none">
                <Crown className="h-3 w-3" /> Assinante
              </Badge>
            )}
            {client.is_blocked && (
              <Badge variant="destructive" className="text-xs gap-1">
                <Ban className="h-3 w-3" /> Bloqueado
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm break-words">
            {client.whatsapp ? displayWhatsApp(client.whatsapp) : 'Sem WhatsApp'}
            {client.email && ` • ${client.email}`}
            {client.birth_date && ` • 🎂 ${format(parseISO(client.birth_date), 'dd/MM/yyyy', { locale: ptBR })}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button
            variant={client.is_blocked ? 'outline' : 'destructive'}
            size="sm"
            className="gap-2"
            onClick={handleToggleBlock}
          >
            {client.is_blocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            <span className="hidden sm:inline">{client.is_blocked ? 'Desbloquear cliente' : 'Bloquear cliente'}</span>
            <span className="sm:hidden">{client.is_blocked ? 'Desbloquear' : 'Bloquear'}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setEditForm({
                name: client.name,
                whatsapp: client.whatsapp || '',
                email: client.email || '',
                birth_date: client.birth_date || '',
                notes: '',
              });
              setEditOpen(true);
            }}
          >
            <Pencil className="h-4 w-4" /> <span className="hidden sm:inline">Editar cliente</span><span className="sm:hidden">Editar</span>
          </Button>
          {client.whatsapp && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={() => openWhatsApp(client.whatsapp!, { source: 'clients' })}
            >
              <MessageCircle className="h-4 w-4" /> <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          )}
        </div>
      </div>

      {/* Edit Client Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label>WhatsApp</Label>
              <Input
                value={editForm.whatsapp}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                  let masked = digits;
                  if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
                  else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
                  setEditForm(f => ({ ...f, whatsapp: masked }));
                }}
                maxLength={15}
                placeholder="5511999999999"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))}
                maxLength={255}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de nascimento (opcional)</Label>
              <Input
                type="date"
                value={editForm.birth_date}
                onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" /> Total de visitas
            </div>
            <p className="text-2xl font-bold">{totalVisits}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <DollarSign className="h-4 w-4" /> Total gasto
            </div>
            <p className="text-2xl font-bold">R$ {totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Calendar className="h-4 w-4" /> Primeira visita
            </div>
            <p className="text-2xl font-bold">
              {firstVisit ? format(parseISO(firstVisit), 'dd/MM/yy', { locale: ptBR }) : '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">
              <Star className="h-4 w-4" /> Profissional favorito
            </div>
            <p className="text-lg font-bold truncate">{favProfName}</p>
          </CardContent>
        </Card>
      </div>

      {/* Subscription overview */}
      {clientSubscription && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white">
          <CardHeader>
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <Crown className="h-4 w-4 text-amber-600" />
              Assinatura
              {getSubscriptionStatusBadge((clientSubscription as any).status)}
              {paymentInfo.badge}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-white">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Plano atual</p>
                <p className="font-bold">{subscriptionPlan?.name || '-'}</p>
                <p className="text-xs text-muted-foreground">
                  {subscriptionPlan?.type === 'unlimited' ? 'Ilimitado' : `${subscriptionPlan?.usage_limit || 0} usos/mês`}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Pagamento</p>
                <p className="font-bold">{paymentInfo.label}</p>
                <p className="text-xs text-muted-foreground">{paymentInfo.detail}</p>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Profissional</p>
                <p className="font-bold">{(clientSubscription as any).professional?.full_name || '-'}</p>
                <p className="text-xs text-muted-foreground">Comissão {(clientSubscription as any).professional_commission || 0}%</p>
              </div>
              <div className="p-3 rounded-lg border bg-white">
                <p className="text-xs text-muted-foreground uppercase font-semibold">Uso no ciclo</p>
                <p className="font-bold">
                  {subscriptionPlan?.type === 'unlimited'
                    ? `${currentMonthUsage.length} usos`
                    : `${currentMonthUsage.length}/${subscriptionPlan?.usage_limit || 0}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Cobrança todo dia {(clientSubscription as any).billing_day}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Histórico financeiro
                </h4>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {subscriptionCharges.length === 0 ? (
                    <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-3 text-center">Nenhuma cobrança registrada.</p>
                  ) : (
                    subscriptionCharges.slice(0, 6).map((charge: any, idx: number) => (
                      <div key={charge.id || idx} className="flex items-center justify-between rounded-lg border bg-white p-3">
                        <div className="flex items-center gap-2">
                          {charge.status === 'paid' ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : charge.status === 'overdue' ? <AlertCircle className="h-4 w-4 text-red-600" /> : <Clock className="h-4 w-4 text-amber-600" />}
                          <div>
                            <p className="text-sm font-medium">{charge.charge_number || `Parcela ${idx + 1}`}</p>
                            <p className="text-xs text-muted-foreground">Venc. {format(parseISO(charge.due_date), 'dd/MM/yyyy')}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold">R$ {Number(charge.amount).toFixed(2)}</p>
                          <Badge variant="outline" className="text-[10px]">
                            {charge.status === 'paid' ? 'Pago' : charge.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                          </Badge>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Utilização recente
                </h4>
                <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                  {subscriptionUsage.length === 0 ? (
                    <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-3 text-center">Nenhum uso registrado.</p>
                  ) : (
                    subscriptionUsage.slice(0, 6).map((usage: any) => (
                      <div key={usage.id} className="flex items-center justify-between rounded-lg border bg-white p-3">
                        <div>
                          <p className="text-sm font-medium">{serviceMap[usage.service_id] || 'Serviço incluso'}</p>
                          <p className="text-xs text-muted-foreground">{format(parseISO(usage.usage_date), 'dd/MM/yyyy')}</p>
                        </div>
                        <Badge variant="secondary">Uso do plano</Badge>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {subscriptionPlan?.included_services?.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {subscriptionPlan.included_services.map((serviceId: string) => (
                  <Badge key={serviceId} variant="outline" className="bg-white">
                    <Scissors className="h-3 w-3 mr-1" /> {serviceMap[serviceId] || 'Serviço'}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loyalty points */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Star className="h-4 w-4 text-amber-500" /> Pontos de fidelidade
            <Badge className="bg-amber-100 text-amber-800 ml-2">
              Saldo: {latestPointsBalance} pts
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loyaltyTransactions.length === 0 ? (
            <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-3 text-center">Nenhuma movimentação de pontos registrada.</p>
          ) : (
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {loyaltyTransactions.slice(0, 6).map((tx: any) => (
                <div key={tx.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || (tx.transaction_type === 'earn' ? 'Ganho de pontos' : 'Movimentação de pontos')}</p>
                    <p className="text-xs text-muted-foreground">{format(parseISO(tx.created_at), 'dd/MM/yyyy HH:mm')}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-bold ${Number(tx.points) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {Number(tx.points) >= 0 ? '+' : ''}{Number(tx.points)} pts
                    </p>
                    <p className="text-xs text-muted-foreground">Saldo {Number(tx.balance_after ?? 0)} pts</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cashback credits */}
      {cashbackCredits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              💰 Cashback
              {cashbackTotal > 0 && (
                <Badge className="bg-green-100 text-green-800 ml-2">
                  Disponível: R$ {cashbackTotal.toFixed(2)}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {cashbackCredits.map((credit: any) => {
                const isActive = credit.status === 'active' && new Date(credit.expires_at) > new Date();
                const daysLeft = isActive ? Math.ceil((new Date(credit.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
                const promoTitle = (credit.promotion as any)?.title || 'Promoção';
                return (
                  <div key={credit.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? 'bg-green-50 border-green-200' : 'bg-muted/30 border-border'}`}>
                    <div className="min-w-0">
                      <p className={`font-semibold text-sm ${isActive ? 'text-green-800' : 'text-muted-foreground line-through'}`}>
                        R$ {Number(credit.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{promoTitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      {isActive ? (
                        <Badge variant="outline" className="text-xs text-green-700 border-green-300">
                          {daysLeft} dias restantes
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {credit.status === 'used' ? 'Usado' : 'Expirado'}
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service breakdown */}
      {Object.keys(serviceCount).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Scissors className="h-4 w-4" /> Serviços realizados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {Object.entries(serviceCount)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => (
                  <Badge key={name} variant="secondary" className="text-sm">
                    {name} × {count}
                  </Badge>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="h-4 w-4" /> Histórico de agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {appointments.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum agendamento encontrado</p>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
              <div className="rounded-xl border bg-muted/20 p-3">
                <DateCalendar
                  mode="single"
                  selected={selectedHistoryDate}
                  onSelect={setSelectedHistoryDate}
                  locale={ptBR}
                  modifiers={{ hasAppointment: appointmentDates }}
                  modifiersClassNames={{
                    hasAppointment: 'relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary font-semibold ring-1 ring-primary/30',
                  }}
                  className="mx-auto"
                />
                <p className="text-xs text-muted-foreground px-3 pb-2">
                  Os dias marcados possuem agendamentos. Clique em um dia para ver os detalhes.
                </p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {selectedHistoryDate
                        ? format(selectedHistoryDate, "dd 'de' MMMM, yyyy", { locale: ptBR })
                        : 'Selecione um dia'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedDayAppointments.length} {selectedDayAppointments.length === 1 ? 'agendamento' : 'agendamentos'}
                    </p>
                  </div>
                </div>

                {selectedDayAppointments.length === 0 ? (
                  <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-4 text-center">
                    Nenhum agendamento neste dia.
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {selectedDayAppointments.map(appt => {
                      const apptSvcs = apptServices
                        .filter(s => s.appointment_id === appt.id)
                        .map(s => serviceMap[s.service_id] || 'Serviço');
                      return (
                        <div key={appt.id} className="rounded-lg border p-3 bg-background">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold">
                                {format(parseISO(appt.start_time), 'HH:mm', { locale: ptBR })}
                              </p>
                              <p className="text-sm truncate">{apptSvcs.join(', ') || '-'}</p>
                              <p className="text-xs text-muted-foreground">{profileMap[appt.professional_id] || '-'}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="font-bold">R$ {Number(appt.total_price).toFixed(2)}</p>
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[appt.status] || ''}`}>
                                {statusLabel[appt.status] || appt.status}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Clients;
