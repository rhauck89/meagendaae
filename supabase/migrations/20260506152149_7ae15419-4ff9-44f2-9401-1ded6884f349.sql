-- Add public select policy for loyalty_config
CREATE POLICY "Public can view loyalty config"
  ON public.loyalty_config FOR SELECT TO public
  USING (enabled = true);
