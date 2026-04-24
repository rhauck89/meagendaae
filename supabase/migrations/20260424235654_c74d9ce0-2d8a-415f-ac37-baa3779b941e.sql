-- 1. Funções auxiliares otimizadas (SECURITY DEFINER para evitar loops de RLS)
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND (owner_id = _user_id OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin'::app_role
    ))
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = _user_id AND company_id = _company_id AND role = 'super_admin'::app_role
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_professional(_user_id uuid, _company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role IN ('professional', 'collaborator')
  );
$function$;

-- 2. Limpeza de políticas antigas e problemáticas na tabela appointments
DROP POLICY IF EXISTS "Authorized can update appointments" ON public.appointments;
DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Company members can view appointments" ON public.appointments;
DROP POLICY IF EXISTS "Members see only own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Members update only own appointments" ON public.appointments;
DROP POLICY IF EXISTS "Users can create appointments" ON public.appointments;

-- 3. Limpeza de políticas antigas na tabela profiles
DROP POLICY IF EXISTS "Clients can view professionals of own appointments" ON public.profiles;
DROP POLICY IF EXISTS "Company members can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Professionals can update company profiles" ON public.profiles;
DROP POLICY IF EXISTS "Same company can view professional profiles" ON public.profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 4. Novas Políticas para PROFILES (Sem recursão e simplificadas)
-- Usuário vê o próprio perfil
CREATE POLICY "profiles_select_self" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Membros da empresa veem perfis da mesma empresa
CREATE POLICY "profiles_select_company" ON public.profiles
  FOR SELECT TO authenticated USING (company_id = get_my_company_id());

-- Perfis de profissionais são visíveis para todos os usuários autenticados (necessário para agendamento)
CREATE POLICY "profiles_select_professionals" ON public.profiles
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = profiles.user_id 
    AND role IN ('professional', 'collaborator')
  ));

-- Usuário atualiza o próprio perfil
CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Admins da empresa podem atualizar perfis da sua empresa
CREATE POLICY "profiles_update_admin" ON public.profiles
  FOR UPDATE TO authenticated USING (is_admin(auth.uid(), company_id));

-- 5. Novas Políticas para APPOINTMENTS (Otimizadas e sem recursão)
-- Staff (Admins e Profissionais) podem gerenciar agendamentos da empresa
CREATE POLICY "appointments_staff_manage" ON public.appointments
  FOR ALL TO authenticated USING (
    company_id = get_my_company_id() 
    AND (is_admin(auth.uid(), company_id) OR is_professional(auth.uid(), company_id))
  );

-- Clientes visualizam seus próprios agendamentos
CREATE POLICY "appointments_client_select" ON public.appointments
  FOR SELECT TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Clientes criam seus próprios agendamentos
CREATE POLICY "appointments_client_insert" ON public.appointments
  FOR INSERT TO authenticated WITH CHECK (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );

-- Clientes podem atualizar (ex: cancelar) seus próprios agendamentos
CREATE POLICY "appointments_client_update" ON public.appointments
  FOR UPDATE TO authenticated USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
  );
