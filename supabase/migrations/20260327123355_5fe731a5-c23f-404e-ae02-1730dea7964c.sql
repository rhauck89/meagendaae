-- 1. Fix companies SELECT: restrict to own company + super admins
DROP POLICY IF EXISTS "Authenticated can view companies" ON public.companies;

CREATE POLICY "Members can view own company" ON public.companies
  FOR SELECT TO authenticated
  USING (id = get_user_company_id(auth.uid()) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Fix professional profiles: restrict to same company
DROP POLICY IF EXISTS "Authenticated can view professional profiles" ON public.profiles;

CREATE POLICY "Same company can view professional profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    company_id = get_user_company_id(auth.uid())
    AND EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = profiles.user_id
        AND ur.role IN ('professional'::app_role, 'collaborator'::app_role)
    )
  );

-- 3. Fix role assignment: professionals can only assign in their own company
DROP POLICY IF EXISTS "Professionals can assign limited roles" ON public.user_roles;

CREATE POLICY "Professionals can assign limited roles in own company" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
    AND role IN ('collaborator'::app_role, 'client'::app_role)
  );

-- 4. Fix collaborators: only professionals/collaborators can view
DROP POLICY IF EXISTS "Company members can view collaborators" ON public.collaborators;

CREATE POLICY "Professionals can view collaborators" ON public.collaborators
  FOR SELECT TO authenticated
  USING (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
    OR has_company_role(auth.uid(), company_id, 'collaborator'::app_role)
  );

-- 5. Fix appointments INSERT: must be own profile or company professional
DROP POLICY IF EXISTS "Authenticated can create appointments" ON public.appointments;

CREATE POLICY "Users can create appointments" ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
    OR has_company_role(auth.uid(), company_id, 'professional'::app_role)
    OR has_company_role(auth.uid(), company_id, 'collaborator'::app_role)
  );

-- 6. Fix waitlist INSERT: must be own profile
DROP POLICY IF EXISTS "Clients can insert waitlist" ON public.waitlist;

CREATE POLICY "Clients can insert own waitlist" ON public.waitlist
  FOR INSERT TO authenticated
  WITH CHECK (
    client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
  );

-- 7. Fix appointment_services INSERT: must have access to the appointment
DROP POLICY IF EXISTS "Insertable with auth" ON public.appointment_services;

CREATE POLICY "Users can insert appointment services" ON public.appointment_services
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.id = appointment_services.appointment_id
      AND (
        a.client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
        OR has_company_role(auth.uid(), a.company_id, 'professional'::app_role)
      )
    )
  );

-- 8. Allow webhook_events INSERT for service role (edge function)
DROP POLICY IF EXISTS "Edge functions can insert webhook events" ON public.webhook_events;

CREATE POLICY "Professionals can insert webhook events" ON public.webhook_events
  FOR INSERT TO authenticated
  WITH CHECK (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
  );
