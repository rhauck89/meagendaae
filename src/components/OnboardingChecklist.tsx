import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Building2, Scissors, Calendar, Share2, Users, Rocket, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ChecklistStep {
  key: string;
  label: string;
  icon: any;
  route: string;
  requiresTeam?: boolean;
  adminOnly?: boolean;
  professionalOnly?: boolean;
}

const adminSteps: ChecklistStep[] = [
  { key: 'company', label: 'Configure sua empresa', icon: Building2, route: '/dashboard/settings/company', adminOnly: true },
  { key: 'service', label: 'Crie seu primeiro serviço', icon: Scissors, route: '/dashboard/services' },
  { key: 'appointment', label: 'Faça seu primeiro agendamento', icon: Calendar, route: '/dashboard' },
  { key: 'share', label: 'Compartilhe seu link de agendamento', icon: Share2, route: '/dashboard/settings/general' },
  { key: 'team', label: 'Adicione um profissional', icon: Users, route: '/dashboard/team', requiresTeam: true, adminOnly: true },
];

const professionalSteps: ChecklistStep[] = [
  { key: 'schedule', label: 'Configure seus horários', icon: Clock, route: '/dashboard/services', professionalOnly: true },
  { key: 'appointment', label: 'Realize seu primeiro atendimento', icon: Calendar, route: '/dashboard', professionalOnly: true },
  { key: 'share', label: 'Compartilhe seu link de agendamento', icon: Share2, route: '/dashboard/profile', professionalOnly: true },
];

const OnboardingChecklist = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const plan = useCompanyPlan();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  const supportsTeam = plan.features.members_limit > 1 || plan.trialActive;

  const steps = isAdmin ? adminSteps : professionalSteps;
  const activeSteps = steps.filter(s => !s.requiresTeam || supportsTeam);

  useEffect(() => {
    if (!companyId) return;
    checkProgress();
  }, [companyId, isAdmin, profileId]);

  const checkProgress = async () => {
    if (!companyId) return;
    const completed = new Set<string>();

    if (isAdmin) {
      // Admin checks
      const { data: company } = await supabase
        .from('companies')
        .select('phone, address, whatsapp')
        .eq('id', companyId)
        .single();
      if (company && (company.phone || company.address || company.whatsapp)) {
        completed.add('company');
      }

      const { count: serviceCount } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (serviceCount && serviceCount > 0) completed.add('service');

      const { count: apptCount } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (apptCount && apptCount > 0) completed.add('appointment');

      const { count: collabCount } = await supabase
        .from('collaborators')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (collabCount && collabCount > 1) completed.add('team');

      if (completed.has('appointment')) completed.add('share');
    } else {
      // Professional checks
      if (profileId) {
        // Check if has working hours configured
        const { count: hoursCount } = await supabase
          .from('professional_working_hours')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', profileId)
          .eq('company_id', companyId);
        if (hoursCount && hoursCount > 0) completed.add('schedule');

        // Check if has appointments
        const { count: apptCount } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', profileId)
          .eq('company_id', companyId);
        if (apptCount && apptCount > 0) completed.add('appointment');

        if (completed.has('appointment')) completed.add('share');
      }
    }

    setCompletedSteps(completed);
    setLoading(false);
  };

  if (loading || dismissed) return null;

  const completedCount = activeSteps.filter(s => completedSteps.has(s.key)).length;
  const totalSteps = activeSteps.length;
  const percent = Math.round((completedCount / totalSteps) * 100);

  if (completedCount >= totalSteps) return null;

  return (
    <Card className="border-primary/20 bg-primary/[0.02] animate-fade-in">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Primeiros passos</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{completedCount}/{totalSteps}</span>
            <button
              onClick={() => setDismissed(true)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ocultar
            </button>
          </div>
        </div>

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
  );
};

export default OnboardingChecklist;
