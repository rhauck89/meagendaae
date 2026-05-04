-- Allow public read access to appointment requests for the confirmation flow
CREATE POLICY "public_read_appointment_requests" 
ON public.appointment_requests 
FOR SELECT 
USING (status IN ('pending', 'suggested', 'pending_client_confirmation', 'accepted', 'rejected'));
