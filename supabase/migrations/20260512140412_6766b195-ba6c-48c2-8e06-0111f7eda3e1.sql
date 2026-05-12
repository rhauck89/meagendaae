-- Add new columns to reviews table
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS reviewer_name TEXT,
ADD COLUMN IF NOT EXISTS reviewer_avatar TEXT,
ADD COLUMN IF NOT EXISTS reviewer_phone TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[];

-- Update RLS policies (re-creating to be sure)
DROP POLICY IF EXISTS "Anyone can insert reviews" ON public.reviews;
CREATE POLICY "Anyone can insert reviews" 
ON public.reviews 
FOR INSERT 
WITH CHECK (company_id IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;
CREATE POLICY "Anyone can view reviews" 
ON public.reviews 
FOR SELECT 
USING (true);
