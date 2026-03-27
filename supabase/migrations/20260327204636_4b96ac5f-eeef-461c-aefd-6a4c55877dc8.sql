
-- Make client_id nullable for guest bookings
ALTER TABLE public.appointments ALTER COLUMN client_id DROP NOT NULL;

-- Add guest client fields
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_name text;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_whatsapp text;

-- Allow public/anon users to insert appointments (guest bookings)
CREATE POLICY "Public can create guest appointments"
ON public.appointments
FOR INSERT
TO public
WITH CHECK (
  client_id IS NULL AND client_name IS NOT NULL
);

-- Allow public to view guest appointments by matching client_whatsapp
CREATE POLICY "Public can view own guest appointments"
ON public.appointments
FOR SELECT
TO public
USING (
  client_id IS NULL AND client_whatsapp IS NOT NULL
);

-- Allow public to insert appointment_services for guest appointments
CREATE POLICY "Public can insert guest appointment services"
ON public.appointment_services
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM appointments a
    WHERE a.id = appointment_services.appointment_id
    AND a.client_id IS NULL
  )
);
