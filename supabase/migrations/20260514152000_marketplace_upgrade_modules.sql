-- Marketplace upgrade add-ons.
-- Every company keeps marketplace basic included; these modules only add paid highlight.

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
CREATE POLICY "Public can view active modules"
  ON public.plan_modules FOR SELECT
  USING (active = true);

DROP POLICY IF EXISTS "Super admins can manage modules" ON public.plan_modules;
CREATE POLICY "Super admins can manage modules"
  ON public.plan_modules FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

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

DROP POLICY IF EXISTS "Company members can request own modules" ON public.company_modules;
CREATE POLICY "Company members can request own modules"
  ON public.company_modules FOR INSERT
  TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND status IN ('interested', 'pending_checkout')
  );

DROP POLICY IF EXISTS "Company members can update own module requests" ON public.company_modules;
CREATE POLICY "Company members can update own module requests"
  ON public.company_modules FOR UPDATE
  TO authenticated
  USING (
    company_id = get_my_company_id()
    AND status IN ('interested', 'pending_checkout')
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND status IN ('interested', 'pending_checkout')
  );

INSERT INTO public.plan_modules (
  name,
  slug,
  description,
  price_monthly,
  price_yearly,
  active,
  sort_order
) VALUES
  (
    'Marketplace Destaque Médio',
    'marketplace-featured-medium',
    'Destaque intermediário no marketplace, com mais prioridade que a listagem básica.',
    29.90,
    299.00,
    true,
    10
  ),
  (
    'Marketplace Destaque Máximo',
    'marketplace-featured-max',
    'Maior prioridade de exibição no marketplace para empresas que querem mais visibilidade.',
    49.90,
    499.00,
    true,
    20
  )
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  active = EXCLUDED.active,
  sort_order = EXCLUDED.sort_order,
  stripe_product_id = COALESCE(public.plan_modules.stripe_product_id, EXCLUDED.stripe_product_id),
  stripe_monthly_price_id = COALESCE(public.plan_modules.stripe_monthly_price_id, EXCLUDED.stripe_monthly_price_id),
  stripe_yearly_price_id = COALESCE(public.plan_modules.stripe_yearly_price_id, EXCLUDED.stripe_yearly_price_id),
  updated_at = now();
