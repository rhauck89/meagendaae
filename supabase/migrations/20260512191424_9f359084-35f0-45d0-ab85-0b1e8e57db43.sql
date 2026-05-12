-- Allow public access to active subscription plans
CREATE POLICY "Public can view active subscription plans"
ON public.subscription_plans
FOR SELECT
USING (is_active = true);