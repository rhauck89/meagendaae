import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Circle, Building2, Clock, Share2, Rocket, Users, Copy, MessageCircle, Scissors } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';

interface ChecklistStep {
  key: string;
  label: string;
  description?: string;
  icon: any;
  route: string;
  cta?: string;
  isShareStep?: boolean;
}

const adminSteps: ChecklistStep[] = [
  { key: 'company', label: 'Configure sua empresa', icon: Building2, route: '/dashboard/settings/company' },
  { key: 'services', label: 'Cadastre seus serviços', description: 'Crie os serviços que sua equipe poderá oferecer', icon: Scissors, route: '/dashboard/services' },
  { key: 'hours', label: 'Configure os horários', icon: Clock, route: '/dashboard/settings/schedule' },
  { key: 'team', label: 'Cadastre sua equipe', description: 'Adicione profissionais para começar a receber agendamentos', icon: Users, route: '/dashboard/team', cta: 'Adicionar profissional' },
  { key: 'share', label: 'Divulgue sua agenda', description: 'Copie e compartilhe o link da sua página de agendamento', icon: Share2, route: '/dashboard/settings/general', isShareStep: true },
];

const professionalSteps: ChecklistStep[] = [
  { key: 'schedule', label: 'Configure seus horários', icon: Clock, route: '/dashboard/services' },
  { key: 'share', label: 'Divulgue sua agenda', description: 'Compartilhe seu link de agendamento', icon: Share2, route: '/dashboard/profile', isShareStep: true },
];

const STORAGE_KEY = 'onboarding_checklist_completed';
const SHARED_LINK_KEY = 'onboarding_shared_link';

