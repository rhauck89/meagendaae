-- Drop existing policies for clients_global
DROP POLICY IF EXISTS "Company members can view global clients linked to their company" ON public.clients_global;
DROP POLICY IF EXISTS "Users can view their own global profile" ON public.clients_global;
DROP POLICY IF EXISTS "Allow insert global client" ON public.clients_global;
DROP POLICY IF EXISTS "Allow select own global client" ON public.clients_global;
DROP POLICY IF EXISTS "Allow update own global client" ON public.clients_global;

-- Create simplified policies
-- 1. Allow insert for authenticated users
CREATE POLICY "Allow insert global client"
ON public.clients_global
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2. Allow select own global client
CREATE POLICY "Allow select own global client"
ON public.clients_global
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- 3. Allow update own global client
CREATE POLICY "Allow update own global client"
ON public.clients_global
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());