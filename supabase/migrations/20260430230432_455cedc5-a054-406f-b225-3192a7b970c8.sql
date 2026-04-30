-- Create platform WhatsApp settings table
CREATE TABLE IF NOT EXISTS public.platform_whatsapp_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_name TEXT NOT NULL,
    instance_id TEXT,
    api_url TEXT NOT NULL,
    api_key TEXT, -- Should be handled securely, ideally encrypted or as secret
    status TEXT DEFAULT 'disconnected',
    connected_phone TEXT,
    qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform WhatsApp templates table
CREATE TABLE IF NOT EXISTS public.platform_whatsapp_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE, -- e.g., 'company_welcome', 'trial_expiring'
    name TEXT NOT NULL,
    content TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform WhatsApp automations table
CREATE TABLE IF NOT EXISTS public.platform_whatsapp_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL UNIQUE, -- matches template type or event type
    enabled BOOLEAN DEFAULT false,
    template_id UUID REFERENCES public.platform_whatsapp_templates(id),
    delay_minutes INTEGER DEFAULT 0,
    daily_limit INTEGER DEFAULT 100,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create platform WhatsApp logs table
CREATE TABLE IF NOT EXISTS public.platform_whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id),
    recipient_user_id UUID REFERENCES public.profiles(id),
    recipient_phone TEXT NOT NULL,
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL, -- 'sent', 'error', 'pending'
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.platform_whatsapp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_whatsapp_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_whatsapp_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for super_admin access
-- Helper function to check if user is super_admin (based on existing roles table structure)
-- Note: Assuming there's a user_roles table or similar. 
-- Based on standard patterns in this project:
CREATE POLICY "Super admins can manage platform whatsapp settings" 
ON public.platform_whatsapp_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can manage platform whatsapp templates" 
ON public.platform_whatsapp_templates FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can manage platform whatsapp automations" 
ON public.platform_whatsapp_automations FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

CREATE POLICY "Super admins can view platform whatsapp logs" 
ON public.platform_whatsapp_logs FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin'));

-- Triggers for updated_at
CREATE TRIGGER update_platform_whatsapp_settings_updated_at BEFORE UPDATE ON public.platform_whatsapp_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_platform_whatsapp_templates_updated_at BEFORE UPDATE ON public.platform_whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_platform_whatsapp_automations_updated_at BEFORE UPDATE ON public.platform_whatsapp_automations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
