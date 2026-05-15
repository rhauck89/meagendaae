import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  MoreVertical,
  Plus,
  Settings,
  Users,
  CheckCircle2,
  XCircle,
  Scissors,
  Edit,
  Trash2,
  Power,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PlansTabProps {
  companyId: string;
  onEditPlan: (plan: any) => void;
  onNewPlan: () => void;
  canManage?: boolean;
}

export function PlansTab({ companyId, onEditPlan, onNewPlan, canManage = false }: PlansTabProps) {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<any>(null);

  useEffect(() => {
    if (companyId) {
      fetchPlans();
    }

    const handleRefresh = () => fetchPlans();
    window.addEventListener('refresh-subscription-plans', handleRefresh);
    return () => window.removeEventListener('refresh-subscription-plans', handleRefresh);
  }, [companyId]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select(`
          *,
          subscribers_count:client_subscriptions(count)
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast.error('Erro ao buscar planos');
    } finally {
      setLoading(false);
    }
  };

  const togglePlanStatus = async (plan: any) => {
    try {
      const { error } = await supabase
        .from('subscription_plans')
        .update({ is_active: !plan.is_active })
        .eq('id', plan.id);

      if (error) throw error;
      toast.success(`Plano ${plan.is_active ? 'desativado' : 'ativado'} com sucesso!`);
      fetchPlans();
    } catch (error: any) {
      console.error('Error toggling plan status:', error);
      toast.error('Erro ao alterar status do plano');
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;

    // Check if there are subscribers
    const subscribersCount = planToDelete.subscribers_count?.[0]?.count || 0;
    if (subscribersCount > 0) {
      toast.error('Não é possível excluir um plano com assinantes vinculados. Desative-o em vez disso.');
      setIsDeleteDialogOpen(false);
      return;
    }

    try {
      const { error } = await supabase
        .from('subscription_plans')
        .delete()
        .eq('id', planToDelete.id);

      if (error) throw error;
      toast.success('Plano excluído com sucesso!');
      fetchPlans();
    } catch (error: any) {
      console.error('Error deleting plan:', error);
      toast.error('Erro ao excluir plano');
    } finally {
      setIsDeleteDialogOpen(false);
      setPlanToDelete(null);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-[300px] bg-muted rounded-xl"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botão removido para evitar duplicidade com o cabeçalho */}

      {plans.length === 0 ? (
        <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-muted-foreground/20">
          <div className="flex flex-col items-center gap-2">
            <Settings className="h-10 w-10 text-muted-foreground/40" />
            <h3 className="text-lg font-medium mt-4">Nenhum plano cadastrado</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Crie planos de assinatura para fidelizar seus clientes e garantir uma receita recorrente.
            </p>
            <Button variant="outline" onClick={onNewPlan} className="mt-4">
              Criar meu primeiro plano
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const subscribersCount = plan.subscribers_count?.[0]?.count || 0;
            return (
              <Card key={plan.id} className={`overflow-hidden border-none shadow-sm hover:shadow-md transition-all duration-300 ${!plan.is_active ? 'opacity-70 bg-muted/50' : 'bg-background'}`}>
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant={plan.is_active ? "secondary" : "outline"} className={plan.is_active ? "bg-green-100 text-green-700 hover:bg-green-100 border-none" : ""}>
                      {plan.is_active ? (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      ) : (
                        <XCircle className="h-3 w-3 mr-1" />
                      )}
                      {plan.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onEditPlan(plan)} className="gap-2">
                            <Edit className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => togglePlanStatus(plan)} className="gap-2">
                            <Power className="h-4 w-4" /> {plan.is_active ? 'Desativar' : 'Ativar'}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => { setPlanToDelete(plan); setIsDeleteDialogOpen(true); }} 
                            className="gap-2 text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <CardTitle className="text-xl font-bold">{plan.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold text-primary">R$ {Number(plan.price_monthly).toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">/mês</span>
                  </div>
                  
                  {plan.price_yearly && (
                    <div className="text-sm text-muted-foreground bg-primary/5 p-2 rounded-lg">
                      Opção anual: <span className="font-semibold text-primary">R$ {Number(plan.price_yearly).toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-normal">
                      {plan.type === 'unlimited'
                        ? 'Ilimitado'
                        : `${plan.usage_count_mode === 'appointment' ? 'Por agendamento' : 'Por serviço'}: ${plan.usage_limit} uso(s) ${plan.limit_period === 'weekly' ? 'por semana' : 'por mês'}`}
                    </Badge>
                    {plan.quantity_available ? (
                      <Badge variant="outline" className="font-normal">
                        {plan.quantity_available} disponíveis
                      </Badge>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Scissors className="h-4 w-4" />
                      <span>{plan.included_services?.length || 0} serviços inclusos</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>{subscribersCount} assinantes vinculados</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Settings className="h-4 w-4" />
                      <span>
                        {plan.commission_timing === 'appointment_completion'
                          ? 'Comissão no atendimento'
                          : plan.commission_timing === 'plan_billing'
                            ? 'Comissão no faturamento'
                            : 'Sem comissão'}
                      </span>
                    </div>
                  </div>

                  {plan.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 italic">
                      "{plan.description}"
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Isso excluirá permanentemente o plano
              <strong> {planToDelete?.name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlan} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir Plano
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
