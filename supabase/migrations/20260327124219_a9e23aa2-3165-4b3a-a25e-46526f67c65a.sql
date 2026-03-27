-- Fix: professionals can only assign roles to users already in their company
DROP POLICY IF EXISTS "Professionals can assign limited roles in own company" ON public.user_roles;

CREATE POLICY "Professionals can assign limited roles in own company" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_user_company_id(auth.uid())
    AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
    AND role IN ('collaborator'::app_role, 'client'::app_role)
    AND (user_id IN (SELECT user_id FROM profiles WHERE company_id = user_roles.company_id) OR user_id IS NOT NULL)
  );

-- Fix: collaborators can only see own record, professionals see all
DROP POLICY IF EXISTS "Professionals can view collaborators" ON public.collaborators;

CREATE POLICY "Professionals can view all collaborators" ON public.collaborators
  FOR SELECT TO authenticated
  USING (has_company_role(auth.uid(), company_id, 'professional'::app_role));

CREATE POLICY "Collaborators can view own record" ON public.collaborators
  FOR SELECT TO authenticated
  USING (profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Fix: allow clients to delete from old waitlist table
CREATE POLICY "Clients can delete own waitlist" ON public.waitlist
  FOR DELETE TO authenticated
  USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Fix: allow clients to delete from new waiting_list table
CREATE POLICY "Clients can delete own waiting_list" ON public.waiting_list
  FOR DELETE TO authenticated
  USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
