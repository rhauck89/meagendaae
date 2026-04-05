DROP VIEW IF EXISTS public.public_professionals;
CREATE VIEW public.public_professionals AS
SELECT p.id,
    p.full_name AS name,
    p.avatar_url,
    p.banner_url,
    p.bio,
    p.social_links,
    p.whatsapp,
    c.company_id,
    c.slug,
    c.active,
    c.booking_mode,
    c.grid_interval,
    c.break_time
FROM profiles p
JOIN collaborators c ON c.profile_id = p.id
WHERE c.active = true;