-- Some booking/client-portal RPCs use client_email for client identity recovery.
-- Keep it denormalized on appointments, just like client_name/client_whatsapp.

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS client_email text;

CREATE INDEX IF NOT EXISTS idx_appointments_client_email
  ON public.appointments (company_id, lower(client_email))
  WHERE client_email IS NOT NULL AND client_email <> '';

UPDATE public.appointments a
SET client_email = c.email
FROM public.clients c
WHERE a.client_id = c.id
  AND (a.client_email IS NULL OR a.client_email = '')
  AND c.email IS NOT NULL
  AND c.email <> '';
