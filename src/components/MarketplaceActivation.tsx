import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { CheckCircle2, Circle, Building2, Scissors, Clock, Users, Globe, Store, PartyPopper, Share2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ActivationStep {
  key: string;
  label: string;
  icon: any;
  route: string;
  requiresTeam?: boolean;
}

const activationSteps: ActivationStep[] = [
  { key: 'company', label: 'Configure sua empresa', icon: Building2, route: '/dashboard/settings/company' },
  { key: 'service', label: 'Crie seu primeiro serviço', icon: Scissors, route: '/dashboard/services' },
  { key: 'team', label: 'Adicione um profissional', icon: Users, route: '/dashboard/team', requiresTeam: true },
  { key: 'schedule', label: 'Configure horários de atendimento', icon: Clock, route: '/dashboard/settings/schedule' },
  { key: 'public_page', label: 'Ative sua página pública', icon: Globe, route: '/dashboard/settings/general' },
];

const MarketplaceActivation = () => {
  const { companyId } = useAuth();
  const plan = useCompanyPlan();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [companySlug, setCompanySlug] = useState('');
  const [alreadyActivated, setAlreadyActivated] = useState(false);

  const supportsTeam = plan.features.members_limit > 1 || plan.trialActive;
  const activeSteps = activationSteps.filter(s => !s.requiresTeam || supportsTeam);

  const checkProgress = useCallback(async () => {
    if (!companyId) return;
    const completed = new Set<string>();

    // Fetch company info
    const { data: company } = await supabase
      .from('companies')
      .select('phone, address, whatsapp, slug, marketplace_active, activation_score')
      .eq('id', companyId)
      .single();

    if (!company) { setLoading(false); return; }

    setCompanySlug(company.slug);

    if (company.marketplace_active) {
      setAlreadyActivated(true);
      setLoading(false);
      return;
    }

    // Check company configured (has phone/address/whatsapp)
    if (company.phone || company.address || company.whatsapp) {
      completed.add('company');
    }

    // Check has services
    const { count: serviceCount } = await supabase
      .from('services')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    if (serviceCount && serviceCount > 0) completed.add('service');

    // Check has team members
    const { count: collabCount } = await supabase
      .from('collaborators')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId);
    if (collabCount && collabCount > 0) completed.add('team');

    // Check schedule configured (business hours)
    const { count: hoursCount } = await supabase
      .from('business_hours')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .eq('is_closed', false);
    if (hoursCount && hoursCount > 0) completed.add('schedule');

    // Public page is considered active if they have a slug and services
    if (completed.has('service') && company.slug) {
      completed.add('public_page');
    }

    setCompletedSteps(completed);

    // Calculate score
    const totalSteps = activeSteps.length;
    const completedCount = activeSteps.filter(s => completed.has(s.key)).length;
    const score = Math.round((completedCount / totalSteps) * 100);

    // Update activation score in DB
    const updates: any = { activation_score: score };
    if (score >= 80 && !company.marketplace_active) {
      updates.marketplace_active = true;
      updates.activated_at = new Date().toISOString();
    }

    await supabase.from('companies').update(updates).eq('id', companyId);

    // Show reward modal when reaching 100%
    if (score >= 80 && !company.marketplace_active) {
      setShowRewardModal(true);
    }

    setLoading(false);
  }, [companyId, activeSteps]);

  useEffect(() => {
    if (!companyId || plan.loading) return;
    checkProgress();
  }, [companyId, plan.loading]);

  const handleShareLink = () => {
    const url = `${window.location.origin}/barbearia/${companySlug}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  if (loading || dismissed || alreadyActivated) return null;

  const completedCount = activeSteps.filter(s => completedSteps.has(s.key)).length;
  const totalSteps = activeSteps.length;
  const percent = Math.round((completedCount / totalSteps) * 100);

  if (percent >= 80) return null;

  return (
    <>
      <Card className="border-accent/20 bg-accent/[0.02] animate-fade-in">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Store className="h-5 w-5 text-accent" />
              <h3 className="font-semibold text-sm">Ative seu perfil no Marketplace</h3>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">{percent}%</span>
              <button
                onClick={() => setDismissed(true)}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                Ocultar
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mb-3">
            Complete os passos abaixo para que sua empresa apareça no marketplace do Me Agenda Aê.
          </p>

          <Progress value={percent} className="h-1.5 mb-4" />

          <div className="space-y-1.5">
            {activeSteps.map((step) => {
              const done = completedSteps.has(step.key);
              return (
                <button
                  key={step.key}
                  onClick={() => !done && navigate(step.route)}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors text-left',
                    done
                      ? 'text-muted-foreground'
                      : 'hover:bg-muted cursor-pointer text-foreground'
                  )}
                  disabled={done}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  )}
                  <step.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className={cn(done && 'line-through')}>{step.label}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Activation Reward Modal */}
      <Dialog open={showRewardModal} onOpenChange={setShowRewardModal}>
        <DialogContent className="sm:max-w-md text-center">
          <DialogHeader className="items-center">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-2">
              <PartyPopper className="h-8 w-8 text-success" />
            </div>
            <DialogTitle className="text-xl">🎉 Parabéns!</DialogTitle>
            <DialogDescription className="text-base">
              Seu perfil agora está ativo no marketplace do Me Agenda Aê.
              Agora clientes podem encontrar sua empresa e fazer agendamentos online.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={() => {
                setShowRewardModal(false);
                navigate(`/barbearia/${companySlug}`);
              }}
              className="gap-2"
            >
              <ExternalLink className="h-4 w-4" />
              Ver meu perfil
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                handleShareLink();
                setShowRewardModal(false);
              }}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" />
              Compartilhar link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default MarketplaceActivation;
