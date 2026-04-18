import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

interface PlanFeatures {
  automatic_messages: boolean;
  open_scheduling: boolean;
  promotions: boolean;
  discount_coupons: boolean;
  whitelabel: boolean;
  members_limit: number;
  feature_requests: boolean;
  feature_financial_level: string;
  custom_branding: boolean;
  // new
  cashback: boolean;
  loyalty: boolean;
  open_agenda: boolean;
  automation: boolean;
  monthly_reports: boolean;
  advanced_reports: boolean;
  whatsapp_default: boolean;
  premium_templates: boolean;
  custom_domain: boolean;
  custom_colors: boolean;
  support_priority: boolean;
  multi_location_ready: boolean;
}

interface CompanyPlanInfo {
  planName: string;
  planId: string | null;
  planSlug: string | null;
  planBadge: string | null;
  billingCycle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialActive: boolean;
  trialPlanName: string | null;
  trialEndDate: string | null;
  trialDaysLeft: number;
  trialExpired: boolean;
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  pendingPlanId: string | null;
  pendingPlanName: string | null;
  pendingBillingCycle: string | null;
  pendingChangeAt: string | null;
  features: PlanFeatures;
  loading: boolean;
  isFeatureEnabled: (feature: keyof PlanFeatures) => boolean;
  refresh: () => Promise<void>;
}

const defaultFeatures: PlanFeatures = {
  automatic_messages: false,
  open_scheduling: false,
  promotions: false,
  discount_coupons: false,
  whitelabel: false,
  members_limit: 1,
  feature_requests: false,
  feature_financial_level: 'none',
  custom_branding: false,
  cashback: false,
  loyalty: false,
  open_agenda: false,
  automation: false,
  monthly_reports: false,
  advanced_reports: false,
  whatsapp_default: false,
  premium_templates: false,
  custom_domain: false,
  custom_colors: false,
  support_priority: false,
  multi_location_ready: false,
};

const mapFeatures = (plan: any): PlanFeatures => ({
  automatic_messages: !!plan.automatic_messages,
  open_scheduling: !!plan.open_scheduling,
  promotions: !!plan.promotions,
  discount_coupons: !!plan.discount_coupons,
  whitelabel: !!plan.whitelabel,
  members_limit: Number(plan.members_limit ?? 1),
  feature_requests: !!plan.feature_requests,
  feature_financial_level: plan.feature_financial_level ?? 'none',
  custom_branding: !!plan.custom_branding,
  cashback: !!plan.cashback,
  loyalty: !!plan.loyalty,
  open_agenda: !!plan.open_agenda,
  automation: !!plan.automation,
  monthly_reports: !!plan.monthly_reports,
  advanced_reports: !!plan.advanced_reports,
  whatsapp_default: !!plan.whatsapp_default,
  premium_templates: !!plan.premium_templates,
  custom_domain: !!plan.custom_domain,
  custom_colors: !!plan.custom_colors,
  support_priority: !!plan.support_priority,
  multi_location_ready: !!plan.multi_location_ready,
});

export const useCompanyPlan = (): CompanyPlanInfo => {
  const { companyId } = useAuth();
  const [planName, setPlanName] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [planSlug, setPlanSlug] = useState<string | null>(null);
  const [planBadge, setPlanBadge] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [trialActive, setTrialActive] = useState(false);
  const [trialPlanName, setTrialPlanName] = useState<string | null>(null);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [trialExpired, setTrialExpired] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
  const [pendingPlanId, setPendingPlanId] = useState<string | null>(null);
  const [pendingPlanName, setPendingPlanName] = useState<string | null>(null);
  const [pendingBillingCycle, setPendingBillingCycle] = useState<string | null>(null);
  const [pendingChangeAt, setPendingChangeAt] = useState<string | null>(null);
  const [features, setFeatures] = useState<PlanFeatures>(defaultFeatures);
  const [loading, setLoading] = useState(true);

  const fetchPlan = async () => {
    if (!companyId) { setLoading(false); return; }
    setLoading(true);

    const { data: company } = await supabase
      .from('companies')
      .select('plan_id, subscription_status, trial_active, trial_end_date, billing_cycle, trial_plan_id, current_period_end, pending_plan_id, pending_billing_cycle, pending_change_at' as any)
      .eq('id', companyId)
      .single();

    if (!company) { setLoading(false); return; }

    const c = company as any;
    setSubscriptionStatus(c.subscription_status);
    setTrialActive(c.trial_active ?? false);
    setTrialEndDate(c.trial_end_date ?? null);
    setBillingCycle(c.billing_cycle ?? 'monthly');
    setPlanId(c.plan_id);
    setCurrentPeriodEnd(c.current_period_end ?? null);
    setPendingPlanId(c.pending_plan_id ?? null);
    setPendingBillingCycle(c.pending_billing_cycle ?? null);
    setPendingChangeAt(c.pending_change_at ?? null);

    let expired = false;
    if (c.trial_active && c.trial_end_date) {
      const end = new Date(c.trial_end_date);
      const now = new Date();
      const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      setTrialDaysLeft(Math.max(0, diff));
      expired = diff <= 0 && c.subscription_status !== 'active';
    } else {
      setTrialDaysLeft(0);
      expired = c.subscription_status === 'trial' && c.trial_end_date != null && new Date(c.trial_end_date) < new Date();
    }
    setTrialExpired(expired);

    // Determine which plan provides the features (trial uses trial_plan_id)
    const isTrialActive = c.trial_active && !expired;
    const featurePlanId = isTrialActive && c.trial_plan_id ? c.trial_plan_id : c.plan_id;

    if (c.plan_id) {
      const { data: plan } = await supabase.from('plans').select('*').eq('id', c.plan_id).single();
      if (plan) {
        setPlanName(plan.name);
        setPlanSlug((plan as any).slug ?? null);
        setPlanBadge((plan as any).badge ?? null);
        setMonthlyPrice(Number(plan.monthly_price));
        setYearlyPrice(Number(plan.yearly_price));
      }
    } else {
      setPlanName('');
      setPlanSlug(null);
      setPlanBadge(null);
      setMonthlyPrice(0);
      setYearlyPrice(0);
    }

    if (featurePlanId) {
      const { data: featurePlan } = await supabase.from('plans').select('*').eq('id', featurePlanId).single();
      if (featurePlan) {
        setFeatures(mapFeatures(featurePlan));
        if (isTrialActive) setTrialPlanName(featurePlan.name);
      }
    } else {
      setFeatures(defaultFeatures);
      setTrialPlanName(null);
    }

    if (c.pending_plan_id) {
      const { data: pp } = await supabase.from('plans').select('name').eq('id', c.pending_plan_id).single();
      setPendingPlanName(pp?.name ?? null);
    } else {
      setPendingPlanName(null);
    }

    setLoading(false);
  };

  useEffect(() => { fetchPlan(); /* eslint-disable-next-line */ }, [companyId]);

  const isFeatureEnabled = (feature: keyof PlanFeatures): boolean => {
    if (trialActive && !trialExpired) return true;
    if (feature === 'feature_financial_level') return features.feature_financial_level !== 'none';
    return !!features[feature];
  };

  return {
    planName,
    planId,
    planSlug,
    planBadge,
    billingCycle,
    monthlyPrice,
    yearlyPrice,
    trialActive,
    trialPlanName,
    trialEndDate,
    trialDaysLeft,
    trialExpired,
    subscriptionStatus,
    currentPeriodEnd,
    pendingPlanId,
    pendingPlanName,
    pendingBillingCycle,
    pendingChangeAt,
    features,
    loading,
    isFeatureEnabled,
    refresh: fetchPlan,
  };
};
