import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCompanyPlan } from '@/hooks/useCompanyPlan';

type PlanFeatureKey =
  | 'automatic_messages'
  | 'open_scheduling'
  | 'promotions'
  | 'discount_coupons'
  | 'whitelabel'
  | 'feature_requests'
  | 'custom_branding'
  | 'loyalty'
  | 'cashback'
  | 'advanced_reports';

interface PlanFeatureGateProps {
  feature: PlanFeatureKey;
  children: ReactNode;
  /** What to render when the plan doesn't include the feature. If omitted, renders nothing. */
  fallback?: ReactNode;
  /** Convenience: render an inline upgrade prompt instead of children */
  upgradePrompt?: { title?: string; description?: string };
}

/**
 * Gates UI behind a plan feature flag. Trial users always get access (handled by useCompanyPlan).
 * Reuse for cashback, points, agenda aberta, equipe, etc.
 */
export const PlanFeatureGate = ({ feature, children, fallback, upgradePrompt }: PlanFeatureGateProps) => {
  const { isFeatureEnabled, loading } = useCompanyPlan();
  if (loading) return null;
  if (isFeatureEnabled(feature)) return <>{children}</>;
  if (upgradePrompt) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Lock className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">{upgradePrompt.title ?? 'Recurso disponível em planos superiores'}</p>
          {upgradePrompt.description && (
            <p className="text-xs text-muted-foreground">{upgradePrompt.description}</p>
          )}
          <Button asChild size="sm" variant="default">
            <Link to="/settings/plan">
              <Sparkles className="h-3.5 w-3.5 mr-1" /> Fazer upgrade
            </Link>
          </Button>
        </div>
      </div>
    );
  }
  return <>{fallback ?? null}</>;
};

export default PlanFeatureGate;