const OnboardingChecklist = () => {
  const { companyId, user } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const navigate = useNavigate();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  const [companySlug, setCompanySlug] = useState('');
  const [expandedShare, setExpandedShare] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  const steps = isAdmin ? adminSteps : professionalSteps;

  useEffect(() => {
    // 1. Fast check from localStorage
    const localHidden = localStorage.getItem(`${STORAGE_KEY}_hidden_${user?.id}`);
    const localCompleted = localStorage.getItem(`${STORAGE_KEY}_completed_${user?.id}`);
    
    if (localHidden === 'true' || localCompleted === 'true') {
      setDismissed(true);
      // We still want to load from DB in background to be sure
    }

    if (!companyId || !user?.id) return;
    loadOnboardingStatus();
  }, [companyId, isAdmin, profileId, user?.id]);

  const loadOnboardingStatus = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_hidden, onboarding_completed, onboarding_step')
        .eq('user_id', user?.id)
        .maybeSingle();

      if (profile) {
        if (profile.onboarding_hidden || profile.onboarding_completed) {
          setDismissed(true);
          setIsCompleted(profile.onboarding_completed);
          
          // Sync localStorage
          if (profile.onboarding_hidden) localStorage.setItem(`${STORAGE_KEY}_hidden_${user?.id}`, 'true');
          if (profile.onboarding_completed) localStorage.setItem(`${STORAGE_KEY}_completed_${user?.id}`, 'true');
        } else {
          // If DB says it's NOT hidden/completed, but local says it is, we trust DB as source of truth
          // but we might want to keep it hidden if local says so to avoid flickering.
          // However, the user wants "DEFEINITIVE" fix, so DB is master.
          setDismissed(false);
          localStorage.removeItem(`${STORAGE_KEY}_hidden_${user?.id}`);
        }
      }

      await checkProgress();
    } catch (error) {
      console.error('Error loading onboarding:', error);
      setLoading(false);
    }
  };

  const updateOnboardingDB = async (updates: { onboarding_hidden?: boolean; onboarding_completed?: boolean; onboarding_step?: number }) => {
    if (!user?.id) return;
    await supabase
      .from('profiles')
      .update(updates)
      .eq('user_id', user.id);
    
    if (updates.onboarding_hidden) localStorage.setItem(`${STORAGE_KEY}_hidden_${user?.id}`, 'true');
    if (updates.onboarding_completed) localStorage.setItem(`${STORAGE_KEY}_completed_${user?.id}`, 'true');
  };

  const checkProgress = async () => {
    if (!companyId) return;
    const completed = new Set<string>();

    // Fetch company slug
    const { data: company } = await supabase
      .from('companies')
      .select('phone, address, whatsapp, slug')
      .eq('id', companyId)
      .single();

    if (company?.slug) setCompanySlug(company.slug);

    if (isAdmin) {
      if (company && (company.phone || company.address || company.whatsapp)) {
        completed.add('company');
      }

      const { count: hoursCount } = await supabase
        .from('business_hours')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (hoursCount && hoursCount > 0) completed.add('hours');

      const { count: servicesCount } = await supabase
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('active', true);
      if (servicesCount && servicesCount > 0) completed.add('services');

      const { count: collabCount } = await supabase
        .from('collaborators')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId);
      if (collabCount && collabCount > 0) completed.add('team');

      if (localStorage.getItem(SHARED_LINK_KEY) === 'true') {
        completed.add('share');
      }
    } else {
      if (profileId) {
        const { count: hoursCount } = await supabase
          .from('professional_working_hours')
          .select('id', { count: 'exact', head: true })
          .eq('professional_id', profileId)
          .eq('company_id', companyId);
        if (hoursCount && hoursCount > 0) completed.add('schedule');

        if (localStorage.getItem(SHARED_LINK_KEY) === 'true') {
          completed.add('share');
        }
      }
    }

    setCompletedSteps(completed);

    const allDone = steps.every(s => completed.has(s.key));
    if (allDone && !isCompleted) {
      handleAllDone();
    }

    setLoading(false);
  };

  const handleAllDone = async () => {
    setIsCompleted(true);
    setShowCelebration(true);
    await updateOnboardingDB({ onboarding_completed: true, onboarding_step: steps.length });
    
    // Auto close after 5 seconds as requested
    setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => setDismissed(true), 300);
    }, 5000);
  };

  const markShareCompleted = () => {
    localStorage.setItem(SHARED_LINK_KEY, 'true');
    setCompletedSteps(prev => {
      const next = new Set([...prev, 'share']);
      if (steps.every(s => next.has(s.key))) {
        handleAllDone();
      }
      return next;
    });
    toast.success('Link copiado! Agora é só divulgar para seus clientes 🚀');
  };

  const getBookingUrl = () => {
    return `${window.location.origin}/barbearia/${companySlug}`;
  };

  const handleCopyLink = () => {
    const url = getBookingUrl();
    navigator.clipboard.writeText(url);
    markShareCompleted();
  };

  const handleShareWhatsApp = () => {
    const url = getBookingUrl();
    const message = `Agende seu horário comigo: ${url}`;
    const shareUrl = buildWhatsAppUrl('', message);
    trackWhatsAppClick('onboarding');
    const win = window.open(shareUrl, '_blank', 'noopener,noreferrer');
    if (!win) window.location.href = shareUrl;
    markShareCompleted();
  };

  const handleHide = async () => {
    setFadingOut(true);
    await updateOnboardingDB({ onboarding_hidden: true });
    setTimeout(() => setDismissed(true), 300);
  };

  if (loading || (dismissed && !fadingOut)) return null;

  if (showCelebration) {
    return (
      <Card className="border-primary/20 bg-primary/[0.02] animate-fade-in">
        <CardContent className="p-6 text-center space-y-2">
          <Rocket className="h-8 w-8 text-primary mx-auto mb-2 animate-bounce" />
          <h3 className="font-bold text-lg text-primary">🎉 Sua agenda está pronta!</h3>
          <p className="text-sm text-muted-foreground">Você concluiu todos os passos iniciais. Boas vendas!</p>
        </CardContent>
      </Card>
    );
  }

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
              onClick={handleHide}

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
              <div key={step.key}>
                <button
                  onClick={() => {
                    if (done) return;
                    if (step.isShareStep && companySlug) {
                      setExpandedShare(!expandedShare);
                    } else {
                      navigate(step.route);
                    }
                  }}
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
                  <div className="flex flex-col">
                    <span className={cn(done && 'line-through')}>{step.label}</span>
                    {!done && step.description && (
                      <span className="text-xs text-muted-foreground">{step.description}</span>
                    )}
                  </div>
                </button>

                {/* Inline share panel */}
                {step.isShareStep && expandedShare && !done && companySlug && (
                  <div className="ml-11 mt-1 mb-2 p-3 rounded-lg bg-muted/50 space-y-2 animate-fade-in">
                    <input
                      readOnly
                      value={getBookingUrl()}
                      onCopy={markShareCompleted}
                      onFocus={markShareCompleted}
                      className="w-full text-xs bg-background border rounded px-2 py-1.5 select-all"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="default" className="gap-1.5 text-xs h-8" onClick={handleCopyLink}>
                        <Copy className="h-3.5 w-3.5" />
                        Copiar link
                      </Button>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={handleShareWhatsApp}>
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
  localStorage.removeItem(SHARED_LINK_KEY);
};
