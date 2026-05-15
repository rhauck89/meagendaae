import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Crown, Loader2, Megaphone, Rocket, Sparkles, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type MarketplaceModule = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  stripe_monthly_price_id: string | null;
};

type CompanyModule = {
  module_id: string;
  status: string;
};

const marketplaceSlugs = ['marketplace-featured-medium', 'marketplace-featured-max'];

const offerStorageKey = (companyId: string | null, userId: string | undefined) =>
  `marketplace-upgrade-offer:${companyId || 'no-company'}:${userId || 'no-user'}`;

const formatBRL = (value: number) => `R$ ${Number(value || 0).toFixed(2).replace('.', ',')}`;

export const MarketplaceUpgradeOffer = ({ mode = 'popup' }: { mode?: 'popup' | 'card' }) => {
  const { companyId, user, isOwner, isAdmin } = useAuth();
  const [modules, setModules] = useState<MarketplaceModule[]>([]);
  const [companyModules, setCompanyModules] = useState<CompanyModule[]>([]);
  const [hasManualMarketplaceHighlight, setHasManualMarketplaceHighlight] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const canSeeOffer = Boolean(companyId && user && (isOwner || isAdmin));

  const requestedModuleIds = useMemo(
    () => new Set(companyModules
      .filter((module) => ['active', 'pending', 'pending_checkout', 'interested'].includes(module.status))
      .map((module) => module.module_id)),
    [companyModules]
  );

  const availableModules = modules.filter((module) => !requestedModuleIds.has(module.id));
  const shouldRender = canSeeOffer && (modules.length > 0 || hasManualMarketplaceHighlight);

  useEffect(() => {
    if (!canSeeOffer) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      const { data: moduleRows, error: moduleError } = await supabase
        .from('plan_modules')
        .select('id, name, slug, description, price_monthly, price_yearly, stripe_monthly_price_id')
        .in('slug', marketplaceSlugs)
        .eq('active', true)
        .order('price_monthly', { ascending: true });

      if (moduleError) {
        console.error('[MarketplaceUpgradeOffer] Failed to load modules:', moduleError);
      }

      const moduleIds = (moduleRows || []).map((module) => module.id);
      const [companyModulesResponse, manualHighlightResponse] = await Promise.all([
        moduleIds.length > 0
          ? supabase
              .from('company_modules')
              .select('module_id, status')
              .eq('company_id', companyId!)
              .in('module_id', moduleIds)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from('marketplace_featured_items')
          .select('id, highlight_type, status')
          .eq('company_id', companyId!)
          .eq('status', 'active')
          .limit(1),
      ]);

      const { data: companyRows, error: companyError } = companyModulesResponse;
      const { data: manualHighlightRows, error: manualHighlightError } = manualHighlightResponse;

      if (companyError) {
        console.error('[MarketplaceUpgradeOffer] Failed to load company modules:', companyError);
      }
      if (manualHighlightError) {
        console.error('[MarketplaceUpgradeOffer] Failed to load manual marketplace highlight:', manualHighlightError);
      }

      if (cancelled) return;

      setModules((moduleRows || []) as MarketplaceModule[]);
      setCompanyModules((companyRows || []) as CompanyModule[]);
      setHasManualMarketplaceHighlight(Boolean(manualHighlightRows && manualHighlightRows.length > 0));
      setLoading(false);

      if (mode === 'popup' && moduleRows && moduleRows.length > 0) {
        const key = offerStorageKey(companyId, user?.id);
        const alreadySeen = localStorage.getItem(key) === '1';
        const hasMarketplaceUpgrade = (companyRows || []).some((row) =>
          ['active', 'pending', 'pending_checkout', 'interested'].includes(row.status)
        );

        if (!alreadySeen && !hasMarketplaceUpgrade && !manualHighlightRows?.length) {
          setOpen(true);
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [canSeeOffer, companyId, user?.id, mode]);

  const dismiss = () => {
    if (companyId && user?.id) localStorage.setItem(offerStorageKey(companyId, user.id), '1');
    setOpen(false);
  };

  const registerInterest = async (module: MarketplaceModule) => {
    if (!companyId) return;

    setBusy(module.id);
    try {
      const { data, error } = await supabase.functions.invoke('activate-marketplace-upgrade', {
        body: { companyId, moduleId: module.id },
      });

      if (error) throw error;

      setCompanyModules((previous) => [
        ...previous.filter((item) => item.module_id !== module.id),
        { module_id: module.id, status: data?.active ? 'active' : 'interested' },
      ]);
      toast.success('Interesse registrado. Nossa equipe entrará em contato para ativar o destaque.');
      dismiss();
    } catch (error: any) {
      toast.error(error?.message || 'Não foi possível registrar o interesse.');
    } finally {
      setBusy(null);
    }
  };

  const ModuleCard = ({ module, compact = false }: { module: MarketplaceModule; compact?: boolean }) => {
    const isMax = module.slug.includes('max');
    const discountPrice = module.price_monthly > 0 ? module.price_monthly * 0.8 : 0;

    return (
      <Card className={`overflow-hidden ${isMax ? 'border-amber-400/60 bg-amber-500/5' : 'border-primary/25'}`}>
        <CardContent className={compact ? 'p-4 space-y-3' : 'p-5 space-y-4'}>
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${isMax ? 'bg-amber-500/15 text-amber-600' : 'bg-primary/10 text-primary'}`}>
              {isMax ? <Crown className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold leading-tight">{module.name}</h3>
                {isMax && <Badge className="bg-amber-500 text-white">Mais visibilidade</Badge>}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {module.description || 'Ganhe destaque nas áreas principais do marketplace.'}
              </p>
            </div>
          </div>

          <div className="rounded-lg border bg-background/70 p-3">
            <p className="text-xs text-muted-foreground">Oferta de lançamento</p>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-xl font-bold">{formatBRL(discountPrice || module.price_monthly)}</span>
              {module.price_monthly > 0 && (
                <span className="text-xs text-muted-foreground line-through">{formatBRL(module.price_monthly)}</span>
              )}
              <Badge variant="outline" className="text-success border-success/30">20% off</Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Depois da promoção, o valor mensal fica {formatBRL(module.price_monthly)}.
            </p>
          </div>

          <Button className="w-full" onClick={() => registerInterest(module)} disabled={busy === module.id}>
            {busy === module.id ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            Quero esse destaque
          </Button>
        </CardContent>
      </Card>
    );
  };

  if (loading || !shouldRender) return null;

  if (mode === 'card') {
    return (
      <div className="space-y-4">
        <div>
          <h3 className="text-lg font-display font-semibold flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" /> Upgrade de marketplace
          </h3>
          <p className="text-sm text-muted-foreground">
            Todas as empresas aparecem no marketplace básico. Estes upgrades aumentam a visibilidade.
          </p>
        </div>

        <Card className="border-success/25 bg-success/5">
          <CardContent className="p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-success shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Marketplace básico já incluso</p>
              <p className="text-sm text-muted-foreground">
                Sua empresa continua listada gratuitamente. O upgrade serve apenas para ganhar prioridade e mais destaque.
              </p>
            </div>
          </CardContent>
        </Card>

        {hasManualMarketplaceHighlight ? (
          <Card className="border-primary/20">
            <CardContent className="p-5 text-sm text-muted-foreground">
              Esta empresa já possui um destaque manual ativo no marketplace. Por isso, a oferta automática de upgrade não será exibida.
            </CardContent>
          </Card>
        ) : availableModules.length === 0 ? (
          <Card>
            <CardContent className="p-5 text-sm text-muted-foreground">
              Você já demonstrou interesse ou possui um destaque de marketplace ativo.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableModules.map((module) => <ModuleCard key={module.id} module={module} compact />)}
          </div>
        )}
      </div>
    );
  }

  if (hasManualMarketplaceHighlight || availableModules.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={(value) => (value ? setOpen(true) : dismiss())}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <button
          type="button"
          onClick={dismiss}
          className="absolute right-4 top-4 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
        <DialogHeader className="px-6 pt-6 pb-2">
          <Badge className="w-fit bg-primary/10 text-primary hover:bg-primary/10">Marketplace básico incluso</Badge>
          <DialogTitle className="text-2xl font-display">Quer aparecer com mais destaque?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Sua empresa já entra no marketplace gratuitamente. Por tempo limitado, você pode reservar destaque com 20% de desconto.
          </p>
        </DialogHeader>
        <div className="px-6 pb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableModules.map((module) => <ModuleCard key={module.id} module={module} />)}
        </div>
        <div className="px-6 py-4 border-t bg-muted/30 flex justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Quando os IDs do Stripe forem configurados, este adicional poderá entrar na mesma assinatura/fatura.
          </p>
          <Button variant="ghost" size="sm" onClick={dismiss}>Agora não</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MarketplaceUpgradeOffer;
