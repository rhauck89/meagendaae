ALTER TABLE public.appointment_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_insert_appointment_requests" ON public.appointment_requests;
DROP POLICY IF EXISTS "Allow public insert" ON public.appointment_requests;
DROP POLICY IF EXISTS "Public can create appointment requests" ON public.appointment_requests;

CREATE POLICY "public_insert_appointment_requests"
ON public.appointment_requests
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public_company c
    WHERE c.id = appointment_requests.company_id
      AND c.allow_custom_requests = true
  )
);