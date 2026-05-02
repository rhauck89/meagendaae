-- Add new columns to service_professionals
ALTER TABLE public.service_professionals 
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS duration_override INTEGER;

-- Ensure unique constraint for company_id, professional_id, service_id
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'service_professionals_company_professional_service_key'
    ) THEN
        ALTER TABLE public.service_professionals 
        ADD CONSTRAINT service_professionals_company_professional_service_key 
        UNIQUE (company_id, professional_id, service_id);
    END IF;
END $$;

-- Update RLS Policies for service_professionals
DROP POLICY IF EXISTS "Staff can manage service professionals" ON public.service_professionals;

-- Admins can manage everything in their company
CREATE POLICY "Admins can manage all service professionals"
ON public.service_professionals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND (p.role = 'admin' OR p.role = 'super_admin' OR p.role = 'company')
    AND p.company_id = service_professionals.company_id
  )
);

-- Professionals can manage their own records
CREATE POLICY "Professionals can manage their own services"
ON public.service_professionals
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.id = service_professionals.professional_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = auth.uid() 
    AND p.id = service_professionals.professional_id
  )
);
