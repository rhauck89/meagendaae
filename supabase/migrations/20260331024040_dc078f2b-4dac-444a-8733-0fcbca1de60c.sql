
-- Platform settings table for super admin white-label config
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_name text NOT NULL DEFAULT 'AgendaPro',
  system_logo text,
  system_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage platform settings
CREATE POLICY "Super admins can manage platform settings"
  ON public.platform_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Public can read platform settings (needed for footer branding)
CREATE POLICY "Public can view platform settings"
  ON public.platform_settings
  FOR SELECT
  TO public
  USING (true);

-- Insert default row
INSERT INTO public.platform_settings (system_name, system_url)
VALUES ('AgendaPro', NULL);

-- Trigger for updated_at
CREATE TRIGGER update_platform_settings_updated_at
  BEFORE UPDATE ON public.platform_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
