DO $$ 
BEGIN
    -- 1. LIMPAR CAMADA DE AUTENTICAÇÃO (ORDEM ESTREITA)
    DELETE FROM auth.identities;
    DELETE FROM auth.users;

    -- 2. LIMPAR TABELAS PÚBLICAS (TRUNCATE + CASCADE PARA INTEGRIDADE)
    TRUNCATE TABLE 
        public.user_roles,
        public.profiles,
        public.clients,
        public.clients_global,
        public.whatsapp_otp_codes,
        public.auth_otps
    RESTART IDENTITY CASCADE;

    -- 3. CRIAR/ATUALIZAR FUNÇÃO ADMIN PARA DELEÇÃO INDIVIDUAL SEGURA
    CREATE OR REPLACE FUNCTION public.delete_user_completely(target_user_id UUID)
    RETURNS void AS $body$
    BEGIN
        -- Remover identidades primeiro para evitar violação de FK
        DELETE FROM auth.identities WHERE user_id = target_user_id;
        
        -- Remover dados locais
        DELETE FROM public.user_roles WHERE user_id = target_user_id;
        DELETE FROM public.profiles WHERE user_id = target_user_id;
        DELETE FROM public.clients WHERE user_id = target_user_id;
        DELETE FROM public.clients_global WHERE user_id = target_user_id;
        
        -- Por fim, remover o usuário do auth
        DELETE FROM auth.users WHERE id = target_user_id;
    END;
    $body$ LANGUAGE plpgsql SECURITY DEFINER;

END $$;