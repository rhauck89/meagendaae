import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
  const location = useLocation();
  const activeSection =
    location.pathname.endsWith('/plans') ? 'plans' :
    location.pathname.endsWith('/charges') ? 'charges' :
    'subscribers';

  const [isPlanDialogOpen, setIsPlanDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  const [isSubscriberDialogOpen, setIsSubscriberDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [detailSubscriber, setDetailSubscriber] = useState<any>(null);

  const { companyId, isOwner, roles } = useAuth();
  const canManagePlans = isOwner || roles.includes('super_admin');

  const sectionLabel =
    activeSection === 'plans' ? 'Planos' :
    activeSection === 'charges' ? 'Cobranças' :
    'Assinantes';

  const handleEditPlan = (plan: any) => {
    setSelectedPlan(plan);
    setIsPlanDialogOpen(true);
  };

  const handleNewPlan = () => {
    setSelectedPlan(null);
    setIsPlanDialogOpen(true);
  };

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

      setDetailSubscriber({ ...detailSubscriber, status });
      window.dispatchEvent(new CustomEvent('refresh-subscribers'));
      window.dispatchEvent(new CustomEvent('refresh-subscription-dashboard'));
    } catch (error: any) {
      toast.error('Erro ao atualizar status');
    }
  };

  return (
    <div className="min-h-full bg-slate-50/70">
      <div className="mx-auto max-w-[1440px] space-y-6 p-4 sm:p-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold tracking-tight">Assinaturas</h2>
            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Início</span>
              <span>›</span>
              <span>Assinaturas</span>
              <span>›</span>
              <span className="font-medium text-foreground">{sectionLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeSection === 'plans' && canManagePlans && (
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20" onClick={handleNewPlan}>
                <Plus className="h-4 w-4" /> Novo Plano
              </Button>
            )}
            {activeSection === 'subscribers' && (
              <Button className="gap-2 bg-violet-600 hover:bg-violet-700 shadow-lg shadow-violet-600/20" onClick={handleNewSubscription}>
                <Plus className="h-4 w-4" /> Novo Assinante
              </Button>
            )}
          </div>
        </div>

        {companyId && activeSection === 'subscribers' && (
          <SubscriptionsDashboard companyId={companyId} />
        )}

        {companyId && activeSection === 'subscribers' && (
          <SubscribersTab
            companyId={companyId}
            onEditSubscriber={handleEditSubscription}
            onViewDetails={handleViewDetails}
          />
        )}

        {companyId && activeSection === 'plans' && (
          <PlansTab
            companyId={companyId}
            onEditPlan={handleEditPlan}
            onNewPlan={handleNewPlan}
            canManage={canManagePlans}
          />
        )}

        {companyId && activeSection === 'charges' && <ChargesTab companyId={companyId} />}

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
    </div>
  );
};

export default Subscriptions;
