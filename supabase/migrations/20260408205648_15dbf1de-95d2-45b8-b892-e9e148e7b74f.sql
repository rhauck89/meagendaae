-- Add cashback fields to promotions
ALTER TABLE public.promotions
ADD COLUMN promotion_type text NOT NULL DEFAULT 'traditional',
ADD COLUMN cashback_validity_days integer DEFAULT NULL,
ADD COLUMN cashback_rules_text text DEFAULT NULL,
ADD COLUMN cashback_cumulative boolean NOT NULL DEFAULT false;

-- Create client_cashback table
CREATE TABLE public.client_cashback (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamp with time zone NOT NULL,
  used_at timestamp with time zone DEFAULT NULL,
  used_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_cashback ENABLE ROW LEVEL SECURITY;

-- Company members can manage cashback
CREATE POLICY "Company members can manage cashback"
ON public.client_cashback
FOR ALL
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Index for fast lookups
CREATE INDEX idx_client_cashback_client ON public.client_cashback(client_id, status);
CREATE INDEX idx_client_cashback_company ON public.client_cashback(company_id);
CREATE INDEX idx_client_cashback_expires ON public.client_cashback(expires_at) WHERE status = 'active';