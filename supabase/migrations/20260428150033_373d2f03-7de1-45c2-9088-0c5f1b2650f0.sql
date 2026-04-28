-- 1. Create the global clients table
CREATE TABLE IF NOT EXISTS public.clients_global (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), -- Optional link to auth
  name TEXT,
  whatsapp TEXT UNIQUE,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create the relationship table between global clients and companies
CREATE TABLE IF NOT EXISTS public.client_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_global_id UUID REFERENCES public.clients_global(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE (client_global_id, company_id)
);

-- 3. Enable RLS
ALTER TABLE public.clients_global ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_companies ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for clients_global
CREATE POLICY "Users can view their own global profile" 
ON public.clients_global 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Company members can view global clients linked to their company" 
ON public.clients_global 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.client_companies 
    WHERE client_global_id = public.clients_global.id 
    AND company_id = public.get_my_company_id()
  )
);

-- 5. RLS Policies for client_companies
CREATE POLICY "Company members can manage client links" 
ON public.client_companies 
FOR ALL 
USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can view their own company links" 
ON public.client_companies 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.clients_global 
    WHERE id = client_global_id 
    AND user_id = auth.uid()
  )
);

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_clients_global
BEFORE UPDATE ON public.clients_global
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
