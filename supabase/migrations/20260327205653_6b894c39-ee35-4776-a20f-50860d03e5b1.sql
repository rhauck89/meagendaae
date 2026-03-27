
-- Create clients table for lightweight public registration
CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  cpf text,
  email text,
  whatsapp text,
  opt_in_whatsapp boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Public can insert clients (registration during booking)
CREATE POLICY "Public can register clients"
ON public.clients FOR INSERT TO public
WITH CHECK (name IS NOT NULL AND company_id IS NOT NULL);

-- Public can view client by id (for localStorage lookup)
CREATE POLICY "Public can view clients"
ON public.clients FOR SELECT TO public
USING (true);

-- Authenticated company members can manage clients
CREATE POLICY "Company members can manage clients"
ON public.clients FOR ALL TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Create unique index on cpf per company (when cpf is provided)
CREATE UNIQUE INDEX idx_clients_company_cpf ON public.clients(company_id, cpf) WHERE cpf IS NOT NULL;

-- Create index on whatsapp per company
CREATE INDEX idx_clients_company_whatsapp ON public.clients(company_id, whatsapp);
