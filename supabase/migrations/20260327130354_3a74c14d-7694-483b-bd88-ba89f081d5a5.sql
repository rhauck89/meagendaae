
-- Allow authenticated users to insert webhook events for their company
CREATE POLICY "Authenticated can insert webhook events"
ON public.webhook_events
FOR INSERT
TO authenticated
WITH CHECK (company_id IS NOT NULL);

-- Drop the overly restrictive old insert policy
DROP POLICY IF EXISTS "Professionals can insert webhook events" ON public.webhook_events;
