-- Drop duplicate insert policy
DROP POLICY IF EXISTS "Public can register clients" ON clients;

-- Add scoped public SELECT for client lookup by CPF or WhatsApp (returns only id)
CREATE POLICY "Public can lookup client by identifier"
ON clients
FOR SELECT
TO anon
USING (false);

-- Create a security definer function for safe client lookup
CREATE OR REPLACE FUNCTION public.lookup_client_by_cpf(_company_id uuid, _cpf text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients
  WHERE company_id = _company_id AND cpf = _cpf
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.lookup_client_by_whatsapp(_company_id uuid, _whatsapp text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.clients
  WHERE company_id = _company_id AND whatsapp = _whatsapp
  LIMIT 1;
$$;