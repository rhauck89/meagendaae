import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, Circle, Building2, Clock, Share2, Rocket } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface ChecklistStep {
  key: string;
  label: string;
  icon: any;
  route: string;
}

const adminSteps: ChecklistStep[] = [
  { key: 'company', label: 'Configure sua empresa', icon: Building2, route: '/dashboard/settings/company' },
  { key: 'hours', label: 'Configure os horários', icon: Clock, route: '/dashboard/settings/schedule' },
  { key: 'share', label: 'Ative sua página pública', icon: Share2, route: '/dashboard/settings/general' },
];

const professionalSteps: ChecklistStep[] = [
  { key: 'schedule', label: 'Configure seus horários', icon: Clock, route: '/dashboard/services' },
  { key: 'appointment', label: 'Realize seu primeiro atendimento', icon: Share2, route: '/dashboard' },
  { key: 'share', label: 'Compartilhe seu link de agendamento', icon: Share2, route: '/dashboard/profile' },
];

const STORAGE_KEY = 'onboarding_checklist_completed';

const OnboardingChecklist = () => {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  const steps = isAdmin ? adminSteps : professionalSteps;

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setDismissed(true);
      setLoading(false);
      return;
    }
    if (!companyId) return;
    checkProgress();
  }, [companyId, isAdmin, profileId]);

  const checkProgress = async () => {
    if (!companyId) return;
    const completed = new Set<string>();

    if (isAdmin) {
      const { data: company } = await supabase
        .from('companies')
        .select('phone, address, whatsapp')
        .eq('id', companyId)
        .single();
      if (company && (company.phone || company.address || company.whatsapp)) {
        completed.add('company');
      }

      const { count: hoursCount } = await supabase
        .from('business_hours')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (hoursCount && hoursCount > 0) completed.add('hours');

      const { count: collabCount } = await supabase
        .from('collaborators')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (collabCount && collabCount > 0) completed.add('share');
    } else {
      if (profileId) {
        const { count: hoursCount } = await supabase
          .from('professional_working_hours')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', profileId)
          .eq('company_id', companyId);
        if (hoursCount && hoursCount > 0) completed.add('schedule');

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

    const allDone = steps.every(s => completed.has(s.key));
    if (allDone) {
      localStorage.setItem(STORAGE_KEY, 'true');
      setFadingOut(true);
      setTimeout(() => setDismissed(true), 300);
    }

    setLoading(false);
  };

  if (loading || dismissed) return null;

  const completedCount = steps.filter(s => completedSteps.has(s.key)).length;
  const totalSteps = steps.length;
  const percent = Math.round((completedCount / totalSteps) * 100);

  return (
    <Card className={cn(
      'border-primary/20 bg-primary/[0.02] transition-opacity duration-300',
      fadingOut ? 'opacity-0' : 'opacity-100 animate-fade-in'
    )}>
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-sm">Primeiros passos</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{completedCount}/{totalSteps}</span>
            <button
              onClick={() => {
                setFadingOut(true);
                setTimeout(() => setDismissed(true), 300);
              }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Ocultar
            </button>
          </div>
        </div>

        <Progress value={percent} className="h-1.5 mb-4" />

        <div className="space-y-1.5">
          {steps.map((step) => {
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

export const resetOnboardingChecklist = () => {
  localStorage.removeItem(STORAGE_KEY);
};
