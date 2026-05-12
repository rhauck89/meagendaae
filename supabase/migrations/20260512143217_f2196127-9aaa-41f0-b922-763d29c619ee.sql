-- Add identity columns to reviews table if they don't exist
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_avatar text;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_phone text;
