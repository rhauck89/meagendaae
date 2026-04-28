-- Renomear owner_id para user_id na tabela companies
ALTER TABLE public.companies 
RENAME COLUMN owner_id TO user_id;

-- Remover políticas antigas
DROP POLICY IF EXISTS "Owner can create company" ON public.companies;
DROP POLICY IF EXISTS "Owner can view own company" ON public.companies;
DROP POLICY IF EXISTS "Owner can update company" ON public.companies;

-- Criar novas políticas conforme solicitado
-- 1. PERMITIR INSERT PARA USUÁRIO LOGADO
CREATE POLICY "Allow insert for authenticated users"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- 2. PERMITIR SELECT DO PRÓPRIO DONO
CREATE POLICY "Allow select own company"
ON public.companies
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 3. PERMITIR UPDATE DO PRÓPRIO DONO
CREATE POLICY "Allow update own company"
ON public.companies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);
