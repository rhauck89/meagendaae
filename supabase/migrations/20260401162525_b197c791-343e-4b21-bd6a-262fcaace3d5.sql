
-- Add new feature toggles
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS automatic_messages boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS open_scheduling boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS promotions boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS discount_coupons boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whitelabel boolean NOT NULL DEFAULT false;

-- Remove old limits and features
ALTER TABLE public.plans
  DROP COLUMN IF EXISTS services_limit,
  DROP COLUMN IF EXISTS appointments_limit,
  DROP COLUMN IF EXISTS whatsapp_reminders,
  DROP COLUMN IF EXISTS advanced_reports,
  DROP COLUMN IF EXISTS multi_location,
  DROP COLUMN IF EXISTS custom_branding;
