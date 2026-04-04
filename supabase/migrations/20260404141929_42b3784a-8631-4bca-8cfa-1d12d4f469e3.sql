DROP POLICY IF EXISTS "Public can create appointment requests" ON public.appointment_requests;

CREATE POLICY "Public can create appointment requests"
ON public.appointment_requests
FOR INSERT
TO anon
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.companies c
    WHERE c.id = appointment_requests.company_id
      AND c.allow_custom_requests = true
  )
);

DROP POLICY IF EXISTS "Public can view own requests" ON public.appointment_requests;
