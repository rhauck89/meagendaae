-- Update historical records to ensure they have consistent price tracking
UPDATE public.appointments
SET original_price = COALESCE(original_price, total_price),
    final_price = COALESCE(final_price, total_price - COALESCE(promotion_discount, 0) - COALESCE(cashback_used, 0) - COALESCE(manual_discount, 0))
WHERE original_price IS NULL OR final_price IS NULL;

-- Ensure total_price reflects the gross value if original_price is used, 
-- but we'll stick to our logic where original_price is the base for commission.
