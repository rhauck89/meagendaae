
-- Standardize RLS: replace get_user_company_id(auth.uid()) with get_my_company_id()
-- This avoids passing auth.uid() repeatedly and uses the existing SECURITY DEFINER helper

-- 1. services table - SELECT policy
DROP POLICY IF EXISTS "Company members can view services" ON public.services;
CREATE POLICY "Company members can view services" ON public.services
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- services - INSERT
DROP POLICY IF EXISTS "Users can create services for their company" ON public.services;
CREATE POLICY "Users can create services for their company" ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_my_company_id());

-- services - UPDATE
DROP POLICY IF EXISTS "Users can update their company services" ON public.services;
CREATE POLICY "Users can update their company services" ON public.services
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id());

-- services - DELETE
DROP POLICY IF EXISTS "Users can delete their company services" ON public.services;
CREATE POLICY "Users can delete their company services" ON public.services
  FOR DELETE TO authenticated
  USING (company_id = get_my_company_id());

-- 2. profiles - company members SELECT
DROP POLICY IF EXISTS "Company members can view profiles" ON public.profiles;
CREATE POLICY "Company members can view profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- profiles - professionals update
DROP POLICY IF EXISTS "Professionals can update company profiles" ON public.profiles;
CREATE POLICY "Professionals can update company profiles" ON public.profiles
  FOR UPDATE TO authenticated
  USING (company_id = get_my_company_id() AND has_company_role(auth.uid(), get_my_company_id(), 'professional'::app_role));

-- profiles - same company view
DROP POLICY IF EXISTS "Same company can view professional profiles" ON public.profiles;
CREATE POLICY "Same company can view professional profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id() AND EXISTS (
    SELECT 1 FROM user_roles ur WHERE ur.user_id = profiles.user_id AND ur.role = ANY(ARRAY['professional'::app_role, 'collaborator'::app_role])
  ));

-- 3. companies - member view
DROP POLICY IF EXISTS "Members can view own company" ON public.companies;
CREATE POLICY "Members can view own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = get_my_company_id() OR has_role(auth.uid(), 'super_admin'::app_role));

-- 4. waitlist - company view (fix: was using public role)
DROP POLICY IF EXISTS "Company can view waitlist" ON public.waitlist;
CREATE POLICY "Company can view waitlist" ON public.waitlist
  FOR SELECT TO authenticated
  USING (company_id = get_my_company_id());

-- 5. waitlist - client view (fix: was using public role)
DROP POLICY IF EXISTS "Clients can view own waitlist" ON public.waitlist;
CREATE POLICY "Clients can view own waitlist" ON public.waitlist
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
