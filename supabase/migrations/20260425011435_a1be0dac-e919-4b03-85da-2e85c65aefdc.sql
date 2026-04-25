-- Update records where client_name is NULL or empty
UPDATE public.company_revenues
SET client_name = TRIM(SPLIT_PART(description, ' — ', 1))
WHERE (client_name IS NULL OR client_name = '')
AND description LIKE '% — %';

-- Update records where service_name is NULL or empty
UPDATE public.company_revenues
SET service_name = TRIM(SPLIT_PART(description, ' — ', 2))
WHERE (service_name IS NULL OR service_name = '')
AND description LIKE '% — %';

-- If still NULL after split (no " — " in description), use description as client_name if it was a manual entry
UPDATE public.company_revenues
SET client_name = description
WHERE (client_name IS NULL OR client_name = '')
AND is_automatic = false;

-- Try to populate professional_name from profiles if missing
UPDATE public.company_revenues cr
SET professional_name = p.full_name
FROM public.profiles p
WHERE cr.professional_id = p.id
AND (cr.professional_name IS NULL OR cr.professional_name = '');
