
-- Add birthday settings to companies
ALTER TABLE public.companies 
  ADD COLUMN IF NOT EXISTS birthday_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS birthday_discount_type text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS birthday_discount_value numeric NOT NULL DEFAULT 0;
