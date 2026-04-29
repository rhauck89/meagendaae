-- Ensure RLS is enabled
ALTER TABLE public.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist to avoid conflicts
DROP POLICY IF EXISTS "Allow insert OTP" ON public.whatsapp_otp_codes;
DROP POLICY IF EXISTS "Allow read OTP" ON public.whatsapp_otp_codes;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.whatsapp_otp_codes;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.whatsapp_otp_codes;

-- Create policies to allow the Edge Function (which uses service role or anon key) to manage OTPs
CREATE POLICY "Allow insert OTP"
ON public.whatsapp_otp_codes
FOR INSERT
TO public
WITH CHECK (true);

CREATE POLICY "Allow read OTP"
ON public.whatsapp_otp_codes
FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow update OTP"
ON public.whatsapp_otp_codes
FOR UPDATE
TO public
USING (true)
WITH CHECK (true);
