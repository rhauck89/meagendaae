
-- 1. Drop overly permissive public SELECT on clients
DROP POLICY IF EXISTS "Public can view clients" ON public.clients;

-- 2. Drop overly permissive public SELECT on appointments
DROP POLICY IF EXISTS "Public can view own guest appointments" ON public.appointments;

-- 3. Create a safe public view for booking page (no PII)
CREATE OR REPLACE VIEW public.public_professionals AS
SELECT
  p.id,
  p.full_name AS name,
  p.avatar_url,
  c.company_id,
  c.slug,
  c.active
FROM public.profiles p
JOIN public.collaborators c ON c.profile_id = p.id
WHERE c.active = true;

-- 4. Grant public access to the view
GRANT SELECT ON public.public_professionals TO anon;
GRANT SELECT ON public.public_professionals TO authenticated;
