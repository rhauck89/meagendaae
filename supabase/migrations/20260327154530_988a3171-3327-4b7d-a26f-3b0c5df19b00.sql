
-- Fix 1: user_roles - Remove dangerous OR branch that allows assigning roles to arbitrary users
DROP POLICY IF EXISTS "Professionals can assign limited roles in own company" ON public.user_roles;
CREATE POLICY "Professionals can assign limited roles in own company"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (
  company_id = get_user_company_id(auth.uid())
  AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
  AND role = ANY (ARRAY['collaborator'::app_role, 'client'::app_role])
);

-- Fix 2: webhook_events - Restrict inserts to company members only
DROP POLICY IF EXISTS "Authenticated can insert webhook events" ON public.webhook_events;
CREATE POLICY "Company members can insert webhook events"
ON public.webhook_events FOR INSERT TO authenticated
WITH CHECK (company_id = get_my_company_id());
