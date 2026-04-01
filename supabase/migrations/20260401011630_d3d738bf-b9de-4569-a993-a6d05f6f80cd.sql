
-- 1) Fix event-covers storage policies to validate company ownership via folder path
DROP POLICY IF EXISTS "Authenticated users can upload event covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update event covers" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete event covers" ON storage.objects;

CREATE POLICY "Company members can upload event covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'event-covers'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

CREATE POLICY "Company members can update event covers"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'event-covers'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

CREATE POLICY "Company members can delete event covers"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'event-covers'
  AND (storage.foldername(name))[1] = get_my_company_id()::text
);

-- 2) Mask WhatsApp in public_company view
CREATE OR REPLACE VIEW public.public_company WITH (security_barrier = true) AS
SELECT
  c.id,
  c.name,
  c.slug,
  c.business_type,
  c.logo_url,
  c.cover_url,
  c.address,
  c.address_number,
  c.district,
  c.city,
  c.state,
  c.postal_code,
  c.phone,
  CASE
    WHEN c.whatsapp IS NOT NULL AND length(c.whatsapp) > 4
    THEN left(c.whatsapp, length(c.whatsapp) - 4) || '****'
    ELSE c.whatsapp
  END AS whatsapp,
  c.description,
  c.google_maps_url,
  c.google_review_url,
  c.instagram,
  c.facebook,
  c.website,
  c.buffer_minutes,
  COALESCE(rs.avg_rating, 0::numeric) AS average_rating,
  COALESCE(rs.review_count, 0) AS review_count
FROM companies c
LEFT JOIN (
  SELECT company_id, avg(rating) AS avg_rating, count(*)::integer AS review_count
  FROM reviews
  GROUP BY company_id
) rs ON rs.company_id = c.id;

-- 3) Fix collaborator RLS: professionals only see own commission data
DROP POLICY IF EXISTS "Company members can manage collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Admins can view collaborators" ON public.collaborators;
DROP POLICY IF EXISTS "Collaborators can view own record" ON public.collaborators;

-- Admins can fully manage collaborators
CREATE POLICY "Admins can manage collaborators"
ON public.collaborators FOR ALL TO authenticated
USING (
  company_id = get_my_company_id()
  AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
)
WITH CHECK (
  company_id = get_my_company_id()
  AND has_company_role(auth.uid(), company_id, 'professional'::app_role)
);

-- Collaborators can view only their own record (including commission)
CREATE POLICY "Collaborators can view own record"
ON public.collaborators FOR SELECT TO authenticated
USING (
  profile_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Super admins can manage all
CREATE POLICY "Super admins can manage collaborators"
ON public.collaborators FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- 4) Waitlist company isolation already exists via RLS but add explicit company filter for waitlist UPDATE
DROP POLICY IF EXISTS "Clients can delete own waitlist" ON public.waitlist;
CREATE POLICY "Clients can delete own waitlist"
ON public.waitlist FOR DELETE TO authenticated
USING (
  client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
);

-- Add UPDATE policy for waitlist so edge functions (via service role) can update, but regular users only own entries
CREATE POLICY "Company members can update waitlist"
ON public.waitlist FOR UPDATE TO authenticated
USING (company_id = get_my_company_id());
