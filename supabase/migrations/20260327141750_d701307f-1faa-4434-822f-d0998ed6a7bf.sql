
-- Drop the overly permissive INSERT policy that allows any authenticated user
DROP POLICY IF EXISTS "Authenticated can create company" ON public.companies;

-- New INSERT: only allow if owner_id matches the authenticated user
CREATE POLICY "Owner can create company"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
