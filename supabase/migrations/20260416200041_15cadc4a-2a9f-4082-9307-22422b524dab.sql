-- 1. Replace legacy policies that compared appointments.client_id with profiles.id.
--    appointments.client_id actually references clients.id, so we must check clients.user_id.

DROP POLICY IF EXISTS "Clients can view own appointments" ON public.appointments;
CREATE POLICY "Clients can view own appointments"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authorized can update appointments" ON public.appointments;
CREATE POLICY "Authorized can update appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  has_company_role(auth.uid(), company_id, 'professional'::app_role)
  OR has_company_role(auth.uid(), company_id, 'collaborator'::app_role)
  OR client_id IN (
    SELECT id FROM public.clients WHERE user_id = auth.uid()
  )
);

-- 2. appointment_services SELECT must use the same correct linkage.

DROP POLICY IF EXISTS "Viewable with appointment access" ON public.appointment_services;
CREATE POLICY "Viewable with appointment access"
ON public.appointment_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        a.company_id = get_user_company_id(auth.uid())
        OR a.client_id IN (
          SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
      )
  )
);

-- 3. appointment_services INSERT had the same bug (matching by profiles instead of clients).

DROP POLICY IF EXISTS "Users can insert appointment services" ON public.appointment_services;
CREATE POLICY "Users can insert appointment services"
ON public.appointment_services
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.appointments a
    WHERE a.id = appointment_services.appointment_id
      AND (
        has_company_role(auth.uid(), a.company_id, 'professional'::app_role)
        OR has_company_role(auth.uid(), a.company_id, 'collaborator'::app_role)
        OR a.client_id IN (
          SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
      )
  )
);

-- 4. Backfill: recover historical client records whose user_id is NULL but email
--    matches a confirmed auth.users email. Phone-based linking is already handled
--    by link_client_to_user / handle_new_user.

UPDATE public.clients c
SET user_id = u.id
FROM auth.users u
WHERE c.user_id IS NULL
  AND c.email IS NOT NULL
  AND c.email <> ''
  AND lower(c.email) = lower(u.email)
  AND u.email_confirmed_at IS NOT NULL;

-- 5. Performance: speed up appointment lookups per client (used by the portal).

CREATE INDEX IF NOT EXISTS appointments_client_id_idx
  ON public.appointments (client_id)
  WHERE client_id IS NOT NULL;
