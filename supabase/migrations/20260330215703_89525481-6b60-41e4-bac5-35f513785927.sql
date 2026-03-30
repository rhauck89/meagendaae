
-- Drop existing overly permissive logo storage policies
DROP POLICY IF EXISTS "Authenticated can upload logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete logos" ON storage.objects;

-- Recreate with ownership checks: file path must start with the user's company_id
CREATE POLICY "Company members can upload logos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);

CREATE POLICY "Company members can update logos"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);

CREATE POLICY "Company members can delete logos"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = (public.get_my_company_id())::text
);
