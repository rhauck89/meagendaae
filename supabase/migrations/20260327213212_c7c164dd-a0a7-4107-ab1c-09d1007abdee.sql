
-- 1. Create public_services view (safe, no sensitive data)
CREATE OR REPLACE VIEW public.public_services WITH (security_invoker = on) AS
SELECT
  s.id,
  s.company_id,
  s.name,
  s.price,
  s.duration_minutes
FROM public.services s
WHERE s.active = true;

-- Grant access to the view
GRANT SELECT ON public.public_services TO anon;
GRANT SELECT ON public.public_services TO authenticated;

-- 2. Remove public SELECT policy on profiles that exposes PII
DROP POLICY IF EXISTS "Public can view professional profiles" ON public.profiles;

-- 3. Add missing indexes for multi-tenant performance
CREATE INDEX IF NOT EXISTS idx_blocked_times_company ON public.blocked_times(company_id);
CREATE INDEX IF NOT EXISTS idx_business_exceptions_company ON public.business_exceptions(company_id);
