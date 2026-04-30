-- Public profile pages must render the same way for anonymous visitors and
-- authenticated admins/professionals. Keep the public read-only views running
-- as security definer views and explicitly grant both web roles access.

ALTER VIEW IF EXISTS public.public_company SET (security_invoker = off);
ALTER VIEW IF EXISTS public.public_company_settings SET (security_invoker = off);
ALTER VIEW IF EXISTS public.public_professionals SET (security_invoker = off);

GRANT SELECT ON public.public_company TO anon, authenticated;
GRANT SELECT ON public.public_company_settings TO anon, authenticated;
GRANT SELECT ON public.public_professionals TO anon, authenticated;
