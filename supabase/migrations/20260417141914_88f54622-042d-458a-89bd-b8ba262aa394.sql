-- Add custom_branding feature flag to plans
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS custom_branding boolean NOT NULL DEFAULT true;

-- Backend enforcement: prevent updating brand colors if the company's plan does not allow custom_branding.
-- theme_style (preset themes) is always allowed.
CREATE OR REPLACE FUNCTION public.enforce_branding_plan_permission()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
  v_trial_active boolean;
BEGIN
  -- Only check when the user is actually changing color fields
  IF TG_OP = 'UPDATE' AND
     NEW.primary_color IS NOT DISTINCT FROM OLD.primary_color AND
     NEW.secondary_color IS NOT DISTINCT FROM OLD.secondary_color AND
     NEW.background_color IS NOT DISTINCT FROM OLD.background_color
  THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.custom_branding, false), COALESCE(c.trial_active, false)
    INTO v_allowed, v_trial_active
  FROM public.companies c
  LEFT JOIN public.plans p ON p.id = c.plan_id
  WHERE c.id = NEW.company_id;

  -- Trial users get full access; otherwise plan flag must be true
  IF NOT (v_trial_active OR COALESCE(v_allowed, false)) THEN
    RAISE EXCEPTION 'Seu plano atual não permite personalizar cores da marca. Faça upgrade para liberar este recurso.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_branding_plan_permission ON public.company_settings;
CREATE TRIGGER trg_enforce_branding_plan_permission
  BEFORE INSERT OR UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_branding_plan_permission();