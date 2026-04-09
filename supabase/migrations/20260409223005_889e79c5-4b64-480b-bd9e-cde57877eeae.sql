
-- Loyalty program configuration per company
CREATE TABLE public.loyalty_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  scoring_type text NOT NULL DEFAULT 'per_service' CHECK (scoring_type IN ('per_service', 'per_value')),
  points_per_service integer NOT NULL DEFAULT 10,
  points_per_currency numeric NOT NULL DEFAULT 1,
  participating_services text NOT NULL DEFAULT 'all' CHECK (participating_services IN ('all', 'specific')),
  participating_professionals text NOT NULL DEFAULT 'all' CHECK (participating_professionals IN ('all', 'specific')),
  specific_service_ids uuid[] NOT NULL DEFAULT '{}',
  specific_professional_ids uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.loyalty_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage loyalty config"
  ON public.loyalty_config FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Reward items for redemption
CREATE TABLE public.loyalty_reward_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text,
  item_type text NOT NULL DEFAULT 'service' CHECK (item_type IN ('product', 'service', 'discount')),
  points_required integer NOT NULL DEFAULT 100,
  extra_cost numeric NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_reward_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage reward items"
  ON public.loyalty_reward_items FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Public can view active reward items"
  ON public.loyalty_reward_items FOR SELECT TO public
  USING (active = true);

-- Points transactions ledger
CREATE TABLE public.loyalty_points_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  points integer NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('earn', 'redeem', 'expire', 'cancel')),
  reference_type text,
  reference_id uuid,
  description text,
  balance_after integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_points_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage points transactions"
  ON public.loyalty_points_transactions FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE INDEX idx_loyalty_pts_client ON public.loyalty_points_transactions(company_id, client_id);
CREATE INDEX idx_loyalty_pts_created ON public.loyalty_points_transactions(company_id, created_at DESC);

-- Redemption requests
CREATE TABLE public.loyalty_redemptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  redemption_code text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled')),
  total_points integer NOT NULL,
  items jsonb NOT NULL DEFAULT '[]',
  confirmed_at timestamptz,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(redemption_code)
);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage redemptions"
  ON public.loyalty_redemptions FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE INDEX idx_loyalty_redemptions_code ON public.loyalty_redemptions(redemption_code);
CREATE INDEX idx_loyalty_redemptions_client ON public.loyalty_redemptions(company_id, client_id);
