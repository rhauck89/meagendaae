import { useState, useEffect } from 'react';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  MoreVertical,
  Edit,
  UserX,
  UserCheck,
  PauseCircle,
  History,
  Info,
  ExternalLink,
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
          subscription_plans(id, name, price_monthly, price_yearly),
          professional:profiles(full_name),
          charges:subscription_charges(status, due_date)
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
        return <Badge variant="destructive" className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Em Atraso</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground animate-pulse">Carregando assinantes...</div>;
  }

  return (
    <div className="bg-background rounded-xl border border-muted shadow-sm overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="w-[250px]">Cliente</TableHead>
            <TableHead>Plano</TableHead>
            <TableHead>Profissional</TableHead>
            <TableHead>Recorrência</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Financeiro</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {subscribers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-20 text-muted-foreground">
                Nenhum assinante encontrado.
              </TableCell>
            </TableRow>
          ) : (
            subscribers.map((sub) => {
              const pendingCharge = sub.charges?.find((c: any) => c.status === 'pending' || c.status === 'overdue');
              return (
                <TableRow key={sub.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 border">
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
                      <span className="text-sm font-medium">{sub.subscription_plans?.name}</span>
                      <span className="text-xs text-muted-foreground">
                        R$ {Number(sub.billing_cycle === 'monthly' ? sub.subscription_plans?.price_monthly : sub.subscription_plans?.price_yearly).toFixed(2)}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{sub.professional?.full_name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px] font-normal">
                      {sub.billing_cycle === 'monthly' ? 'Mensal' : 'Anual'}
                    </Badge>
                  </TableCell>
                  <TableCell>{getStatusBadge(sub.status)}</TableCell>
                  <TableCell>
                    {pendingCharge ? (
                      <div className="flex flex-col">
                        <Badge variant="outline" className="w-fit text-[10px] border-red-100 text-red-600 bg-red-50">Pendência</Badge>
                        <span className="text-[10px] text-muted-foreground mt-1">
                          Venc: {format(new Date(pendingCharge.due_date), 'dd/MM', { locale: ptBR })}
                        </span>
                      </div>
                    ) : (
                      <Badge variant="outline" className="w-fit text-[10px] border-green-100 text-green-600 bg-green-50">Em dia</Badge>
                    )}
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
  );
}
