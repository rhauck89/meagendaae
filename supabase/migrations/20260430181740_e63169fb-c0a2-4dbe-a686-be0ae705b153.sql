-- Habilita leitura pública para empresas ativas (necessário para páginas de perfil público)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select for active companies') THEN
        CREATE POLICY "Allow public select for active companies" 
        ON public.companies 
        FOR SELECT 
        USING (is_active = true);
    END IF;
END $$;

-- Habilita leitura pública para perfis de profissionais ativos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select for active professionals') THEN
        CREATE POLICY "Allow public select for active professionals" 
        ON public.profiles 
        FOR SELECT 
        USING (
            EXISTS (
                SELECT 1 FROM public.collaborators 
                WHERE public.collaborators.profile_id = public.profiles.id 
                AND public.collaborators.active = true
            )
        );
    END IF;
END $$;

-- Habilita leitura pública para colaboradores ativos
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select for active collaborators') THEN
        CREATE POLICY "Allow public select for active collaborators" 
        ON public.collaborators 
        FOR SELECT 
        USING (active = true);
    END IF;
END $$;

-- Habilita leitura pública para configurações de empresa (necessário para branding)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow public select for company settings') THEN
        CREATE POLICY "Allow public select for company settings" 
        ON public.company_settings 
        FOR SELECT 
        USING (true);
    END IF;
END $$;
