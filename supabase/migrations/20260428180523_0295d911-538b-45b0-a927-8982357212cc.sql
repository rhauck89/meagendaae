-- Create categories table
CREATE TABLE public.categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'business',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create subcategories table
CREATE TABLE public.subcategories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create company_categories table
CREATE TABLE public.company_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id),
    subcategory_id UUID NOT NULL REFERENCES public.subcategories(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(company_id, category_id, subcategory_id)
);

-- Create service_categories table
CREATE TABLE public.service_categories (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Update services table
ALTER TABLE public.services 
ADD COLUMN category_id UUID REFERENCES public.service_categories(id) ON DELETE SET NULL;

-- Enable Row Level Security
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

-- Policies for categories/subcategories (publicly viewable)
CREATE POLICY "Categories are viewable by everyone" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Subcategories are viewable by everyone" ON public.subcategories FOR SELECT USING (true);

-- Policies for company_categories
CREATE POLICY "Company categories are viewable by everyone" ON public.company_categories FOR SELECT USING (true);
CREATE POLICY "Companies can manage their own categories" ON public.company_categories 
    FOR ALL USING (auth.uid() IN (SELECT owner_id FROM public.companies WHERE id = company_id));

-- Policies for service_categories
CREATE POLICY "Service categories are viewable by everyone" ON public.service_categories FOR SELECT USING (true);
CREATE POLICY "Companies can manage their own service categories" ON public.service_categories 
    FOR ALL USING (auth.uid() IN (SELECT owner_id FROM public.companies WHERE id = company_id));

-- Seed data for Barbearia
DO $$ 
DECLARE 
    barber_id UUID;
    estetica_id UUID;
BEGIN
    -- Barbearia
    INSERT INTO public.categories (name, type) VALUES ('Barbearia', 'business') RETURNING id INTO barber_id;
    
    INSERT INTO public.subcategories (category_id, name) VALUES 
    (barber_id, 'Corte Masculino'),
    (barber_id, 'Barba'),
    (barber_id, 'Corte + Barba'),
    (barber_id, 'Estética Masculina');

    -- Estética
    INSERT INTO public.categories (name, type) VALUES ('Estética', 'business') RETURNING id INTO estetica_id;
    
    INSERT INTO public.subcategories (category_id, name) VALUES 
    (estetica_id, 'Salão de Beleza'),
    (estetica_id, 'Manicure e Pedicure'),
    (estetica_id, 'Design de Sobrancelhas'),
    (estetica_id, 'Maquiagem'),
    (estetica_id, 'Massagem'),
    (estetica_id, 'Limpeza de Pele'),
    (estetica_id, 'Estética Avançada');
END $$;