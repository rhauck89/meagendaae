-- Create auth_otps table
CREATE TABLE IF NOT EXISTS public.auth_otps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    phone TEXT,
    email TEXT,
    code TEXT NOT NULL,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    last_sent_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create booking_abandonments table (use profiles if professionals doesn't exist yet, or just store UUID)
CREATE TABLE IF NOT EXISTS public.booking_abandonments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    session_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_email TEXT,
    service_ids UUID[],
    professional_id UUID, -- Remove FK constraint if table doesn't exist yet
    start_time TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'recovered', 'expired', 'notified')),
    last_sent_at TIMESTAMP WITH TIME ZONE,
    converted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    metadata JSONB DEFAULT '{}'::jsonb
);

-- Create booking_metrics table
CREATE TABLE IF NOT EXISTS public.booking_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    metric_type TEXT NOT NULL, -- 'abandonment', 'recovery', 'otp_login', 'one_click_booking'
    value DECIMAL DEFAULT 0, -- For revenue tracking
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auth_otps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_abandonments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_metrics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "System can manage OTPs" ON public.auth_otps FOR ALL USING (true);
CREATE POLICY "System can manage abandonments" ON public.booking_abandonments FOR ALL USING (true);
CREATE POLICY "System can manage metrics" ON public.booking_metrics FOR ALL USING (true);

-- Function to track metrics automatically
CREATE OR REPLACE FUNCTION public.track_booking_metric(
    p_company_id UUID,
    p_metric_type TEXT,
    p_value DECIMAL DEFAULT 0,
    p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS VOID AS $$
BEGIN
    INSERT INTO public.booking_metrics (company_id, metric_type, value, metadata)
    VALUES (p_company_id, p_metric_type, p_value, p_metadata);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
