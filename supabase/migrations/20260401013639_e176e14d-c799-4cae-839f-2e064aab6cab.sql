
-- Create company_domains table
CREATE TABLE public.company_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  ssl_status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

-- Enable RLS
ALTER TABLE public.company_domains ENABLE ROW LEVEL SECURITY;

-- Company admins can manage their domains
CREATE POLICY "Company admins can manage domains"
ON public.company_domains FOR ALL TO authenticated
USING (company_id = get_my_company_id() AND has_company_role(auth.uid(), company_id, 'professional'::app_role))
WITH CHECK (company_id = get_my_company_id() AND has_company_role(auth.uid(), company_id, 'professional'::app_role));

-- Super admins can manage all domains
CREATE POLICY "Super admins can manage domains"
ON public.company_domains FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public can read verified domains (for domain-based routing)
CREATE POLICY "Public can read verified domains"
ON public.company_domains FOR SELECT TO anon
USING (verified = true);

-- Updated at trigger
CREATE TRIGGER update_company_domains_updated_at
  BEFORE UPDATE ON public.company_domains
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
