
-- Fix: set view to SECURITY INVOKER (safe - uses querying user's permissions)
ALTER VIEW public.public_professionals SET (security_invoker = on);
