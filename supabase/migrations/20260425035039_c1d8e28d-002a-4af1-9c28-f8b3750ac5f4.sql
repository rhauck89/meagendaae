-- Add user_id to critical tables
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.cashback_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.loyalty_points_transactions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.client_cashback ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
ALTER TABLE public.loyalty_redemptions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- Backfill user_id from clients table where possible
UPDATE public.appointments a SET user_id = c.user_id FROM public.clients c WHERE a.client_id = c.id AND c.user_id IS NOT NULL;
UPDATE public.cashback_transactions t SET user_id = c.user_id FROM public.clients c WHERE t.client_id = c.id AND c.user_id IS NOT NULL;
UPDATE public.loyalty_points_transactions t SET user_id = c.user_id FROM public.clients c WHERE t.client_id = c.id AND c.user_id IS NOT NULL;
UPDATE public.client_cashback t SET user_id = c.user_id FROM public.clients c WHERE t.client_id = c.id AND c.user_id IS NOT NULL;
UPDATE public.loyalty_redemptions t SET user_id = c.user_id FROM public.clients c WHERE t.client_id = c.id AND c.user_id IS NOT NULL;

-- Enable RLS and create strict policies
-- Appointments
DROP POLICY IF EXISTS "appointments_client_select" ON public.appointments;
CREATE POLICY "appointments_client_select" ON public.appointments FOR SELECT USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "appointments_client_insert" ON public.appointments;
CREATE POLICY "appointments_client_insert" ON public.appointments FOR INSERT WITH CHECK (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "appointments_client_update" ON public.appointments;
CREATE POLICY "appointments_client_update" ON public.appointments FOR UPDATE USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Cashback Transactions
DROP POLICY IF EXISTS "Clients can view their own cashback transactions" ON public.cashback_transactions;
CREATE POLICY "Clients can view their own cashback transactions" ON public.cashback_transactions FOR SELECT USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Client Cashback (balances)
DROP POLICY IF EXISTS "Clients can view own cashback" ON public.client_cashback;
CREATE POLICY "Clients can view own cashback" ON public.client_cashback FOR SELECT USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Loyalty Points Transactions
DROP POLICY IF EXISTS "Clients can view own loyalty transactions" ON public.loyalty_points_transactions;
CREATE POLICY "Clients can view own loyalty transactions" ON public.loyalty_points_transactions FOR SELECT USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Loyalty Redemptions
DROP POLICY IF EXISTS "Clients can view own redemptions" ON public.loyalty_redemptions;
CREATE POLICY "Clients can view own redemptions" ON public.loyalty_redemptions FOR SELECT USING (user_id = auth.uid() OR client_id IN (SELECT id FROM clients WHERE user_id = auth.uid()));

-- Triggers to automatically set user_id on insert if possible
CREATE OR REPLACE FUNCTION public.set_user_id_from_client()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL AND NEW.client_id IS NOT NULL THEN
    SELECT user_id INTO NEW.user_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_appointments_set_user_id ON public.appointments;
CREATE TRIGGER tr_appointments_set_user_id BEFORE INSERT ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_client();

DROP TRIGGER IF EXISTS tr_cashback_tx_set_user_id ON public.cashback_transactions;
CREATE TRIGGER tr_cashback_tx_set_user_id BEFORE INSERT ON public.cashback_transactions FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_client();

DROP TRIGGER IF EXISTS tr_loyalty_tx_set_user_id ON public.loyalty_points_transactions;
CREATE TRIGGER tr_loyalty_tx_set_user_id BEFORE INSERT ON public.loyalty_points_transactions FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_client();
