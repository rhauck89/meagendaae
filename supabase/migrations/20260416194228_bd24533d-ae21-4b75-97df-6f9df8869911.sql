-- 1. Harden public views: enforce security_invoker so caller's RLS applies.
ALTER VIEW public.public_company SET (security_invoker = on);
ALTER VIEW public.public_company_view SET (security_invoker = on);
ALTER VIEW public.public_company_settings SET (security_invoker = on);
ALTER VIEW public.public_blocked_times SET (security_invoker = on);
ALTER VIEW public.public_professionals SET (security_invoker = on);
ALTER VIEW public.public_promotions SET (security_invoker = on);
ALTER VIEW public.public_services SET (security_invoker = on);
ALTER VIEW public.companies_billing SET (security_invoker = on);

-- 2. Enforce client identity uniqueness per company (whatsapp + email).
-- Partial unique indexes so NULL/empty values are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS clients_company_whatsapp_unique
  ON public.clients (company_id, whatsapp)
  WHERE whatsapp IS NOT NULL AND whatsapp <> '';

CREATE UNIQUE INDEX IF NOT EXISTS clients_company_email_unique
  ON public.clients (company_id, lower(email))
  WHERE email IS NOT NULL AND email <> '';

-- 3. Helpful index for fast lookup by user_id (Client Portal queries).
CREATE INDEX IF NOT EXISTS clients_user_id_idx ON public.clients (user_id) WHERE user_id IS NOT NULL;