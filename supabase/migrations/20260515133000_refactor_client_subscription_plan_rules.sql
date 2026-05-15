-- Refactor client subscription plans so plan rules own professionals, limits and commissions.

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS limit_period text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS commission_timing text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_commission_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_commission_value numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quantity_available integer;

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

UPDATE public.subscription_plans
SET
  limit_period = COALESCE(limit_period, 'monthly'),
  commission_timing = COALESCE(NULLIF(commission_timing, ''), 'none'),
  plan_commission_type = COALESCE(NULLIF(plan_commission_type, ''), 'none'),
  plan_commission_value = COALESCE(plan_commission_value, 0);

-- Preserve current subscribers' responsible professionals as plan participants.
INSERT INTO public.subscription_plan_professionals (company_id, plan_id, professional_id)
SELECT DISTINCT cs.company_id, cs.plan_id, cs.professional_id
FROM public.client_subscriptions cs
WHERE cs.plan_id IS NOT NULL
  AND cs.professional_id IS NOT NULL
ON CONFLICT (plan_id, professional_id) DO NOTHING;

-- Plans that previously allowed every professional keep all active service providers attached.
INSERT INTO public.subscription_plan_professionals (company_id, plan_id, professional_id)
SELECT DISTINCT sp.company_id, sp.id, c.profile_id
FROM public.subscription_plans sp
JOIN public.collaborators c
  ON c.company_id = sp.company_id
WHERE COALESCE(sp.all_professionals, false) = true
  AND c.active = true
  AND c.is_service_provider = true
  AND c.profile_id IS NOT NULL
ON CONFLICT (plan_id, professional_id) DO NOTHING;

-- Old client-level commission fields remain for compatibility, but new flows ignore them.
UPDATE public.client_subscriptions
SET professional_id = NULL,
    professional_commission = 0;

DROP FUNCTION IF EXISTS public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date, text);
DROP FUNCTION IF EXISTS public.check_subscription_benefit(uuid, uuid, uuid, uuid[], date, text, time);

