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
}

interface CompanyPlanInfo {
  planName: string;
  planId: string | null;
  billingCycle: string;
  monthlyPrice: number;
  yearlyPrice: number;
  trialActive: boolean;
  trialEndDate: string | null;
  trialDaysLeft: number;
  trialExpired: boolean;
  subscriptionStatus: string;
  features: PlanFeatures;
  loading: boolean;
  isFeatureEnabled: (feature: keyof PlanFeatures) => boolean;
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
};

export const useCompanyPlan = (): CompanyPlanInfo => {
  const { companyId } = useAuth();
  const [planName, setPlanName] = useState('');
  const [planId, setPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [monthlyPrice, setMonthlyPrice] = useState(0);
  const [yearlyPrice, setYearlyPrice] = useState(0);
  const [trialActive, setTrialActive] = useState(false);
  const [trialEndDate, setTrialEndDate] = useState<string | null>(null);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);
  const [trialExpired, setTrialExpired] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [features, setFeatures] = useState<PlanFeatures>(defaultFeatures);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }

    const fetch = async () => {
      const { data: company } = await supabase
        .from('companies')
        .select('plan_id, subscription_status, trial_active, trial_end_date, billing_cycle')
        .eq('id', companyId)
        .single();

      if (!company) { setLoading(false); return; }

      setSubscriptionStatus(company.subscription_status);
      setTrialActive(company.trial_active ?? false);
      setTrialEndDate(company.trial_end_date ?? null);
      setBillingCycle((company as any).billing_cycle ?? 'monthly');
      setPlanId(company.plan_id);

      // Calculate trial days
      if (company.trial_active && company.trial_end_date) {
        const end = new Date(company.trial_end_date);
        const now = new Date();
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        setTrialDaysLeft(Math.max(0, diff));
        setTrialExpired(diff <= 0 && company.subscription_status !== 'active');
      } else {
        setTrialDaysLeft(0);
        setTrialExpired(
          company.subscription_status === 'trial' && 
          company.trial_end_date != null && 
          new Date(company.trial_end_date) < new Date()
        );
      }

      // Fetch plan details
      if (company.plan_id) {
        const { data: plan } = await supabase
          .from('plans')
          .select('*')
          .eq('id', company.plan_id)
          .single();

        if (plan) {
          setPlanName(plan.name);
          setMonthlyPrice(Number(plan.monthly_price));
          setYearlyPrice(Number(plan.yearly_price));
          const p = plan as any;
          setFeatures({
            automatic_messages: plan.automatic_messages,
            open_scheduling: plan.open_scheduling,
            promotions: plan.promotions,
            discount_coupons: plan.discount_coupons,
            whitelabel: plan.whitelabel,
            members_limit: plan.members_limit,
            feature_requests: p.feature_requests ?? false,
            feature_financial_level: p.feature_financial_level ?? 'none',
          });
        }
      }

      setLoading(false);
    };

    fetch();
  }, [companyId]);

  const isFeatureEnabled = (feature: keyof PlanFeatures): boolean => {
    // During active trial, all features are enabled
    if (trialActive && !trialExpired) return true;
    
    // For financial level, 'none' means disabled
    if (feature === 'feature_financial_level') {
      return features.feature_financial_level !== 'none';
    }
    
    return !!features[feature];
  };

  return {
    planName,
    planId,
    billingCycle,
    monthlyPrice,
    yearlyPrice,
    trialActive,
    trialEndDate,
    trialDaysLeft,
    trialExpired,
    subscriptionStatus,
    features,
    loading,
    isFeatureEnabled,
  };
};
