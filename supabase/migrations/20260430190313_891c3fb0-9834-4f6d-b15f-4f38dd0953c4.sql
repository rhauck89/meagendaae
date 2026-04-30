-- 1. Garantir RLS em profiles para acesso do próprio usuário
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 2. Garantir RLS em user_roles para acesso do próprio usuário
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Users can view own roles" 
ON public.user_roles 
FOR SELECT 
USING (auth.uid() = user_id);

-- 3. Criar RPC centralizada para contexto de usuário
CREATE OR REPLACE FUNCTION public.get_current_user_context()
RETURNS TABLE (
    user_id uuid,
    profile_id uuid,
    full_name text,
    email text,
    company_id uuid,
    roles text[],
    is_company_owner boolean,
    is_collaborator boolean,
    login_mode text
) 
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
    v_user_id uuid;
    v_profile_id uuid;
    v_full_name text;
    v_email text;
    v_company_id uuid;
    v_roles text[];
    v_is_owner boolean;
    v_is_collaborator boolean;
    v_login_mode text;
BEGIN
    -- Obter ID do usuário da sessão
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN;
    END IF;

    -- Buscar dados do perfil
    SELECT 
        id, name, company_id, login_mode
    INTO 
        v_profile_id, v_full_name, v_company_id, v_login_mode
    FROM public.profiles 
    WHERE user_id = v_user_id 
    LIMIT 1;

    -- Buscar e-mail do auth.users
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_user_id;

    -- Lógica de prioridade para company_id se estiver null no perfil
    IF v_company_id IS NULL THEN
        -- 1. Primeira empresa onde é dono
        SELECT id INTO v_company_id FROM public.companies WHERE user_id = v_user_id LIMIT 1;
        
        -- 2. Se ainda null, primeira empresa em user_roles
        IF v_company_id IS NULL THEN
            SELECT ur.company_id INTO v_company_id FROM public.user_roles ur WHERE ur.user_id = v_user_id LIMIT 1;
        END IF;
        
        -- 3. Se ainda null, primeira empresa como colaborador
        IF v_company_id IS NULL AND v_profile_id IS NOT NULL THEN
            SELECT c.company_id INTO v_company_id FROM public.collaborators c WHERE c.profile_id = v_profile_id AND c.active = true LIMIT 1;
        END IF;
    END IF;

    -- Obter todos os papéis (roles) do usuário
    SELECT ARRAY_AGG(DISTINCT role)::text[] INTO v_roles FROM public.user_roles WHERE user_id = v_user_id;

    -- Verificar se é dono de alguma empresa
    SELECT EXISTS (SELECT 1 FROM public.companies WHERE user_id = v_user_id) INTO v_is_owner;

    -- Verificar se é colaborador ativo
    IF v_profile_id IS NOT NULL THEN
        SELECT EXISTS (SELECT 1 FROM public.collaborators WHERE profile_id = v_profile_id AND active = true) INTO v_is_collaborator;
    ELSE
        v_is_collaborator := false;
    END IF;

    RETURN QUERY SELECT 
        v_user_id, 
        v_profile_id, 
        v_full_name, 
        v_email, 
        v_company_id, 
        COALESCE(v_roles, ARRAY[]::text[]), 
        v_is_owner, 
        v_is_collaborator,
        v_login_mode;
END;
$$;

-- 4. Garantir permissões de execução
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_context() TO service_role;
