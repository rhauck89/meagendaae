-- =========================================
-- 1. PLANS table: add new commercial fields
-- =========================================
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS slug text UNIQUE,
  ADD COLUMN IF NOT EXISTS badge text,
  ADD COLUMN IF NOT EXISTS marketplace_priority smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_product_id text,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id text,
  ADD COLUMN IF NOT EXISTS cashback boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS loyalty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_agenda boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS automation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS monthly_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advanced_reports boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS premium_templates boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_domain boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_colors boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_priority boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS multi_location_ready boolean NOT NULL DEFAULT false;

-- =========================================
-- 2. COMPANIES table: trial + billing fields
-- =========================================
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS trial_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
  ADD COLUMN IF NOT EXISTS pending_plan_id uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_billing_cycle text,
  ADD COLUMN IF NOT EXISTS pending_change_at timestamptz;

-- =========================================
-- 3. PLAN_MODULES (add-ons catalog)
-- =========================================
CREATE TABLE IF NOT EXISTS public.plan_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  price_monthly numeric NOT NULL DEFAULT 0,
  price_yearly numeric NOT NULL DEFAULT 0,
  stripe_product_id text,
  stripe_monthly_price_id text,
  stripe_yearly_price_id text,
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active modules" ON public.plan_modules;
CREATE POLICY "Public can view active modules"
  ON public.plan_modules FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Super admins can manage modules" ON public.plan_modules;
CREATE POLICY "Super admins can manage modules"
  ON public.plan_modules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- =========================================
-- 4. COMPANY_MODULES (per-company add-ons)
-- =========================================
CREATE TABLE IF NOT EXISTS public.company_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  module_id uuid NOT NULL REFERENCES public.plan_modules(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  billing_cycle text NOT NULL DEFAULT 'monthly',
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  stripe_subscription_item_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, module_id)
);

CREATE INDEX IF NOT EXISTS idx_company_modules_company ON public.company_modules(company_id);

ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company members can view own modules" ON public.company_modules;
CREATE POLICY "Company members can view own modules"
  ON public.company_modules FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Super admins can manage company modules" ON public.company_modules;
CREATE POLICY "Super admins can manage company modules"
  ON public.company_modules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- =========================================
-- 5. Updated_at trigger for new tables
-- =========================================
DROP TRIGGER IF EXISTS update_plan_modules_updated_at ON public.plan_modules;
CREATE TRIGGER update_plan_modules_updated_at
  BEFORE UPDATE ON public.plan_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_company_modules_updated_at ON public.company_modules;
CREATE TRIGGER update_company_modules_updated_at
  BEFORE UPDATE ON public.company_modules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================
-- 6. Seed the 3 official plans (idempotent via slug)
-- =========================================
INSERT INTO public.plans (
  slug, name, monthly_price, yearly_price, yearly_discount, members_limit, active, sort_order, badge, marketplace_priority,
  automatic_messages, open_scheduling, promotions, discount_coupons, whitelabel,
  feature_requests, feature_financial_level, custom_branding,
  cashback, loyalty, open_agenda, automation, monthly_reports, advanced_reports,
  whatsapp_default, premium_templates, custom_domain, custom_colors, support_priority, multi_location_ready
) VALUES
  ('solo', 'Solo', 49.90, 499.00, 16.69, 1, true, 1, NULL, 0,
   false, false, false, false, false,
   false, 'basic', false,
   false, false, false, false, false, false,
   false, false, false, false, false, false),
  ('studio', 'Studio', 69.90, 699.00, 16.69, 3, true, 2, 'MAIS VENDIDO', 1,
   true, true, true, true, false,
   true, 'full', true,
   true, true, true, true, true, false,
   true, true, false, false, false, false),
  ('elite', 'Elite', 89.90, 899.00, 16.59, 10, true, 3, 'PREMIUM', 2,
   true, true, true, true, true,
   true, 'full', true,
   true, true, true, true, true, true,
   true, true, true, true, true, true)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  yearly_discount = EXCLUDED.yearly_discount,
  members_limit = EXCLUDED.members_limit,
  badge = EXCLUDED.badge,
  marketplace_priority = EXCLUDED.marketplace_priority,
  sort_order = EXCLUDED.sort_order,
  automatic_messages = EXCLUDED.automatic_messages,
  open_scheduling = EXCLUDED.open_scheduling,
  promotions = EXCLUDED.promotions,
  discount_coupons = EXCLUDED.discount_coupons,
  whitelabel = EXCLUDED.whitelabel,
  feature_requests = EXCLUDED.feature_requests,
  feature_financial_level = EXCLUDED.feature_financial_level,
  custom_branding = EXCLUDED.custom_branding,
  cashback = EXCLUDED.cashback,
  loyalty = EXCLUDED.loyalty,
  open_agenda = EXCLUDED.open_agenda,
  automation = EXCLUDED.automation,
  monthly_reports = EXCLUDED.monthly_reports,
  advanced_reports = EXCLUDED.advanced_reports,
  whatsapp_default = EXCLUDED.whatsapp_default,
  premium_templates = EXCLUDED.premium_templates,
  custom_domain = EXCLUDED.custom_domain,
  custom_colors = EXCLUDED.custom_colors,
  support_priority = EXCLUDED.support_priority,
  multi_location_ready = EXCLUDED.multi_location_ready,
  active = true,
  updated_at = now();

-- =========================================
-- 7. Auto-trial for NEW companies only
-- Liberates Studio plan for 7 days on creation
-- =========================================
CREATE OR REPLACE FUNCTION public.set_default_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_studio_id uuid;
BEGIN
  -- Only apply when trial fields are not explicitly set
  IF NEW.trial_active IS DISTINCT FROM true OR NEW.trial_end_date IS NULL THEN
    SELECT id INTO v_studio_id FROM public.plans WHERE slug = 'studio' LIMIT 1;

    NEW.trial_active := true;
    NEW.trial_plan_id := v_studio_id;
    NEW.trial_start_date := COALESCE(NEW.trial_start_date, now());
    NEW.trial_end_date := COALESCE(NEW.trial_end_date, now() + interval '7 days');
    NEW.subscription_status := COALESCE(NEW.subscription_status, 'trial'::subscription_status);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_default_trial ON public.companies;
CREATE TRIGGER trg_set_default_trial
  BEFORE INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.set_default_trial();