
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS feature_requests boolean NOT NULL DEFAULT false;
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS feature_financial_level text NOT NULL DEFAULT 'none';
