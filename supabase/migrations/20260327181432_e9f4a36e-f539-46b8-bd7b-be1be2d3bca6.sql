-- Fix 1: Restrict collaborators SELECT to professional/admin roles only
DROP POLICY IF EXISTS "Company members can view collaborators" ON public.collaborators;

CREATE POLICY "Admins can view collaborators"
ON public.collaborators
FOR SELECT
TO authenticated
USING (
  company_id = get_my_company_id()
  AND (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Collaborators can view their own record
CREATE POLICY "Collaborators can view own record"
ON public.collaborators
FOR SELECT
TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Fix 2: Restrict webhook_configs to professional/admin
DROP POLICY IF EXISTS "Company members can manage webhooks" ON public.webhook_configs;

CREATE POLICY "Admins can manage webhooks"
ON public.webhook_configs
FOR ALL
TO authenticated
USING (
  company_id = get_my_company_id()
  AND (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
)
WITH CHECK (
  company_id = get_my_company_id()
  AND (
    has_company_role(auth.uid(), company_id, 'professional'::app_role)
    OR has_role(auth.uid(), 'super_admin'::app_role)
  )
);

-- Fix 3: Restrict role assignment - target user must belong to the company
DROP POLICY IF EXISTS "Professionals can assign limited roles in own company" ON public.user_roles;

CREATE POLICY "Professionals can assign limited roles in own company"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
  AND role = ANY (ARRAY['collaborator'::app_role, 'client'::app_role])
  AND EXISTS (SELECT 1 FROM profiles WHERE user_id = user_roles.user_id AND company_id = user_roles.company_id)
);

-- Fix 4: Change appointment policies from public to authenticated
DROP POLICY IF EXISTS "Authorized can update appointments" ON public.appointments;
CREATE POLICY "Authorized can update appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  has_company_role(auth.uid(), company_id, 'professional'::app_role)
  OR has_company_role(auth.uid(), company_id, 'collaborator'::app_role)
  OR client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
CREATE POLICY "Clients can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Fix 5: Change webhook_events policy from public to authenticated
DROP POLICY IF EXISTS "Professionals can view webhook events" ON public.webhook_events;
CREATE POLICY "Professionals can view webhook events"
ON public.webhook_events
FOR SELECT
TO authenticated
USING (has_company_role(auth.uid(), company_id, 'professional'::app_role));

-- Fix 6: Change profile policies from public to authenticated where appropriate
DROP POLICY IF EXISTS "Company members can view profiles" ON public.profiles;
CREATE POLICY "Company members can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (company_id = get_user_company_id(auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Super admins can view all profiles" ON public.profiles;
CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role));