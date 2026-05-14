-- supabase/migrations/20260514143600_a2ade48d-96dd-44cb-a9db-9d9a49fdfb73.sql
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_subscriptions' AND column_name = 'professional_id') THEN
        ALTER TABLE public.client_subscriptions ADD COLUMN professional_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

COMMENT ON COLUMN public.client_subscriptions.professional_id IS 'The professional responsible for this client subscription. Only this professional can be used with this subscription.';

-- supabase/migrations/20260514144110_a3cc7a9a-5c22-4813-9946-162b05be8400.sql
-- (Contains essential column additions if missing)
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS is_service_provider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS system_role text NOT NULL DEFAULT 'collaborator',
  ADD COLUMN IF NOT EXISTS salary_auto_expense boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS salary_amount numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS salary_next_due_date date,
  ADD COLUMN IF NOT EXISTS salary_recurrence text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS salary_payment_method text DEFAULT 'money',
  ADD COLUMN IF NOT EXISTS salary_expense_category_id uuid;

ALTER TABLE public.company_collaborators
  ADD COLUMN IF NOT EXISTS is_service_provider boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS permissions jsonb NOT NULL DEFAULT '{}'::jsonb;

-- supabase/migrations/20260514145913_a100785a-ee93-43e9-a624-4af60b85490e.sql
-- (Force professional context and panel mode)
UPDATE public.collaborators c
SET
  is_service_provider = false,
  commission_type = 'none',
  commission_value = 0,
  commission_percent = 0
WHERE c.system_role IN ('receptionist', 'manager', 'administrative', 'admin', 'admin_financeiro');

UPDATE public.company_collaborators cc
SET is_service_provider = false
WHERE cc.role IN ('receptionist', 'manager', 'administrative');

DROP VIEW IF EXISTS public.public_professionals;
CREATE VIEW public.public_professionals AS
SELECT
  p.id,
  p.full_name AS name,
  p.avatar_url,
  p.banner_url,
  p.bio,
  p.social_links,
  p.whatsapp,
  c.company_id,
  c.slug,
  c.active,
  c.booking_mode,
  c.grid_interval,
  c.break_time,
  c.is_service_provider
FROM public.profiles p
JOIN public.collaborators c ON c.profile_id = p.id
WHERE c.active = true
  AND c.is_service_provider = true;

GRANT SELECT ON public.public_professionals TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS TABLE (
  user_id uuid,
  profile_id uuid,
  full_name text,
  email text,
  company_id uuid,
  roles text[],
  is_owner boolean,
  is_collaborator boolean,
  login_mode text,
  permissions jsonb,
  is_service_provider boolean
) AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_full_name text;
  v_email text;
  v_company_id uuid;
  v_roles text[];
  v_is_owner boolean := false;
  v_is_collaborator boolean := false;
  v_login_mode text;
  v_permissions jsonb := '{}'::jsonb;
  v_is_service_provider boolean := true;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT p.id, p.full_name, p.company_id, p.last_login_mode
    INTO v_profile_id, v_full_name, v_company_id, v_login_mode
  FROM public.profiles p
  WHERE p.user_id = v_user_id LIMIT 1;

  SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;

  IF v_company_id IS NULL THEN
    SELECT c.id INTO v_company_id FROM public.companies c WHERE c.user_id = v_user_id ORDER BY c.created_at ASC NULLS LAST LIMIT 1;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT ur.role::text), ARRAY[]::text[]) INTO v_roles FROM public.user_roles ur WHERE ur.user_id = v_user_id;

  SELECT EXISTS (SELECT 1 FROM public.companies c WHERE c.user_id = v_user_id) INTO v_is_owner;

  IF v_profile_id IS NOT NULL THEN
    SELECT EXISTS (SELECT 1 FROM public.collaborators col WHERE col.profile_id = v_profile_id AND col.active = true) INTO v_is_collaborator;

    SELECT
      COALESCE(NULLIF(c.permissions, '{}'::jsonb), cc.permissions, '{}'::jsonb),
      COALESCE(c.is_service_provider, cc.is_service_provider, true)
      INTO v_permissions, v_is_service_provider
    FROM public.collaborators c
    LEFT JOIN public.company_collaborators cc ON cc.company_id = c.company_id AND cc.profile_id = c.profile_id AND cc.active = true
    WHERE c.profile_id = v_profile_id AND (c.company_id = v_company_id OR v_company_id IS NULL) AND c.active = true LIMIT 1;

    IF v_is_service_provider = false THEN v_login_mode := 'admin'; END IF;
  END IF;

  RETURN QUERY SELECT
    v_user_id, v_profile_id, v_full_name, v_email, v_company_id,
    COALESCE(v_roles, ARRAY[]::text[]), v_is_owner, v_is_collaborator,
    v_login_mode, COALESCE(v_permissions, '{}'::jsonb), COALESCE(v_is_service_provider, true);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO service_role;

