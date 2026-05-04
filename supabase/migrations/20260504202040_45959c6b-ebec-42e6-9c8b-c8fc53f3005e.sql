-- Table for promotional opt-outs
CREATE TABLE IF NOT EXISTS public.promotional_opt_outs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    whatsapp TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    UNIQUE(company_id, whatsapp)
);

-- Table for promotion campaigns
CREATE TABLE IF NOT EXISTS public.promotion_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    promotion_id UUID REFERENCES public.promotions(id) ON DELETE SET NULL,
    professional_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    message_body TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sending, completed, cancelled
    total_clients INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Table for promotion campaign logs (the actual message queue/history)
CREATE TABLE IF NOT EXISTS public.promotion_campaign_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES public.promotion_campaigns(id) ON DELETE CASCADE,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    whatsapp TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- pending, sent, error, opt_out, ignored
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.promotional_opt_outs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.promotion_campaign_logs ENABLE ROW LEVEL SECURITY;

-- Policies for promotional_opt_outs
CREATE POLICY "Admins can manage opt-outs" ON public.promotional_opt_outs
    FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM public.profiles WHERE company_id = promotional_opt_outs.company_id
    ));

-- Policies for promotion_campaigns
CREATE POLICY "Users can manage their company campaigns" ON public.promotion_campaigns
    FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM public.profiles WHERE company_id = promotion_campaigns.company_id
    ));

-- Policies for promotion_campaign_logs
CREATE POLICY "Users can manage their company campaign logs" ON public.promotion_campaign_logs
    FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM public.profiles WHERE company_id = promotion_campaign_logs.company_id
    ));

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_opt_outs_company_whatsapp ON public.promotional_opt_outs(company_id, whatsapp);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_campaign_id ON public.promotion_campaign_logs(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_logs_status ON public.promotion_campaign_logs(status);
