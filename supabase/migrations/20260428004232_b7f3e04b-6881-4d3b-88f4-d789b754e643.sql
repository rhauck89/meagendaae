CREATE TABLE public.whatsapp_otp_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS but don't add public policies (strictly server-side)
ALTER TABLE public.whatsapp_otp_codes ENABLE ROW LEVEL SECURITY;

-- Index for cleanup and lookup
CREATE INDEX idx_whatsapp_otp_phone ON public.whatsapp_otp_codes(phone);
CREATE INDEX idx_whatsapp_otp_expires ON public.whatsapp_otp_codes(expires_at);

-- Function to clean expired codes
CREATE OR REPLACE FUNCTION public.cleanup_expired_otp()
RETURNS void AS $$
BEGIN
    DELETE FROM public.whatsapp_otp_codes WHERE expires_at < now();
END;
$$ LANGUAGE plpgsql;
