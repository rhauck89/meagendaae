
DROP VIEW IF EXISTS public.public_services;

CREATE VIEW public.public_services AS
SELECT
  s.id,
  s.name,
  s.price,
  s.duration_minutes,
  s.company_id
FROM services s
WHERE s.active = true;

GRANT SELECT ON public.public_services TO anon, authenticated;
