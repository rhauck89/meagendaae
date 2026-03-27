
-- Create company_settings table
CREATE TABLE public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'America/Sao_Paulo',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#6D28D9',
  secondary_color text NOT NULL DEFAULT '#F59E0B',
  whatsapp_number text,
  booking_buffer_minutes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- Authenticated company members can view their settings
CREATE POLICY "Company members can view settings" ON public.company_settings
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- Authenticated company members can insert settings
CREATE POLICY "Company members can insert settings" ON public.company_settings
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

-- Authenticated company members can update settings
CREATE POLICY "Company members can update settings" ON public.company_settings
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id());

-- Authenticated company members can delete settings
CREATE POLICY "Company members can delete settings" ON public.company_settings
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- Public can view settings for booking branding
CREATE POLICY "Public can view company settings" ON public.company_settings
  FOR SELECT TO public
  USING (true);

-- Updated_at trigger
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create settings when company is created
CREATE OR REPLACE FUNCTION public.auto_create_company_settings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.company_settings (company_id, timezone, whatsapp_number)
  VALUES (NEW.id, NEW.timezone, NEW.phone)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_company_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_company_settings();

-- Performance index
CREATE INDEX idx_company_settings_company ON public.company_settings(company_id);
