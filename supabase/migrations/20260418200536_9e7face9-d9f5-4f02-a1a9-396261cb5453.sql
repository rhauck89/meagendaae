-- 1. Add paddle price IDs to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS paddle_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS paddle_yearly_price_id text,
  ADD COLUMN IF NOT EXISTS paddle_product_id text;

UPDATE public.plans SET paddle_product_id='plan_solo', paddle_monthly_price_id='plan_solo_monthly', paddle_yearly_price_id='plan_solo_yearly' WHERE slug='solo';
UPDATE public.plans SET paddle_product_id='plan_studio', paddle_monthly_price_id='plan_studio_monthly', paddle_yearly_price_id='plan_studio_yearly' WHERE slug='studio';
UPDATE public.plans SET paddle_product_id='plan_elite', paddle_monthly_price_id='plan_elite_monthly', paddle_yearly_price_id='plan_elite_yearly' WHERE slug='elite';

-- 2. Companies: paddle subscription, customer, grace period
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS paddle_subscription_id text,
  ADD COLUMN IF NOT EXISTS paddle_customer_id text,
  ADD COLUMN IF NOT EXISTS grace_period_until timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_companies_paddle_subscription ON public.companies(paddle_subscription_id);
CREATE INDEX IF NOT EXISTS idx_companies_paddle_customer ON public.companies(paddle_customer_id);

-- 3. Audit log table
CREATE TABLE IF NOT EXISTS public.subscription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  paddle_event_id text,
  paddle_subscription_id text,
  paddle_customer_id text,
  status text,
  environment text NOT NULL DEFAULT 'sandbox',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subscription_events_company ON public.subscription_events(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_events_paddle_sub ON public.subscription_events(paddle_subscription_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscription_events_paddle_event ON public.subscription_events(paddle_event_id) WHERE paddle_event_id IS NOT NULL;

ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Super admins can view subscription events" ON public.subscription_events;
CREATE POLICY "Super admins can view subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

DROP POLICY IF EXISTS "Owners can view own subscription events" ON public.subscription_events;
CREATE POLICY "Owners can view own subscription events"
  ON public.subscription_events FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.companies c WHERE c.id = subscription_events.company_id AND c.owner_id = auth.uid()));

-- 4. is_company_active
CREATE OR REPLACE FUNCTION public.is_company_active(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = p_company_id
      AND (
        (c.trial_active AND c.trial_end_date IS NOT NULL AND c.trial_end_date > now())
        OR (c.subscription_status::text = 'active'
            AND (c.current_period_end IS NULL OR c.current_period_end > now()))
        OR (c.subscription_status::text = 'past_due'
            AND c.grace_period_until IS NOT NULL
            AND c.grace_period_until > now())
        OR (c.subscription_status::text = 'canceled'
            AND c.cancel_at_period_end = true
            AND c.current_period_end IS NOT NULL
            AND c.current_period_end > now())
      )
  );
$$;

-- 5. is_company_readonly
CREATE OR REPLACE FUNCTION public.is_company_readonly(p_company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT public.is_company_active(p_company_id)
     AND EXISTS (SELECT 1 FROM public.companies WHERE id = p_company_id);
$$;

-- 6. Apply pending plan changes (cron)
CREATE OR REPLACE FUNCTION public.apply_pending_plan_changes()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_applied int := 0;
  v_company record;
BEGIN
  FOR v_company IN
    SELECT id, pending_plan_id, pending_billing_cycle, pending_change_at
    FROM public.companies
    WHERE pending_plan_id IS NOT NULL
      AND pending_change_at IS NOT NULL
      AND pending_change_at <= now()
  LOOP
    UPDATE public.companies
    SET plan_id = v_company.pending_plan_id,
        billing_cycle = COALESCE(v_company.pending_billing_cycle, billing_cycle),
        pending_plan_id = NULL,
        pending_billing_cycle = NULL,
        pending_change_at = NULL,
        updated_at = now()
    WHERE id = v_company.id;

    INSERT INTO public.subscription_events (company_id, event_type, status, payload)
    VALUES (v_company.id, 'pending_change_applied', 'active',
            jsonb_build_object('new_plan_id', v_company.pending_plan_id));

    v_applied := v_applied + 1;
  END LOOP;

  RETURN jsonb_build_object('applied', v_applied, 'ran_at', now());
END;
$$;

-- 7. Expire trials and grace
CREATE OR REPLACE FUNCTION public.expire_trials_and_grace()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_trials_expired int := 0;
  v_grace_expired int := 0;
BEGIN
  UPDATE public.companies
  SET trial_active = false,
      subscription_status = 'expired_trial'::subscription_status,
      updated_at = now()
  WHERE trial_active = true
    AND trial_end_date IS NOT NULL
    AND trial_end_date <= now()
    AND subscription_status::text NOT IN ('active', 'trialing');
  GET DIAGNOSTICS v_trials_expired = ROW_COUNT;

  UPDATE public.companies
  SET subscription_status = 'unpaid'::subscription_status,
      updated_at = now()
  WHERE subscription_status::text = 'past_due'
    AND grace_period_until IS NOT NULL
    AND grace_period_until <= now();
  GET DIAGNOSTICS v_grace_expired = ROW_COUNT;

  RETURN jsonb_build_object(
    'trials_expired', v_trials_expired,
    'grace_expired', v_grace_expired,
    'ran_at', now()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_company_active(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_company_readonly(uuid) TO authenticated, anon;