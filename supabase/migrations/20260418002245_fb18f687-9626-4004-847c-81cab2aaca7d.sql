-- Fix: public_professionals view was running with security_invoker=on,
-- which forced anonymous users to satisfy RLS on the underlying profiles
-- and collaborators tables. Those tables have no anon SELECT policies,
-- so the view returned 0 rows on the public booking page.
--
-- Switch the view to security definer (security_invoker=off) so it runs
-- with the view owner's privileges. The view already restricts output to
-- non-sensitive columns (id, name, avatar, banner, bio, social_links,
-- whatsapp, company_id, slug, active, booking_mode, grid_interval,
-- break_time) and only exposes active collaborators (c.active = true).

ALTER VIEW public.public_professionals SET (security_invoker = off);

-- Ensure anon and authenticated can read the view explicitly.
GRANT SELECT ON public.public_professionals TO anon, authenticated;