CREATE OR REPLACE FUNCTION public.check_subscription_benefit(
  p_company_id uuid,
  p_client_id uuid DEFAULT NULL::uuid,
  p_professional_id uuid DEFAULT NULL::uuid,
  p_service_ids uuid[] DEFAULT '{}'::uuid[],
  p_date date DEFAULT CURRENT_DATE,
  p_whatsapp text DEFAULT NULL::text,
  p_time time DEFAULT NULL::time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_sub record;
  v_plan record;
  v_usage_count integer := 0;
  v_covered_services uuid[] := '{}';
  v_charged_services uuid[] := '{}';
  v_service_id uuid;
  v_overdue_days integer;
  v_actual_client_id uuid := p_client_id;
  v_whatsapp_clean text;
  v_billing_day integer;
  v_cycle_start date;
  v_cycle_end date;
  v_day_of_week integer;
  v_usage_remaining integer;
BEGIN
  v_whatsapp_clean := NULLIF(regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g'), '');

  IF v_actual_client_id IS NULL AND v_whatsapp_clean IS NOT NULL THEN
    SELECT id INTO v_actual_client_id
    FROM public.clients
    WHERE company_id = p_company_id
      AND (
        whatsapp = p_whatsapp
        OR whatsapp = v_whatsapp_clean
        OR regexp_replace(COALESCE(whatsapp, ''), '\D', '', 'g') = v_whatsapp_clean
      )
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;

  IF v_actual_client_id IS NULL THEN
    RETURN jsonb_build_object('benefit_applied', false, 'reason', 'no_client_found', 'usage_limit', 0, 'usage_used', 0, 'usage_remaining', 0);
  END IF;

  SELECT cs.*
  INTO v_sub
  FROM public.client_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.client_id = v_actual_client_id
    AND cs.company_id = p_company_id
    AND cs.status IN ('active', 'past_due')
    AND (cs.end_date IS NULL OR cs.end_date >= p_date)
    AND (
      p_professional_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.subscription_plan_professionals spp
        WHERE spp.plan_id = sp.id
          AND spp.professional_id = p_professional_id
      )
    )
  ORDER BY CASE WHEN cs.status = 'active' THEN 0 ELSE 1 END, cs.created_at DESC
  LIMIT 1;

  IF v_sub.id IS NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.client_subscriptions cs
      WHERE cs.client_id = v_actual_client_id
        AND cs.company_id = p_company_id
        AND cs.status IN ('active', 'past_due')
    ) THEN
      RETURN jsonb_build_object('benefit_applied', false, 'reason', 'wrong_professional', 'usage_limit', 0, 'usage_used', 0, 'usage_remaining', 0);
    END IF;

    RETURN jsonb_build_object('benefit_applied', false, 'reason', 'no_subscription', 'usage_limit', 0, 'usage_used', 0, 'usage_remaining', 0);
  END IF;

  SELECT * INTO v_plan
  FROM public.subscription_plans
  WHERE id = v_sub.plan_id;

  IF v_plan.id IS NULL THEN
    RETURN jsonb_build_object('benefit_applied', false, 'reason', 'plan_not_found', 'subscription_id', v_sub.id, 'usage_limit', 0, 'usage_used', 0, 'usage_remaining', 0);
  END IF;

  v_day_of_week := EXTRACT(DOW FROM p_date);
  IF v_plan.valid_days IS NOT NULL AND array_length(v_plan.valid_days, 1) > 0 THEN
    IF NOT (v_day_of_week = ANY(v_plan.valid_days)) THEN
      RETURN jsonb_build_object('benefit_applied', false, 'reason', 'invalid_day', 'subscription_id', v_sub.id, 'plan_name', v_plan.name, 'valid_days', v_plan.valid_days);
    END IF;
  END IF;

  IF p_time IS NOT NULL THEN
    IF v_plan.valid_start_time IS NOT NULL AND p_time < v_plan.valid_start_time THEN
      RETURN jsonb_build_object('benefit_applied', false, 'reason', 'invalid_time', 'subscription_id', v_sub.id, 'plan_name', v_plan.name);
    END IF;
    IF v_plan.valid_end_time IS NOT NULL AND p_time > v_plan.valid_end_time THEN
      RETURN jsonb_build_object('benefit_applied', false, 'reason', 'invalid_time', 'subscription_id', v_sub.id, 'plan_name', v_plan.name);
    END IF;
  END IF;

  IF v_sub.status = 'past_due' THEN
    SELECT (CURRENT_DATE - MIN(due_date)) INTO v_overdue_days
    FROM public.subscription_charges
    WHERE subscription_id = v_sub.id AND status = 'pending';

    IF v_overdue_days > COALESCE(v_sub.grace_period_days, 0) THEN
      RETURN jsonb_build_object('benefit_applied', false, 'reason', 'payment_overdue', 'subscription_id', v_sub.id, 'plan_name', v_plan.name, 'overdue_days', v_overdue_days);
    END IF;
  END IF;

  IF v_plan.type = 'limited' AND COALESCE(v_plan.limit_period, 'monthly') = 'weekly' THEN
    v_cycle_start := date_trunc('week', p_date)::date;
    v_cycle_end := (v_cycle_start + INTERVAL '1 week')::date;
  ELSE
    v_billing_day := v_sub.billing_day;
    v_cycle_end := (date_trunc('month', p_date) + (v_billing_day - 1) * INTERVAL '1 day')::date;
    IF v_cycle_end > p_date THEN
      v_cycle_start := (v_cycle_end - INTERVAL '1 month')::date;
    ELSE
      v_cycle_start := v_cycle_end;
      v_cycle_end := (v_cycle_start + INTERVAL '1 month')::date;
    END IF;
  END IF;

  SELECT COALESCE(SUM(usage_count), 0) INTO v_usage_count
  FROM public.subscription_usage
  WHERE subscription_id = v_sub.id
    AND usage_date >= v_cycle_start
    AND usage_date < v_cycle_end;

  IF v_plan.type = 'limited' AND v_usage_count >= COALESCE(v_plan.usage_limit, 0) THEN
    RETURN jsonb_build_object('benefit_applied', false, 'reason', 'limit_reached', 'subscription_id', v_sub.id, 'plan_name', v_plan.name, 'usage_limit', v_plan.usage_limit, 'usage_used', v_usage_count, 'usage_remaining', 0);
  END IF;

  v_usage_remaining := CASE
    WHEN v_plan.type = 'unlimited' THEN NULL
    ELSE GREATEST(COALESCE(v_plan.usage_limit, 0) - v_usage_count, 0)
  END;

  FOREACH v_service_id IN ARRAY p_service_ids
  LOOP
    IF v_service_id = ANY(v_plan.included_services) THEN
      IF v_plan.type = 'unlimited'
         OR COALESCE(v_plan.usage_count_mode, 'service') = 'appointment'
         OR COALESCE(array_length(v_covered_services, 1), 0) < COALESCE(v_usage_remaining, 0) THEN
        v_covered_services := array_append(v_covered_services, v_service_id);
      ELSE
        v_charged_services := array_append(v_charged_services, v_service_id);
      END IF;
    ELSE
      v_charged_services := array_append(v_charged_services, v_service_id);
    END IF;
  END LOOP;

  IF array_length(v_covered_services, 1) IS NULL THEN
    RETURN jsonb_build_object('benefit_applied', false, 'reason', 'services_not_included', 'subscription_id', v_sub.id, 'plan_name', v_plan.name, 'usage_limit', CASE WHEN v_plan.type = 'unlimited' THEN NULL ELSE v_plan.usage_limit END, 'usage_used', v_usage_count, 'usage_remaining', CASE WHEN v_plan.type = 'unlimited' THEN NULL ELSE v_plan.usage_limit - v_usage_count END);
  END IF;

  RETURN jsonb_build_object(
    'benefit_applied', true,
    'subscription_id', v_sub.id,
    'plan_name', v_plan.name,
    'covered_service_ids', v_covered_services,
    'charged_service_ids', v_charged_services,
    'usage_limit', CASE WHEN v_plan.type = 'unlimited' THEN NULL ELSE v_plan.usage_limit END,
    'usage_used', v_usage_count,
    'usage_remaining', v_usage_remaining,
    'usage_count_mode', v_plan.usage_count_mode,
    'limit_period', v_plan.limit_period
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_info record;
  v_prof_count integer := 0;
  v_total_commission numeric := 0;
  v_commission_per_prof numeric := 0;
  v_company_net_per_prof numeric := 0;
  v_prof record;
BEGIN
  IF (NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid')) THEN
    SELECT cs.id, cs.client_id, cs.company_id, sp.name AS plan_name, sp.commission_timing,
           sp.plan_commission_type, sp.plan_commission_value
    INTO v_info
    FROM public.client_subscriptions cs
    JOIN public.subscription_plans sp ON sp.id = cs.plan_id
    WHERE cs.id = NEW.subscription_id;

    IF v_info.id IS NULL OR v_info.commission_timing <> 'plan_billing' OR v_info.plan_commission_type = 'none' THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO v_prof_count
    FROM public.subscription_plan_professionals
    WHERE plan_id = (SELECT plan_id FROM public.client_subscriptions WHERE id = NEW.subscription_id);

    IF v_prof_count <= 0 THEN
      RETURN NEW;
    END IF;

    IF v_info.plan_commission_type = 'percentage' THEN
      v_total_commission := ROUND((NEW.amount * COALESCE(v_info.plan_commission_value, 0)) / 100, 2);
    ELSE
      v_total_commission := COALESCE(v_info.plan_commission_value, 0);
    END IF;

    IF v_total_commission <= 0 THEN
      RETURN NEW;
    END IF;

    v_commission_per_prof := ROUND(v_total_commission / v_prof_count, 2);
    v_company_net_per_prof := ROUND((NEW.amount - v_total_commission) / v_prof_count, 2);

    FOR v_prof IN
      SELECT professional_id
      FROM public.subscription_plan_professionals
      WHERE plan_id = (SELECT plan_id FROM public.client_subscriptions WHERE id = NEW.subscription_id)
    LOOP
      INSERT INTO public.professional_commissions (
        company_id, professional_id, client_id, source_type, source_id, description,
        gross_amount, commission_type, commission_rate, commission_amount, company_net_amount,
        paid_at, status
      ) VALUES (
        v_info.company_id, v_prof.professional_id, v_info.client_id, 'subscription_charge', NEW.id,
        'Comissão Assinatura: ' || v_info.plan_name,
        NEW.amount, v_info.plan_commission_type, COALESCE(v_info.plan_commission_value, 0),
        v_commission_per_prof, v_company_net_per_prof, NEW.paid_at, 'paid'
      )
      ON CONFLICT ON CONSTRAINT professional_commissions_source_id_source_type_prof_key
      DO UPDATE SET
        gross_amount = EXCLUDED.gross_amount,
        commission_type = EXCLUDED.commission_type,
        commission_rate = EXCLUDED.commission_rate,
        commission_amount = EXCLUDED.commission_amount,
        company_net_amount = EXCLUDED.company_net_amount,
        paid_at = EXCLUDED.paid_at,
        status = EXCLUDED.status,
        description = EXCLUDED.description;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_subscription_charge_paid ON public.subscription_charges;
CREATE TRIGGER on_subscription_charge_paid
  AFTER UPDATE ON public.subscription_charges
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_subscription_commission();

CREATE OR REPLACE FUNCTION public.generate_subscription_appointment_commission(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_appt record;
  v_sub record;
  v_plan record;
  v_base numeric := 0;
  v_commission numeric := 0;
BEGIN
  SELECT a.id, a.company_id, a.client_id, a.professional_id, a.start_time, a.original_price, a.total_price
  INTO v_appt
  FROM public.appointments a
  WHERE a.id = p_appointment_id;

  IF v_appt.id IS NULL OR v_appt.professional_id IS NULL OR v_appt.client_id IS NULL THEN
    RETURN;
  END IF;

  SELECT
    cs.id AS subscription_id,
    sp.name AS plan_name,
    sp.price_monthly,
    sp.plan_commission_type,
    sp.plan_commission_value
  INTO v_sub
  FROM public.client_subscriptions cs
  JOIN public.subscription_plans sp ON sp.id = cs.plan_id
  WHERE cs.company_id = v_appt.company_id
    AND cs.client_id = v_appt.client_id
    AND cs.status IN ('active', 'past_due')
    AND sp.commission_timing = 'appointment_completion'
    AND sp.plan_commission_type <> 'none'
    AND EXISTS (
      SELECT 1
      FROM public.subscription_plan_professionals spp
      WHERE spp.plan_id = sp.id
        AND spp.professional_id = v_appt.professional_id
    )
  ORDER BY cs.created_at DESC
  LIMIT 1;

  IF v_sub.subscription_id IS NULL THEN
    RETURN;
  END IF;

  v_base := COALESCE(v_sub.price_monthly, v_appt.original_price, v_appt.total_price, 0);
  IF v_sub.plan_commission_type = 'percentage' THEN
    v_commission := ROUND((v_base * COALESCE(v_sub.plan_commission_value, 0)) / 100, 2);
  ELSE
    v_commission := COALESCE(v_sub.plan_commission_value, 0);
  END IF;

  IF v_commission <= 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.professional_commissions (
    company_id, professional_id, client_id, source_type, source_id, description,
    gross_amount, commission_type, commission_rate, commission_amount, company_net_amount,
    paid_at, status
  ) VALUES (
    v_appt.company_id, v_appt.professional_id, v_appt.client_id, 'subscription', p_appointment_id,
    'Comissão Atendimento Assinatura: ' || v_sub.plan_name,
    v_base, v_sub.plan_commission_type, COALESCE(v_sub.plan_commission_value, 0),
    v_commission, 0, now(), 'paid'
  )
  ON CONFLICT ON CONSTRAINT professional_commissions_source_id_source_type_prof_key
  DO UPDATE SET
    gross_amount = EXCLUDED.gross_amount,
    commission_type = EXCLUDED.commission_type,
    commission_rate = EXCLUDED.commission_rate,
    commission_amount = EXCLUDED.commission_amount,
    paid_at = EXCLUDED.paid_at,
    status = EXCLUDED.status,
    description = EXCLUDED.description;
END;
$function$;
