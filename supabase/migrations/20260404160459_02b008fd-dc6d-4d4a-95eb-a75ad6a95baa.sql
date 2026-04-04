-- Drop existing restrictive policy and recreate with broader access
DROP POLICY IF EXISTS "Public can create appointment requests" ON appointment_requests;

CREATE POLICY "Public can create appointment requests"
ON appointment_requests
FOR INSERT
TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM companies c
    WHERE c.id = appointment_requests.company_id
    AND c.allow_custom_requests = true
  )
);