import { useEffect, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { differenceInCalendarDays, format } from 'date-fns';
import {
  Edit,
  Info,
  MoreVertical,
  PauseCircle,
  Search,
  SlidersHorizontal,
  UserCheck,
  UserX,
} from 'lucide-react';
import { toast } from 'sonner';

interface SubscribersTabProps {
  companyId: string;
  onEditSubscriber: (subscriber: any) => void;
  onViewDetails: (subscriber: any) => void;
}

export function SubscribersTab({ companyId, onEditSubscriber, onViewDetails }: SubscribersTabProps) {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');

  useEffect(() => {
    if (companyId) {
      fetchSubscribers();
    }

    const handleRefresh = () => fetchSubscribers();
    window.addEventListener('refresh-subscribers', handleRefresh);
    return () => window.removeEventListener('refresh-subscribers', handleRefresh);
  }, [companyId]);

  const fetchSubscribers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('client_subscriptions')
        .select(`
          *,
          clients(id, name, whatsapp, email),
          subscription_plans(id, name, price_monthly, price_yearly, type, usage_limit, included_services),
          professional:profiles(full_name),
          charges:subscription_charges(status, due_date, amount),
          usage:subscription_usage(id, usage_date, appointment_id, service_id, usage_count, appointments!subscription_usage_appointment_id_fkey(status, start_time), services!subscription_usage_service_id_fkey(name))
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSubscribers(data || []);
    } catch (error: any) {
      console.error('Error fetching subscribers:', error);
      toast.error('Erro ao buscar assinantes');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .update({ status })
        .eq('id', id);

      if (error) throw error;
      toast.success(`Status atualizado para ${status}`);
      fetchSubscribers();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Ativo</Badge>;
      case 'suspended':
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Suspenso</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelado</Badge>;
      case 'past_due':
        return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Em risco</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getOpenCharge = (sub: any) => {
    const charges = [...(sub.charges || [])]
      .filter((charge: any) => charge.status !== 'paid')
      .sort(
      (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
    );
    return charges[0];
  };

  const getLastPaidCharge = (sub: any) => {
    const charges = [...(sub.charges || [])]
      .filter((charge: any) => charge.status === 'paid')
      .sort((a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime());
    return charges[0];
  };

  const buildDateFromBillingDay = (baseDate: Date, billingDay: number) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const lastDay = new Date(year, month + 1, 0).getDate();
    return new Date(year, month, Math.min(Math.max(1, billingDay || 1), lastDay));
  };

  const addBillingCycle = (date: Date, cycle: string, billingDay: number) => {
    const next = new Date(date);
    if (cycle === 'yearly') {
      next.setFullYear(next.getFullYear() + 1);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return buildDateFromBillingDay(next, billingDay);
  };

  const getNextBillingDate = (sub: any) => {
    const today = new Date();
    const billingDay = Number(sub.billing_day || new Date(sub.start_date || today).getDate());
    const lastPaid = getLastPaidCharge(sub);

    let candidate = lastPaid?.due_date
      ? addBillingCycle(new Date(lastPaid.due_date), sub.billing_cycle, billingDay)
      : buildDateFromBillingDay(today, billingDay);

    while (differenceInCalendarDays(candidate, today) < 0) {
      candidate = addBillingCycle(candidate, sub.billing_cycle, billingDay);
    }

    return candidate;
  };

  const getCurrentCycleStart = (sub: any) => {
    const today = new Date();
    const billingDay = Number(sub.billing_day || new Date(sub.start_date || today).getDate());
    let cycleStart = buildDateFromBillingDay(today, billingDay);

    if (differenceInCalendarDays(cycleStart, today) > 0) {
      const previous = new Date(cycleStart);
      if (sub.billing_cycle === 'yearly') {
        previous.setFullYear(previous.getFullYear() - 1);
      } else {
        previous.setMonth(previous.getMonth() - 1);
      }
      cycleStart = buildDateFromBillingDay(previous, billingDay);
    }

    const subscriptionStart = sub.start_date ? new Date(sub.start_date) : null;
    if (subscriptionStart && differenceInCalendarDays(subscriptionStart, cycleStart) > 0) {
      return subscriptionStart;
    }

    return cycleStart;
  };

  const getCurrentCycleUsage = (sub: any) => {
    const cycleStart = getCurrentCycleStart(sub);
    const nextBillingDate = getNextBillingDate(sub);

    return (sub.usage || []).filter((usage: any) => {
      const usageDate = new Date(usage.usage_date);
      return differenceInCalendarDays(usageDate, cycleStart) >= 0 &&
        differenceInCalendarDays(usageDate, nextBillingDate) < 0;
    });
  };

  const getPaymentState = (charge: any) => {
    if (!charge || charge.status === 'paid') return 'current';
    const diff = differenceInCalendarDays(new Date(charge.due_date), new Date());
    if (charge.status === 'overdue' || diff < 0) return 'overdue';
    return 'pending';
  };

  const getPaymentBadge = (charge: any) => {
    const state = getPaymentState(charge);
    if (state === 'current') {
      return <Badge variant="outline" className="w-fit text-[10px] border-green-100 text-green-700 bg-green-50">Em dia</Badge>;
    }
    if (state === 'overdue') {
      return <Badge variant="outline" className="w-fit text-[10px] border-red-100 text-red-700 bg-red-50">Atrasado</Badge>;
    }

    const diff = differenceInCalendarDays(new Date(charge.due_date), new Date());
    return (
      <Badge variant="outline" className="w-fit text-[10px] border-amber-100 text-amber-700 bg-amber-50">
        {diff === 0 ? 'Vence hoje' : `Vence em ${diff} dias`}
      </Badge>
    );
  };

  const getDueLabel = (sub: any, charge: any) => {
    const dueDate = charge?.due_date ? new Date(charge.due_date) : getNextBillingDate(sub);
    const state = getPaymentState(charge);
    const diff = differenceInCalendarDays(dueDate, new Date());
    if (state === 'current' && !charge) {
      if (diff === 0) return 'Vence hoje';
      return `Vence em ${diff} dias`;
    }
    if (diff === 0) return 'Hoje';
    if (diff < 0) return `Atrasado ${Math.abs(diff)} dias`;
    return `${diff} dias`;
  };

  const filteredSubscribers = subscribers.filter((sub) => {
    const query = search.trim().toLowerCase();
    const openCharge = getOpenCharge(sub);
    const paymentState = getPaymentState(openCharge);

    const matchesSearch = !query ||
      sub.clients?.name?.toLowerCase().includes(query) ||
      sub.clients?.whatsapp?.toLowerCase().includes(query) ||
      sub.subscription_plans?.name?.toLowerCase().includes(query);

    const matchesStatus = statusFilter === 'all' || sub.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || paymentState === paymentFilter;

    return matchesSearch && matchesStatus && matchesPayment;
  });

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando assinantes...</div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 rounded-2xl border bg-white p-3 shadow-sm md:grid-cols-[1fr_180px_180px_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar assinante, plano ou telefone..."
            className="h-11 rounded-xl pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Status: Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Status: Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="past_due">Em risco</SelectItem>
            <SelectItem value="suspended">Suspenso</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="h-11 rounded-xl">
            <SelectValue placeholder="Pagamento: Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Pagamento: Todos</SelectItem>
            <SelectItem value="current">Em dia</SelectItem>
            <SelectItem value="pending">A vencer</SelectItem>
            <SelectItem value="overdue">Atrasado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-11 rounded-xl gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          Filtrar
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-white hover:bg-white">
              <TableHead className="w-[250px]">Cliente</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Recorrência</TableHead>
              <TableHead>Início</TableHead>
              <TableHead>Próximo venc.</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Pagamento</TableHead>
              <TableHead>Uso do mês</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredSubscribers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-20 text-muted-foreground">
                  Nenhum assinante encontrado.
                </TableCell>
              </TableRow>
            ) : (
              filteredSubscribers.map((sub) => {
                const openCharge = getOpenCharge(sub);
                const plan = sub.subscription_plans;
                const planValue = Number(sub.billing_cycle === 'monthly' ? plan?.price_monthly : plan?.price_yearly || plan?.price_monthly || 0);
                const dueDate = openCharge?.due_date ? new Date(openCharge.due_date) : getNextBillingDate(sub);
                const paymentState = getPaymentState(openCharge);
                const cycleUsage = getCurrentCycleUsage(sub);

                return (
                  <TableRow key={sub.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border">
                          <AvatarFallback className="text-[10px] bg-primary/5 text-primary">
                            {sub.clients?.name?.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{sub.clients?.name}</span>
                          <span className="text-xs text-muted-foreground">{sub.clients?.whatsapp}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{plan?.name}</span>
                        <Badge variant="outline" className="mt-1 w-fit border-violet-100 bg-violet-50 px-1.5 text-[10px] text-violet-700">
                          {plan?.type === 'unlimited' ? 'Ilimitado' : `${plan?.usage_limit || 0} usos/mês`}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize text-[10px] font-normal">
                        {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {sub.start_date ? format(new Date(sub.start_date), 'dd/MM/yyyy') : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-xs">
                        <span>{format(dueDate, 'dd/MM/yyyy')}</span>
                        <span className={paymentState === 'overdue' ? 'font-semibold text-red-600' : 'font-semibold text-green-600'}>
                          {getDueLabel(sub, openCharge)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">R$ {planValue.toFixed(2)}</TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>{getPaymentBadge(openCharge)}</TableCell>
                    <TableCell>
                      <div className="text-xs">
                        {plan?.type === 'unlimited' ? (
                          <>
                            <span className="font-medium">Ilimitado</span>
                            <p className="text-muted-foreground">uso livre</p>
                          </>
                        ) : (
                          <>
                            <span className="font-medium">{cycleUsage.length} / {plan?.usage_limit || 0}</span>
                            <p className="text-muted-foreground">usos</p>
                          </>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onViewDetails(sub)} className="gap-2">
                            <Info className="h-4 w-4" /> Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onEditSubscriber(sub)} className="gap-2">
                            <Edit className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          {sub.status === 'active' ? (
                            <DropdownMenuItem onClick={() => updateStatus(sub.id, 'suspended')} className="gap-2">
                              <PauseCircle className="h-4 w-4" /> Suspender
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => updateStatus(sub.id, 'active')} className="gap-2 text-green-600">
                              <UserCheck className="h-4 w-4" /> Ativar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => updateStatus(sub.id, 'cancelled')} className="gap-2 text-destructive">
                            <UserX className="h-4 w-4" /> Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>Mostrando {filteredSubscribers.length} de {subscribers.length} resultados</span>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 w-8 p-0">1</Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">2</Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">3</Button>
        </div>
      </div>
    </div>
  );
}
