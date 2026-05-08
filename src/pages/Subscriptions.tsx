import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Users, CreditCard, LayoutDashboard, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PlansTab } from '@/components/subscriptions/PlansTab';
import { PlanDialog } from '@/components/subscriptions/PlanDialog';
import { SubscribersTab } from '@/components/subscriptions/SubscribersTab';
import { SubscriberDialog } from '@/components/subscriptions/SubscriberDialog';
import { SubscriberDetailsDrawer } from '@/components/subscriptions/SubscriberDetailsDrawer';
import { ChargesTab } from '@/components/subscriptions/ChargesTab';
import { SubscriptionsDashboard } from '@/components/subscriptions/SubscriptionsDashboard';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Subscriptions = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // Plan State
  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  
  // Subscriber State
  const [isSubscriberDialogOpen, setIsSubscriberDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailSubscriber, setDetailSubscriber] = useState<any>(null);

  const { companyId, isOwner, roles } = useAuth();
  const canManagePlans = isOwner || roles.includes('super_admin');

  // Plan Handlers
  const handleEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsPlanDialogOpen(true);
  };

  const handleNewPlan = () => {
    setSelectedPlan(null);
    setIsPlanDialogOpen(true);
  };

  // Subscriber Handlers
  const handleEditSubscription = (sub: any) => {
    setSelectedSubscription(sub);
    setIsSubscriberDialogOpen(true);
  };

  const handleNewSubscription = () => {
    setSelectedSubscription(null);
    setIsSubscriberDialogOpen(true);
  };

  const handleViewDetails = (sub: any) => {
    setDetailSubscriber(sub);
    setIsDetailsOpen(true);
  };

  const handleStatusUpdate = async (status: string) => {
    if (!detailSubscriber) return;
    try {
      const { error } = await supabase
        .from('client_subscriptions')
        .update({ status })
        .eq('id', detailSubscriber.id);

      if (error) throw error;
      toast.success(`Status atualizado para ${status}`);
      
      // Refresh details
      setDetailSubscriber({ ...detailSubscriber, status });
      // Refresh list
      window.dispatchEvent(new CustomEvent('refresh-subscribers'));
      window.dispatchEvent(new CustomEvent('refresh-subscription-dashboard'));
    } catch (error: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight">Assinaturas</h2>
          <p className="text-muted-foreground">Gerencie seus planos e clientes recorrentes.</p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'plans' ? (
            canManagePlans && (
              <Button className="gap-2" onClick={handleNewPlan}>
                <Plus className="h-4 w-4" /> Novo Plano
              </Button>
            )
          ) : (
            <Button className="gap-2" onClick={handleNewSubscription}>
              <Plus className="h-4 w-4" /> Novo Assinante
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid grid-cols-4 w-full md:w-[600px] h-12 p-1 bg-muted/50">
          <TabsTrigger value="dashboard" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4" /> Planos
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" /> Assinantes
          </TabsTrigger>
          <TabsTrigger value="charges" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" /> Cobranças
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          {companyId && <SubscriptionsDashboard companyId={companyId} />}
        </TabsContent>

        <TabsContent value="plans" className="focus-visible:outline-none">
          {companyId && (
            <PlansTab 
              companyId={companyId} 
              onEditPlan={handleEditPlan} 
              onNewPlan={handleNewPlan}
              canManage={canManagePlans}
            />
          )}
        </TabsContent>

        <TabsContent value="subscribers" className="focus-visible:outline-none">
          {companyId && (
            <SubscribersTab 
              companyId={companyId} 
              onEditSubscriber={handleEditSubscription}
              onViewDetails={handleViewDetails}
            />
          )}
        </TabsContent>

        <TabsContent value="charges" className="focus-visible:outline-none">
          {companyId && <ChargesTab companyId={companyId} />}
        </TabsContent>
      </Tabs>

      {companyId && (
        <>
          <PlanDialog
            open={isPlanDialogOpen}
            onOpenChange={setIsPlanDialogOpen}
            companyId={companyId}
            plan={selectedPlan}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent('refresh-subscription-plans'));
              window.dispatchEvent(new CustomEvent('refresh-subscription-dashboard'));
            }}
          />
          <SubscriberDialog
            open={isSubscriberDialogOpen}
            onOpenChange={setIsSubscriberDialogOpen}
            companyId={companyId}
            subscription={selectedSubscription}
            onSuccess={() => {
              window.dispatchEvent(new CustomEvent('refresh-subscribers'));
              window.dispatchEvent(new CustomEvent('refresh-subscription-dashboard'));
            }}
          />
          <SubscriberDetailsDrawer
            open={isDetailsOpen}
            onOpenChange={setIsDetailsOpen}
            subscriber={detailSubscriber}
            onStatusUpdate={handleStatusUpdate}
            onEdit={() => {
              setIsDetailsOpen(false);
              handleEditSubscription(detailSubscriber);
            }}
          />
        </>
      )}
    </div>
  );
};

export default Subscriptions;