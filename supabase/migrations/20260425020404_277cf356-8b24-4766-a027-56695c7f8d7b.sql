-- Add financial transparency columns to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS original_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS promotion_discount NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS cashback_used NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS manual_discount NUMERIC DEFAULT 0;

-- Update existing records: if final_price is set, assume it was the total_price or final_price.
-- This is just to avoid nulls for existing data.
UPDATE public.appointments
SET original_price = total_price
WHERE original_price = 0 OR original_price IS NULL;

UPDATE public.appointments
SET final_price = total_price
WHERE final_price = 0 OR final_price IS NULL;

-- If total_price is missing, try to get it from final_price
UPDATE public.appointments
SET total_price = final_price
WHERE total_price = 0 OR total_price IS NULL;
