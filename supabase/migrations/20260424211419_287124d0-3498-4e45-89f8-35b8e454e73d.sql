ALTER TABLE public.promotions 
ADD COLUMN IF NOT EXISTS promotion_mode TEXT DEFAULT 'manual',
ADD COLUMN IF NOT EXISTS source_insight TEXT;