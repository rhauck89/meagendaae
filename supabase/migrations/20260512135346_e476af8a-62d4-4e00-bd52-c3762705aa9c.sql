-- Make professional_id nullable in reviews table
ALTER TABLE public.reviews 
ALTER COLUMN professional_id DROP NOT NULL;

-- Ensure RLS policies still work as expected (previous policies were based on company_id mostly)
-- No changes needed to policies if they don't explicitly require professional_id to be non-null.
