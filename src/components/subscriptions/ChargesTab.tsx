import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { format, isToday, isThisWeek, isPast, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MoreVertical,
  CheckCircle,
  Clock,
  Filter,
  Search,
  DollarSign,
  User,
  CreditCard,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface ChargesTabProps {
  companyId: string;
}

export function ChargesTab({ companyId }: ChargesTabProps) {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterVencimento, setFilterVencimento] = useState('all');

  useEffect(() => {
    if (companyId) {
      fetchCharges();
    }
    
    const handleRefresh = () => fetchCharges();
    window.addEventListener('refresh-charges', handleRefresh);
    return () => window.removeEventListener('refresh-charges', handleRefresh);
  }, [companyId]);

  const fetchCharges = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_charges')
        .select(`
          *,
          subscription:client_subscriptions(
            id,
            professional_commission,
            clients(name, whatsapp),
            subscription_plans(name),
            professional:profiles(full_name)
          )
        `)
        .eq('company_id', companyId)
        .order('due_date', { ascending: false });

      if (error) throw error;
      setCharges(data || []);
    } catch (error: any) {
      console.error('Error fetching charges:', error);
      toast.error('Erro ao buscar cobranças');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsPaid = async (charge: any) => {
    if (charge.status === 'paid') return;

    try {
      const amount = Number(charge.amount);
      const commissionPercent = Number(charge.subscription?.professional_commission || 0);
      const professionalId = charge.subscription?.professional_id;
      
      const commissionAmount = (amount * commissionPercent) / 100;
      // const netAmount = amount - commissionAmount; // Not stored, but used for display

      // 1. Update charge status
      const { error: chargeError } = await supabase
        .from('subscription_charges')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          payment_method: 'pix' // Default for now
        })
        .eq('id', charge.id);

      if (chargeError) throw chargeError;

      // 2. Create revenue in finance
      // First, get or create the 'Assinatura' category
      let { data: category } = await supabase
        .from('company_revenue_categories')
        .select('id')
        .eq('company_id', companyId)
        .eq('name', 'Assinatura')
        .maybeSingle();

      if (!category) {
        const { data: newCat } = await supabase
          .from('company_revenue_categories')
          .insert({ company_id: companyId, name: 'Assinatura' })
          .select()
          .single();
        category = newCat;
      }

      const { error: revenueError } = await supabase
        .from('company_revenues')
        .insert({
          company_id: companyId,
          amount: amount,
          description: `Assinatura: ${charge.subscription?.clients?.name} - ${charge.subscription?.subscription_plans?.name}`,
          revenue_date: format(new Date(), 'yyyy-MM-dd'),
          status: 'received',
          category_id: category?.id,
          payment_method: 'pix',
          client_name: charge.subscription?.clients?.name,
          professional_id: professionalId,
          professional_name: charge.subscription?.professional?.full_name,
          service_name: 'Assinatura',
          notes: `Cobrança Ref: ${charge.id}`
        });

      if (revenueError) throw revenueError;
      
      // 3. Register loyalty points and cashback if applicable
      try {
        const client_id = charge.subscription?.client_id;
        const sub_amount = Number(charge.amount);
        
        // A. Points
        const { data: loyaltyConfig } = await supabase
          .from('loyalty_config')
          .select('*')
          .eq('company_id', companyId)
          .eq('enabled', true)
          .maybeSingle();

        if (loyaltyConfig && client_id) {
          let pointsToAdd = 0;
          if (loyaltyConfig.scoring_type === 'per_value') {
            pointsToAdd = Math.floor(sub_amount * (loyaltyConfig.points_per_currency || 0));
          } else {
            pointsToAdd = loyaltyConfig.points_per_service || 0;
          }

          if (pointsToAdd > 0) {
            await supabase.from('loyalty_points_transactions').insert({
              company_id: companyId,
              client_id: client_id,
              points: pointsToAdd,
              transaction_type: 'earn',
              description: `Pagamento de assinatura - ${charge.subscription?.subscription_plans?.name}`,
              metadata: { subscription_charge_id: charge.id }
            });
            console.log('[SUBSCRIPTION_PAYMENT] Loyalty points added:', pointsToAdd);
          }
        }

        // B. Cashback
        const today = format(new Date(), 'yyyy-MM-dd');
        const { data: cashbackPromos } = await supabase
          .from('promotions')
          .select('*')
          .eq('company_id', companyId)
          .eq('promotion_type', 'cashback')
          .eq('status', 'active')
          .lte('start_date', today)
          .gte('end_date', today);

        if (cashbackPromos && cashbackPromos.length > 0 && client_id) {
          // Use the best cashback promo (highest percentage or fixed)
          let bestCashbackAmount = 0;
          let selectedPromo = null;

          for (const promo of cashbackPromos) {
            let currentAmount = 0;
            if (promo.discount_type === 'percentage') {
              currentAmount = (sub_amount * Number(promo.discount_value)) / 100;
            } else if (promo.discount_type === 'fixed_amount') {
              currentAmount = Number(promo.discount_value);
            }
            if (currentAmount > bestCashbackAmount) {
              bestCashbackAmount = currentAmount;
              selectedPromo = promo;
            }
          }

          if (bestCashbackAmount > 0) {
            await supabase.from('cashback_transactions').insert({
              company_id: companyId,
              client_id: client_id,
              amount: bestCashbackAmount,
              transaction_type: 'earn',
              description: `Pagamento de assinatura - ${charge.subscription?.subscription_plans?.name}`,
              expires_at: selectedPromo?.cashback_validity_days 
                ? format(new Date(Date.now() + selectedPromo.cashback_validity_days * 24 * 60 * 60 * 1000), 'yyyy-MM-dd')
                : null,
              metadata: { 
                subscription_charge_id: charge.id,
                promotion_id: selectedPromo?.id 
              }
            });
            console.log('[SUBSCRIPTION_PAYMENT] Cashback added:', bestCashbackAmount);
          }
        }
      } catch (benefitError) {
        console.error('[SUBSCRIPTION_PAYMENT] Error generating benefits:', benefitError);
        // Non-blocking: continue even if loyalty fails
      }

      // 4. Register commission if applicable (Phase 1 simplicity: using the finance display logic)

      toast.success('Cobrança marcada como paga e integrada ao financeiro!');
      fetchCharges();
      // Refresh dashboard
      window.dispatchEvent(new CustomEvent('refresh-subscription-dashboard'));
    } catch (error: any) {
      console.error('Error paying charge:', error);
      toast.error('Erro ao processar pagamento');
    }
  };

  const filteredCharges = charges.filter(charge => {
    const matchesStatus = filterStatus === 'all' || charge.status === filterStatus;
    const matchesSearch = !searchTerm || 
      charge.subscription?.clients?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      charge.subscription?.subscription_plans?.name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesVencimento = true;
    const dueDate = parseISO(charge.due_date);
    if (filterVencimento === 'today') matchesVencimento = isToday(dueDate);
    else if (filterVencimento === 'week') matchesVencimento = isThisWeek(dueDate);
    else if (filterVencimento === 'overdue') matchesVencimento = isPast(dueDate) && charge.status !== 'paid' && !isToday(dueDate);

    return matchesStatus && matchesSearch && matchesVencimento;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Pago</Badge>;
      case 'pending':
        return <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">Pendente</Badge>;
      case 'overdue':
        return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Atrasado</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">Cancelado</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (loading && charges.length === 0) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando cobranças...</div>;
  }

  return (
    <div className="space-y-4">
      <Card className="border-none shadow-sm bg-muted/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente ou plano..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
                <SelectItem value="overdue">Atrasados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterVencimento} onValueChange={setFilterVencimento}>
              <SelectTrigger>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Vencimento" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer data</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="week">Esta semana</SelectItem>
                <SelectItem value="overdue">Atrasadas</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchCharges} className="gap-2">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="bg-background rounded-xl border border-muted shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 text-[11px] uppercase tracking-wider">
              <TableHead>Cliente / Plano</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Financeiro (Líquido)</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCharges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                  Nenhuma cobrança encontrada com os filtros selecionados.
                </TableCell>
              </TableRow>
            ) : (
              filteredCharges.map((charge) => {
                const amount = Number(charge.amount);
                const commission = (amount * Number(charge.subscription?.professional_commission || 0)) / 100;
                const net = amount - commission;

                return (
                  <TableRow key={charge.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium text-sm">{charge.subscription?.clients?.name}</span>
                        <span className="text-[10px] text-muted-foreground">{charge.subscription?.subscription_plans?.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{charge.subscription?.professional?.full_name || '-'}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="text-sm">{format(parseISO(charge.due_date), 'dd/MM/yyyy')}</span>
                        {charge.paid_at && (
                          <span className="text-[10px] text-green-600">Pago em: {format(parseISO(charge.paid_at), 'dd/MM')}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-sm">R$ {amount.toFixed(2)}</span>
                    </TableCell>
                    <TableCell>{getStatusBadge(charge.status)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <DollarSign className="h-3 w-3" /> Emp: R$ {net.toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <User className="h-3 w-3" /> Prof: R$ {commission.toFixed(2)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {charge.status !== 'paid' ? (
                        <Button 
                          size="sm" 
                          variant="default" 
                          className="h-8 gap-2 bg-green-600 hover:bg-green-700"
                          onClick={() => handleMarkAsPaid(charge)}
                        >
                          <CheckCircle className="h-4 w-4" /> Pago
                        </Button>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem className="gap-2">
                              <CreditCard className="h-4 w-4" /> Ver Comprovante
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
