import { useCompanyPlan } from '@/hooks/useCompanyPlan';
import { AlertTriangle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const TrialBanner = () => {
  const { trialActive, trialExpired, trialDaysLeft, loading } = useCompanyPlan();
  const navigate = useNavigate();

  if (loading) return null;

  if (trialExpired) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-destructive">Seu período de teste expirou</p>
          <p className="text-sm text-muted-foreground">Escolha um plano para continuar usando todos os recursos.</p>
        </div>
        <Button size="sm" onClick={() => navigate('/settings/plans')}>
          Escolher plano
        </Button>
      </div>
    );
  }

  if (trialActive && trialDaysLeft <= 3) {
    return (
      <div className="bg-warning/10 border border-warning/20 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <Clock className="h-5 w-5 text-warning shrink-0" />
        <div className="flex-1">
          <p className="font-semibold text-warning">Trial expira em {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''}</p>
          <p className="text-sm text-muted-foreground">Assine agora para não perder acesso aos recursos.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate('/settings/plans')}>
          Ver planos
        </Button>
      </div>
    );
  }

  return null;
};

export default TrialBanner;
