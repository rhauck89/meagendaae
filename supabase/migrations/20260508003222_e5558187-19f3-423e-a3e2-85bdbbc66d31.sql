-- Corrigir RLS para subscription_plans
DROP POLICY IF EXISTS "Users can view their company's subscription plans" ON subscription_plans;
DROP POLICY IF EXISTS "Users can manage their company's subscription plans" ON subscription_plans;

CREATE POLICY "Users can view their company's subscription plans"
ON subscription_plans FOR SELECT
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

CREATE POLICY "Admins can manage their company's subscription plans"
ON subscription_plans FOR ALL
USING (is_admin(auth.uid(), company_id))
WITH CHECK (is_admin(auth.uid(), company_id));

-- Corrigir RLS para client_subscriptions
DROP POLICY IF EXISTS "Users can view their company's client subscriptions" ON client_subscriptions;
DROP POLICY IF EXISTS "Users can manage their company's client subscriptions" ON client_subscriptions;

CREATE POLICY "Users can view their company's client subscriptions"
ON client_subscriptions FOR SELECT
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

CREATE POLICY "Users can manage their company's client subscriptions"
ON client_subscriptions FOR ALL
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id))
WITH CHECK (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

-- Corrigir RLS para subscription_charges
DROP POLICY IF EXISTS "Users can view their company's subscription charges" ON subscription_charges;
DROP POLICY IF EXISTS "Users can manage their company's subscription charges" ON subscription_charges;

CREATE POLICY "Users can view their company's subscription charges"
ON subscription_charges FOR SELECT
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

CREATE POLICY "Users can manage their company's subscription charges"
ON subscription_charges FOR ALL
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id))
WITH CHECK (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

-- Corrigir RLS para subscription_usage
DROP POLICY IF EXISTS "Users can view their company's subscription usage" ON subscription_usage;
DROP POLICY IF EXISTS "Users can manage their company's subscription usage" ON subscription_usage;

CREATE POLICY "Users can view their company's subscription usage"
ON subscription_usage FOR SELECT
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));

CREATE POLICY "Users can manage their company's subscription usage"
ON subscription_usage FOR ALL
USING (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id))
WITH CHECK (company_id = get_my_company_id() OR is_admin(auth.uid(), company_id));
