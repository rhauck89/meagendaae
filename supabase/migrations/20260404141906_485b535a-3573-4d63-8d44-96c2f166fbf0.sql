-- Add allow_custom_requests to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS allow_custom_requests boolean NOT NULL DEFAULT false;

-- Create appointment_requests table
CREATE TABLE public.appointment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  professional_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  client_whatsapp text NOT NULL,
  requested_date date NOT NULL,
  requested_time time without time zone NOT NULL,
  message text,
  status text NOT NULL DEFAULT 'pending',
  suggested_time time without time zone,
  suggested_date date,
  rejection_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

-- Company members can view and manage requests
CREATE POLICY "Company members can manage appointment requests"
ON public.appointment_requests
FOR ALL
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Public can create requests (for unauthenticated booking page visitors)
CREATE POLICY "Public can create appointment requests"
ON public.appointment_requests
FOR INSERT
TO anon
WITH CHECK (true);

-- Public can view own request by id (for status checking)
CREATE POLICY "Public can view own requests"
ON public.appointment_requests
FOR SELECT
TO anon
USING (true);