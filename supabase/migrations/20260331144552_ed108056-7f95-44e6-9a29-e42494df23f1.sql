DROP VIEW IF EXISTS public.public_professionals;
CREATE VIEW public.public_professionals WITH (security_barrier = true) AS
SELECT
  p.id,
  p.full_name AS name,
  p.avatar_url,
  p.banner_url,
  c.company_id,
  c.slug,
  c.active
FROM profiles p
JOIN collaborators c ON c.profile_id = p.id
WHERE c.active = true;