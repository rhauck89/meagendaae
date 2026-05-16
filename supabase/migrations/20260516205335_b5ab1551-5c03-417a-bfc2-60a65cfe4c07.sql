-- Ensure columns exist in subscription_plans
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS limit_period text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS commission_timing text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_commission_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_commission_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_available integer;

-- Apply constraints
ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_limit_period_check,
  ADD CONSTRAINT subscription_plans_limit_period_check
    CHECK (limit_period IS NULL OR limit_period IN ('weekly', 'monthly'));

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_commission_timing_check,
  ADD CONSTRAINT subscription_plans_commission_timing_check
    CHECK (commission_timing IN ('none', 'appointment_completion', 'plan_billing'));

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_plan_commission_type_check,
  ADD CONSTRAINT subscription_plans_plan_commission_type_check
    CHECK (plan_commission_type IN ('none', 'percentage', 'fixed'));

ALTER TABLE public.subscription_plans
  DROP CONSTRAINT IF EXISTS subscription_plans_quantity_available_check,
  ADD CONSTRAINT subscription_plans_quantity_available_check
    CHECK (quantity_available IS NULL OR quantity_available >= 0);

-- Notify schema reload
SELECT pg_notify('pgrst', 'reload schema');
