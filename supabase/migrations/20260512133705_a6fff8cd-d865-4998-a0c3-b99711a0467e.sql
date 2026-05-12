-- Enable RLS on the reviews table if not already enabled
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they might conflict (optional, but safer if we know the names or want to be clean)
-- DROP POLICY IF EXISTS "Public can insert reviews" ON public.reviews;
-- DROP POLICY IF EXISTS "Anyone can view reviews" ON public.reviews;

-- Create policy for public/anonymous inserts
CREATE POLICY "Public can insert reviews"
ON public.reviews
FOR INSERT
TO anon, authenticated
WITH CHECK (
    company_id IS NOT NULL
);

-- Create policy for public viewing
CREATE POLICY "Anyone can view reviews"
ON public.reviews
FOR SELECT
TO anon, authenticated
USING (true);
