
-- 1. Add buffer_minutes to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0;

-- 2. Add slug to collaborators for professional booking links
ALTER TABLE public.collaborators ADD COLUMN IF NOT EXISTS slug text;

-- 3. Create professional_working_hours table
CREATE TABLE IF NOT EXISTS public.professional_working_hours (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time time NOT NULL DEFAULT '09:00',
  close_time time NOT NULL DEFAULT '18:00',
  lunch_start time,
  lunch_end time,
  is_closed boolean NOT NULL DEFAULT false,
  UNIQUE(professional_id, day_of_week)
);

ALTER TABLE public.professional_working_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view professional hours"
  ON public.professional_working_hours FOR SELECT
  TO public USING (true);

CREATE POLICY "Professionals can manage own hours"
  ON public.professional_working_hours FOR ALL
  TO authenticated USING (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
  );

-- 4. Add price_override to service_professionals
ALTER TABLE public.service_professionals ADD COLUMN IF NOT EXISTS price_override numeric;
ALTER TABLE public.service_professionals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);
