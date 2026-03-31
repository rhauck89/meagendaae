-- Allow appointment_id to be nullable for general company reviews
ALTER TABLE public.reviews ALTER COLUMN appointment_id DROP NOT NULL;

-- Drop the unique constraint on appointment_id to allow multiple non-appointment reviews
-- First check and drop if exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_appointment_id_fkey') THEN
    -- Keep foreign key but it will allow NULLs now
    NULL;
  END IF;
END$$;
