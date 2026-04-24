ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS use_business_hours BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS valid_days INTEGER[] DEFAULT '{0,1,2,3,4,5,6}',
ADD COLUMN IF NOT EXISTS min_interval_minutes INTEGER DEFAULT 0;

COMMENT ON COLUMN public.promotions.valid_days IS '0=Sunday, 1=Monday, ..., 6=Saturday';