-- supabase/migrations/20260514152000_marketplace_upgrade_modules.sql
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

ALTER TABLE public.plan_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view active modules" ON public.plan_modules;
CREATE POLICY "Public can view active modules" ON public.plan_modules FOR SELECT USING (active = true);

INSERT INTO public.plan_modules (name, slug, description, price_monthly, price_yearly, active, sort_order) VALUES
  ('Marketplace Destaque Médio', 'marketplace-featured-medium', 'Destaque intermediário no marketplace.', 29.90, 299.00, true, 10),
  ('Marketplace Destaque Máximo', 'marketplace-featured-max', 'Maior prioridade de exibição no marketplace.', 49.90, 499.00, true, 20)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name, description = EXCLUDED.description, price_monthly = EXCLUDED.price_monthly, price_yearly = EXCLUDED.price_yearly, active = EXCLUDED.active, sort_order = EXCLUDED.sort_order, updated_at = now();

-- supabase/migrations/20260514170000_fix_staff_salary_and_subscription_commissions.sql
ALTER TABLE public.professional_commissions DROP CONSTRAINT IF EXISTS professional_commissions_source_type_check;
ALTER TABLE public.professional_commissions ADD CONSTRAINT professional_commissions_source_type_check CHECK (source_type = ANY (ARRAY['service'::text, 'subscription'::text, 'subscription_charge'::text]));
ALTER TABLE public.professional_commissions DROP CONSTRAINT IF EXISTS professional_commissions_source_id_source_type_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'professional_commissions_source_id_source_type_prof_key') THEN
    ALTER TABLE public.professional_commissions ADD CONSTRAINT professional_commissions_source_id_source_type_prof_key UNIQUE (source_id, source_type, professional_id);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.handle_subscription_commission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_sub_info RECORD;
  v_total_commission numeric;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    SELECT cs.id, cs.professional_id, cs.professional_commission, cs.client_id, cs.company_id, sp.name AS plan_name
    INTO v_sub_info FROM public.client_subscriptions cs JOIN public.subscription_plans sp ON sp.id = cs.plan_id WHERE cs.id = NEW.subscription_id;
    IF v_sub_info.id IS NULL OR v_sub_info.professional_id IS NULL THEN RETURN NEW; END IF;
    v_total_commission := ROUND((NEW.amount * COALESCE(v_sub_info.professional_commission, 0)) / 100, 2);
    IF v_total_commission <= 0 THEN RETURN NEW; END IF;
    INSERT INTO public.professional_commissions (company_id, professional_id, client_id, source_type, source_id, description, gross_amount, commission_type, commission_rate, commission_amount, company_net_amount, paid_at, status)
    VALUES (v_sub_info.company_id, v_sub_info.professional_id, v_sub_info.client_id, 'subscription_charge', NEW.id, 'Comissão Assinatura: ' || v_sub_info.plan_name, NEW.amount, 'percentage', COALESCE(v_sub_info.professional_commission, 0), v_total_commission, NEW.amount - v_total_commission, COALESCE(NEW.paid_at, now()), 'paid')
    ON CONFLICT ON CONSTRAINT professional_commissions_source_id_source_type_prof_key DO UPDATE SET gross_amount = EXCLUDED.gross_amount, commission_rate = EXCLUDED.commission_rate, commission_amount = EXCLUDED.commission_amount, company_net_amount = EXCLUDED.company_net_amount, paid_at = EXCLUDED.paid_at, status = EXCLUDED.status, description = EXCLUDED.description, updated_at = now();
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_subscription_charge_paid ON public.subscription_charges;
CREATE TRIGGER on_subscription_charge_paid AFTER UPDATE ON public.subscription_charges FOR EACH ROW EXECUTE FUNCTION public.handle_subscription_commission();

