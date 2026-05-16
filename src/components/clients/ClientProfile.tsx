import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { useRefreshData } from '@/hooks/useRefreshData';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Calendar as DateCalendar } from '@/components/ui/calendar';
import { format, parseISO, isSameMonth, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, formatWhatsApp, openWhatsApp } from '@/lib/whatsapp';
import { toast } from 'sonner';
import { handleError } from '@/lib/error-handler';
import { ArrowLeft, Ban, Pencil, MessageCircle, Crown, ShieldCheck, Calendar, DollarSign, Star, CreditCard, Activity, CheckCircle2, AlertCircle, Clock, Scissors, CalendarCheck } from 'lucide-react';

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string | null;
  email: string | null;
  birth_date: string | null;
  next_recommended_visit: string | null;
  created_at: string;
  is_blocked: boolean;
  notes?: string | null;
}

interface ClientProfileProps {
  client: ClientRow;
  companyId: string;
  profileMap: Record<string, string>;
  onBack: () => void;
}

export const ClientProfile = ({ client, companyId, profileMap, onBack }: ClientProfileProps) => {
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
    notes: client.notes || '',
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ['client-detail-appointments', client.id, companyId, isAdmin, profileId],
    queryFn: async () => {
      let query = supabase
        .from('appointments')
        .select('id, start_time, total_price, status, professional_id')
        .eq('company_id', companyId)
        .eq('client_id', client.id);
      if (!isAdmin && profileId) query = query.eq('professional_id', profileId);
      const { data, error } = await query.order('start_time', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

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

  const { data: services = [] } = useQuery({
    queryKey: ['services-for-client', companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('services').select('id, name').eq('company_id', companyId);
      if (error) throw error;
      return data;
    },
  });

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
  const firstVisit = completedAppts.length > 0 ? completedAppts[completedAppts.length - 1]?.start_time : null;

  const profCount: Record<string, number> = {};
  completedAppts.forEach(a => { profCount[a.professional_id] = (profCount[a.professional_id] || 0) + 1; });
  const favProfId = Object.entries(profCount).sort((a, b) => b[1] - a[1])[0]?.[0];
  const favProfName = favProfId ? profileMap[favProfId] || 'Desconhecido' : '-';

  const serviceCount: Record<string, number> = {};
  apptServices.forEach(as => {
    const name = serviceMap[as.service_id] || 'Desconhecido';
    serviceCount[name] = (serviceCount[name] || 0) + 1;
  });

  const latestPointsBalance = loyaltyTransactions.length > 0
    ? Number((loyaltyTransactions[0] as any).balance_after ?? loyaltyTransactions.reduce((sum: number, tx: any) => sum + Number(tx.points || 0), 0))
    : 0;

  const subscriptionPlan = (clientSubscription as any)?.subscription_plans;
  const subscriptionCharges = ((clientSubscription as any)?.charges || []).slice().sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
  const subscriptionUsage = ((clientSubscription as any)?.usage || []).slice().sort((a: any, b: any) => new Date(b.usage_date).getTime() - new Date(a.usage_date).getTime());
  const nextOpenCharge = subscriptionCharges.find((charge: any) => charge.status !== 'paid');
  const currentMonthUsage = subscriptionUsage.filter((usage: any) => isSameMonth(parseISO(usage.usage_date), new Date()));

  const getSubscriptionStatusBadge = (status?: string) => {
    switch (status) {
      case 'active': return <Badge className="bg-green-100 text-green-700 border-none">Ativo</Badge>;
      case 'past_due': return <Badge className="bg-amber-100 text-amber-700 border-none">Em risco</Badge>;
      case 'suspended': return <Badge className="bg-orange-100 text-orange-700 border-none">Suspenso</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge variant="secondary">{status || 'Sem status'}</Badge>;
    }
  };

  const getSubscriptionPaymentInfo = () => {
    if (!clientSubscription) return { label: 'Sem assinatura', badge: <Badge variant="secondary">Sem assinatura</Badge>, detail: '-' };
    if (!nextOpenCharge) return { label: 'Em dia', badge: <Badge className="bg-green-100 text-green-700 border-none">Em dia</Badge>, detail: 'Nenhuma cobrança pendente' };
    const diff = differenceInCalendarDays(parseISO(nextOpenCharge.due_date), new Date());
    if (nextOpenCharge.status === 'overdue' || diff < 0) return { label: 'Atrasado', badge: <Badge className="bg-red-100 text-red-700 border-none">Atrasado</Badge>, detail: `Atrasado há ${Math.abs(diff)} dias` };
    if (diff === 0) return { label: 'Vence hoje', badge: <Badge className="bg-amber-100 text-amber-700 border-none">Vence hoje</Badge>, detail: 'Vencimento hoje' };
    return { label: `Vence em ${diff} dias`, badge: <Badge className="bg-blue-100 text-blue-700 border-none">Vence em {diff} dias</Badge>, detail: `Próximo vencimento em ${format(parseISO(nextOpenCharge.due_date), 'dd/MM/yyyy')}` };
  };

  const paymentInfo = getSubscriptionPaymentInfo();
  const appointmentDates = appointments.map(a => parseISO(a.start_time));
  const selectedDayAppointments = selectedHistoryDate ? appointments.filter(a => isSameDay(parseISO(a.start_time), selectedHistoryDate)) : [];

  const handleSaveClient = async () => {
    if (!editForm.name.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('clients').update({
        name: editForm.name.trim(),
        whatsapp: editForm.whatsapp.trim() ? formatWhatsApp(editForm.whatsapp.trim()) : null,
        email: editForm.email.trim() || null,
        birth_date: editForm.birth_date || null,
        notes: editForm.notes.trim() || null,
      } as any).eq('id', client.id).eq('company_id', companyId);
      if (error) throw error;
      refresh('clients');
      toast.success('Cliente atualizado com sucesso');
      setEditOpen(false);
    } catch (err) { handleError(err, { area: 'client.profile.update', companyId }); } finally { setSaving(false); }
  };

  const handleToggleBlock = async () => {
    const newBlocked = !client.is_blocked;
    try {
      const { error } = await supabase.from('clients').update({ is_blocked: newBlocked } as any).eq('id', client.id).eq('company_id', companyId);
      if (error) throw error;
      client.is_blocked = newBlocked;
      refresh('clients');
      toast.success(newBlocked ? 'Cliente bloqueado' : 'Cliente desbloqueado');
    } catch (err) { handleError(err, { area: 'client.profile.toggleBlock', companyId }); }
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
            {clientSubscription && <Badge className="text-xs gap-1 bg-amber-100 text-amber-800 border-none"><Crown className="h-3 w-3" /> Assinante</Badge>}
            {client.is_blocked && <Badge variant="destructive" className="text-xs gap-1"><Ban className="h-3 w-3" /> Bloqueado</Badge>}
          </div>
          <p className="text-muted-foreground text-sm flex items-center gap-1 flex-wrap">
            {client.whatsapp ? displayWhatsApp(client.whatsapp) : 'Sem WhatsApp'}
            {client.email && ` | ${client.email}`}
            {client.birth_date && ` | Nasc.: ${format(parseISO(client.birth_date), 'dd/MM/yyyy')}`}
          </p>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          <Button variant={client.is_blocked ? 'outline' : 'destructive'} size="sm" className="gap-2" onClick={handleToggleBlock}>
            {client.is_blocked ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            <span>{client.is_blocked ? 'Desbloquear' : 'Bloquear'}</span>
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => { setEditForm({ name: client.name, whatsapp: client.whatsapp || '', email: client.email || '', birth_date: client.birth_date || '', notes: client.notes || '' }); setEditOpen(true); }}>
            <Pencil className="h-4 w-4" /> <span>Editar</span>
          </Button>
          {client.whatsapp && <Button size="sm" className="bg-green-600 hover:bg-green-700 gap-2" onClick={() => openWhatsApp(client.whatsapp!, { source: 'clients' })}><MessageCircle className="h-4 w-4" /> <span>WhatsApp</span></Button>}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cliente</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Nome *</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} maxLength={100} /></div>
            <div className="space-y-2"><Label>WhatsApp</Label><Input value={editForm.whatsapp} onChange={e => { const d = e.target.value.replace(/\D/g, '').slice(0, 11); let m = d; if (d.length > 7) m = `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`; else if (d.length > 2) m = `(${d.slice(0,2)}) ${d.slice(2)}`; setEditForm(f => ({ ...f, whatsapp: m })); }} maxLength={15} /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm(f => ({ ...f, email: e.target.value }))} maxLength={255} /></div>
            <div className="space-y-2"><Label>Data de nascimento</Label><Input type="date" value={editForm.birth_date} onChange={e => setEditForm(f => ({ ...f, birth_date: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveClient} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatsCard icon={<Calendar className="h-4 w-4" />} label="Total de visitas" value={totalVisits.toString()} />
        <StatsCard icon={<DollarSign className="h-4 w-4" />} label="Total gasto" value={`R$ ${totalSpent.toFixed(2)}`} />
        <StatsCard icon={<Calendar className="h-4 w-4" />} label="Primeira visita" value={firstVisit ? format(parseISO(firstVisit), 'dd/MM/yy', { locale: ptBR }) : '-'} />
        <StatsCard icon={<Star className="h-4 w-4" />} label="Profissional favorito" value={favProfName} />
      </div>

      {clientSubscription && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50 via-white to-white">
          <CardHeader><CardTitle className="text-base flex flex-wrap items-center gap-2"><Crown className="h-4 w-4 text-amber-600" /> Assinatura {getSubscriptionStatusBadge((clientSubscription as any).status)} {paymentInfo.badge}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <InfoTile label="Plano atual" value={subscriptionPlan?.name || '-'} sub={subscriptionPlan?.type === 'unlimited' ? 'Ilimitado' : `${subscriptionPlan?.usage_limit || 0} usos/mÃªs`} />
              <InfoTile label="Pagamento" value={paymentInfo.label} sub={paymentInfo.detail} />
              <InfoTile label="Atendimento" value="Profissionais do plano" sub="Comissao configurada no plano" />
              <InfoTile label="Uso no ciclo" value={subscriptionPlan?.type === 'unlimited' ? `${currentMonthUsage.length} usos` : `${currentMonthUsage.length}/${subscriptionPlan?.usage_limit || 0}`} sub={`CobranÃ§a todo dia ${(clientSubscription as any).billing_day}`} />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><CalendarCheck className="h-4 w-4" /> HistÃ³rico de agendamentos</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
            <div className="rounded-xl border bg-muted/20 p-3">
              <DateCalendar mode="single" selected={selectedHistoryDate} onSelect={setSelectedHistoryDate} locale={ptBR} modifiers={{ hasAppointment: appointmentDates }} modifiersClassNames={{ hasAppointment: 'relative after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-primary font-semibold ring-1 ring-primary/30' }} className="mx-auto" />
            </div>
            <div className="space-y-3">
              {selectedDayAppointments.length === 0 ? <p className="text-sm text-muted-foreground border rounded-lg border-dashed p-4 text-center">Nenhum agendamento neste dia.</p> : (
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {selectedDayAppointments.map(appt => (
                    <div key={appt.id} className="rounded-lg border p-3 bg-background flex justify-between">
                      <div><p className="font-semibold">{format(parseISO(appt.start_time), 'HH:mm')}</p><p className="text-xs text-muted-foreground">{profileMap[appt.professional_id] || '-'}</p></div>
                      <div className="text-right"><p className="font-bold">R$ {Number(appt.total_price).toFixed(2)}</p><Badge variant="outline">{appt.status}</Badge></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

const StatsCard = ({ icon, label, value }: { icon: any, label: string, value: string }) => (
  <Card><CardContent className="pt-6"><div className="flex items-center gap-2 text-muted-foreground text-sm mb-1">{icon} {label}</div><p className="text-2xl font-bold">{value}</p></CardContent></Card>
);

const InfoTile = ({ label, value, sub }: { label: string, value: string, sub: string }) => (
  <div className="p-3 rounded-lg border bg-white"><p className="text-xs text-muted-foreground uppercase font-semibold">{label}</p><p className="font-bold">{value}</p><p className="text-xs text-muted-foreground">{sub}</p></div>
);
