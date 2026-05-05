-- Tabela de configurações da Home do Marketplace
CREATE TABLE IF NOT EXISTS public.marketplace_home_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    hero_title TEXT DEFAULT 'Encontre os melhores profissionais perto de você',
    hero_subtitle TEXT DEFAULT 'Agende barbearia, estética, massagem e muito mais em poucos cliques.',
    hero_image_url TEXT,
    hero_badge TEXT DEFAULT 'O SEU GUIA DE BELEZA E BEM-ESTAR',
    cta_professional_title TEXT DEFAULT 'É um profissional?',
    cta_professional_subtitle TEXT DEFAULT 'Cadastre seu negócio e comece a receber agendamentos online hoje mesmo.',
    cta_professional_button_text TEXT DEFAULT 'Cadastrar meu negócio',
    cta_professional_image_url TEXT,
    benefit_1_title TEXT,
    benefit_1_description TEXT,
    benefit_2_title TEXT,
    benefit_2_description TEXT,
    benefit_3_title TEXT,
    benefit_3_description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id)
);

-- Tabela de Banners Publicitários
CREATE TABLE IF NOT EXISTS public.marketplace_banners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    client_name TEXT,
    company_id UUID REFERENCES public.companies(id),
    desktop_image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    destination_link TEXT,
    position TEXT NOT NULL, -- 'hero_secondary', 'between_sections', 'category_page', 'footer'
    country TEXT DEFAULT 'Brasil',
    state TEXT,
    city TEXT,
    neighborhood TEXT,
    category TEXT, -- 'barbearia', 'estetica', etc
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    sale_model TEXT NOT NULL DEFAULT 'fixed_period', -- 'fixed_period', 'impressions', 'clicks'
    limit_impressions INTEGER,
    limit_clicks INTEGER,
    current_impressions INTEGER DEFAULT 0,
    current_clicks INTEGER DEFAULT 0,
    priority INTEGER DEFAULT 0,
    rotation_weight INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'scheduled', 'active', 'paused', 'ended'
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Destaques Manuais
CREATE TABLE IF NOT EXISTS public.marketplace_featured_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    item_type TEXT NOT NULL, -- 'company', 'professional'
    company_id UUID REFERENCES public.companies(id),
    professional_id UUID REFERENCES public.profiles(id),
    position TEXT NOT NULL, -- 'featured_professionals', 'more_professionals', 'regional_featured', 'category_featured'
    state TEXT,
    city TEXT,
    neighborhood TEXT,
    category TEXT,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    priority INTEGER DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    internal_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Tabela de Eventos (Impressões e Cliques)
CREATE TABLE IF NOT EXISTS public.marketplace_banner_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    banner_id UUID REFERENCES public.marketplace_banners(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- 'impression', 'click'
    user_id UUID REFERENCES auth.users(id), -- Opcional
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.marketplace_home_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_featured_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketplace_banner_events ENABLE ROW LEVEL SECURITY;

-- Políticas para Home Settings
CREATE POLICY "Public can view marketplace home settings" 
ON public.marketplace_home_settings FOR SELECT USING (true);

CREATE POLICY "Super admin can manage marketplace home settings" 
ON public.marketplace_home_settings FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Políticas para Banners
CREATE POLICY "Public can view active banners" 
ON public.marketplace_banners FOR SELECT 
USING (status = 'active' AND now() BETWEEN start_date AND end_date);

CREATE POLICY "Super admin can manage marketplace banners" 
ON public.marketplace_banners FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Políticas para Destaques
CREATE POLICY "Public can view active featured items" 
ON public.marketplace_featured_items FOR SELECT 
USING (status = 'active' AND now() BETWEEN start_date AND end_date);

CREATE POLICY "Super admin can manage marketplace featured items" 
ON public.marketplace_featured_items FOR ALL 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Políticas para Eventos
CREATE POLICY "Public can insert banner events" 
ON public.marketplace_banner_events FOR INSERT WITH CHECK (true);

CREATE POLICY "Super admin can view banner events" 
ON public.marketplace_banner_events FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Criar buckets de storage
INSERT INTO storage.buckets (id, name, public) VALUES ('marketplace-assets', 'marketplace-assets', true) ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "Marketplace assets are public" ON storage.objects FOR SELECT USING (bucket_id = 'marketplace-assets');
CREATE POLICY "Super admin can manage marketplace assets" ON storage.objects FOR ALL 
USING (bucket_id = 'marketplace-assets' AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = 'super_admin'));

-- Inserir dados iniciais para Home Settings
INSERT INTO public.marketplace_home_settings (hero_title) VALUES ('Encontre os melhores profissionais perto de você') ON CONFLICT DO NOTHING;