CREATE OR REPLACE FUNCTION public.sync_staff_salary_expense()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $function$
DECLARE
  v_category_id uuid;
  v_existing_expense_id uuid;
  v_due_date date;
  v_member_name text;
  v_created_by uuid;
  v_source_token text;
BEGIN
  IF COALESCE(NEW.is_service_provider, true) = true OR COALESCE(NEW.salary_auto_expense, false) = false OR COALESCE(NEW.salary_amount, 0) <= 0 THEN RETURN NEW; END IF;
  SELECT id INTO v_category_id FROM public.company_expense_categories WHERE company_id = NEW.company_id AND name IN ('Salário', 'Salários', 'Salarios') ORDER BY created_at LIMIT 1;
  IF v_category_id IS NULL THEN
    INSERT INTO public.company_expense_categories (company_id, name, type, description) VALUES (NEW.company_id, 'Salários', 'expense', 'Despesas de salário') RETURNING id INTO v_category_id;
  END IF;
  SELECT full_name INTO v_member_name FROM public.profiles WHERE id = NEW.profile_id;
  SELECT user_id INTO v_created_by FROM public.companies WHERE id = NEW.company_id;
  v_due_date := COALESCE(NEW.salary_next_due_date, CURRENT_DATE);
  v_source_token := 'salary_profile_id:' || NEW.profile_id::text;
  SELECT id INTO v_existing_expense_id FROM public.company_expenses WHERE company_id = NEW.company_id AND notes ILIKE '%' || v_source_token || '%' LIMIT 1;
  IF v_existing_expense_id IS NULL THEN
    INSERT INTO public.company_expenses (company_id, description, amount, expense_date, due_date, status, category_id, is_recurring, recurrence_type, recurrence_interval, notes, created_by, payment_method)
    VALUES (NEW.company_id, 'Salário - ' || COALESCE(v_member_name, 'Membro da equipe'), NEW.salary_amount, v_due_date, v_due_date, 'pending', v_category_id, COALESCE(NEW.salary_recurrence, 'monthly') <> 'none', CASE WHEN NEW.salary_recurrence = 'weekly' THEN 'weekly' ELSE 'monthly' END, CASE WHEN NEW.salary_recurrence = 'biweekly' THEN 2 ELSE 1 END, 'Despesa gerada automaticamente. ' || v_source_token, v_created_by, NEW.salary_payment_method);
  ELSE
    UPDATE public.company_expenses SET description = 'Salário - ' || COALESCE(v_member_name, 'Membro da equipe'), amount = NEW.salary_amount, expense_date = v_due_date, due_date = v_due_date, category_id = v_category_id, is_recurring = COALESCE(NEW.salary_recurrence, 'monthly') <> 'none', recurrence_type = CASE WHEN NEW.salary_recurrence = 'weekly' THEN 'weekly' ELSE 'monthly' END, recurrence_interval = CASE WHEN NEW.salary_recurrence = 'biweekly' THEN 2 ELSE 1 END, payment_method = NEW.salary_payment_method, updated_at = now() WHERE id = v_existing_expense_id;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS on_staff_salary_expense_sync ON public.collaborators;
CREATE TRIGGER on_staff_salary_expense_sync AFTER INSERT OR UPDATE OF is_service_provider, salary_auto_expense, salary_amount, salary_next_due_date, salary_recurrence, salary_payment_method ON public.collaborators FOR EACH ROW EXECUTE FUNCTION public.sync_staff_salary_expense();
