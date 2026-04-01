
-- Add trial fields to companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS trial_start_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS trial_active boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS billing_cycle text NOT NULL DEFAULT 'monthly';

-- Set existing trial companies
UPDATE public.companies 
SET trial_start_date = created_at,
    trial_end_date = created_at + interval '7 days',
    trial_active = true
WHERE subscription_status = 'trial' AND trial_start_date IS NULL;

-- Create a function to auto-setup trial for new companies
CREATE OR REPLACE FUNCTION public.setup_company_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  default_plan_id uuid;
BEGIN
  -- Find the first active plan (cheapest) as default trial plan
  SELECT id INTO default_plan_id 
  FROM public.plans 
  WHERE active = true 
  ORDER BY monthly_price ASC, sort_order ASC 
  LIMIT 1;

  NEW.trial_start_date := now();
  NEW.trial_end_date := now() + interval '7 days';
  NEW.trial_active := true;
  NEW.subscription_status := 'trial';
  
  IF default_plan_id IS NOT NULL AND NEW.plan_id IS NULL THEN
    NEW.plan_id := default_plan_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on insert
DROP TRIGGER IF EXISTS trigger_setup_company_trial ON public.companies;
CREATE TRIGGER trigger_setup_company_trial
  BEFORE INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.setup_company_trial();
