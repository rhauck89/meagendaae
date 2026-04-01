
-- Create plans table
CREATE TABLE public.plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  members_limit integer NOT NULL DEFAULT 1,
  services_limit integer NOT NULL DEFAULT 10,
  appointments_limit integer NOT NULL DEFAULT 100,
  whatsapp_reminders boolean NOT NULL DEFAULT false,
  advanced_reports boolean NOT NULL DEFAULT false,
  multi_location boolean NOT NULL DEFAULT false,
  custom_branding boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Everyone can read active plans (for pricing pages etc.)
CREATE POLICY "Public can view active plans"
  ON public.plans FOR SELECT
  TO public
  USING (active = true);

-- Super admins can do everything
CREATE POLICY "Super admins can manage plans"
  ON public.plans FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add plan_id column to companies table
ALTER TABLE public.companies ADD COLUMN plan_id uuid REFERENCES public.plans(id);
