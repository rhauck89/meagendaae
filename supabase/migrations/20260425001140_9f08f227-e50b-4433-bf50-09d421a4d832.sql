-- Add new columns to appointments table
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS extra_fee_type TEXT,
ADD COLUMN IF NOT EXISTS extra_fee_value NUMERIC,
ADD COLUMN IF NOT EXISTS final_price NUMERIC;

-- Ensure special_schedule and extra_fee are available (they seem to exist but let's be sure)
-- These are already present based on earlier check.

-- Update RLS policies if needed (usually columns are covered by existing table-level policies)
