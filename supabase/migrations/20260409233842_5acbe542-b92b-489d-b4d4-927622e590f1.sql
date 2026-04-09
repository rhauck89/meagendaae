
-- Add user_id to clients table so clients can link their auth account
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Add registration_complete flag
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS registration_complete boolean NOT NULL DEFAULT false;

-- Create unique index: one user_id per company
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_user_company ON public.clients(user_id, company_id) WHERE user_id IS NOT NULL;

-- RLS: Authenticated clients can view their own client records across companies
CREATE POLICY "Clients can view own records"
ON public.clients
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS: Authenticated clients can update their own client records
CREATE POLICY "Clients can update own records"
ON public.clients
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- RLS: Clients can view their own cashback records
CREATE POLICY "Clients can view own cashback"
ON public.client_cashback
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- RLS: Clients can view their own loyalty transactions
CREATE POLICY "Clients can view own loyalty transactions"
ON public.loyalty_points_transactions
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- RLS: Clients can view their own redemptions
CREATE POLICY "Clients can view own redemptions"
ON public.loyalty_redemptions
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- RLS: Clients can insert redemptions for themselves
CREATE POLICY "Clients can create own redemptions"
ON public.loyalty_redemptions
FOR INSERT
TO authenticated
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- Function to link a client record to an auth user by phone
CREATE OR REPLACE FUNCTION public.link_client_to_user(p_user_id uuid, p_phone text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.clients
  SET user_id = p_user_id
  WHERE whatsapp = p_phone
    AND user_id IS NULL;
END;
$$;

-- Function to check if client registration is complete
CREATE OR REPLACE FUNCTION public.check_client_registration(p_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    c.name IS NOT NULL AND c.name != '' AND
    c.whatsapp IS NOT NULL AND c.whatsapp != '' AND
    c.email IS NOT NULL AND c.email != '' AND
    c.birth_date IS NOT NULL
  )
  FROM public.clients c
  WHERE c.id = p_client_id;
$$;
