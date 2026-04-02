ALTER TABLE public.company_revenues ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL;
ALTER TABLE public.company_expenses ADD COLUMN IF NOT EXISTS payment_method text DEFAULT NULL;