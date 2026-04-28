ALTER TABLE public.auth_otps ADD COLUMN IF NOT EXISTS used BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_auth_otps_used ON public.auth_otps(used);