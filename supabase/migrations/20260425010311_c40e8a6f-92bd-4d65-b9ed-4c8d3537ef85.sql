-- Add new columns to company_revenues
ALTER TABLE public.company_revenues 
ADD COLUMN IF NOT EXISTS client_name TEXT,
ADD COLUMN IF NOT EXISTS professional_name TEXT,
ADD COLUMN IF NOT EXISTS service_name TEXT;

-- Backfill data for automatic revenues linked to appointments
UPDATE public.company_revenues r
SET 
  client_name = a.client_name,
  professional_name = p.full_name,
  service_name = (
    SELECT string_agg(s.name, ', ')
    FROM appointment_services asrv
    JOIN services s ON s.id = asrv.service_id
    WHERE asrv.appointment_id = a.id
  )
FROM public.appointments a
JOIN public.profiles p ON p.id = a.professional_id
WHERE r.appointment_id = a.id
AND r.is_automatic = true;

-- For records where it couldn't be joined (e.g. deleted appointments) or manual ones
-- try to parse from description if it matches "Client — Service" pattern
UPDATE public.company_revenues
SET 
  client_name = split_part(description, ' — ', 1),
  service_name = split_part(description, ' — ', 2)
WHERE (client_name IS NULL OR service_name IS NULL OR service_name = '')
AND description LIKE '% — %';

-- If still null, just use description as client_name
UPDATE public.company_revenues
SET client_name = description
WHERE client_name IS NULL;

-- If service_name is still null, use a dash
UPDATE public.company_revenues
SET service_name = '—'
WHERE service_name IS NULL OR service_name = '';

-- Also ensure professional_name is filled for manual revenues if possible
UPDATE public.company_revenues r
SET professional_name = p.full_name
FROM public.profiles p
WHERE r.professional_id = p.id
AND r.professional_name IS NULL;
