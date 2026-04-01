
-- Create platform-assets storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('platform-assets', 'platform-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow super admins to upload files
CREATE POLICY "Super admins can upload platform assets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'platform-assets'
  AND has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Allow super admins to update files
CREATE POLICY "Super admins can update platform assets"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Allow super admins to delete files
CREATE POLICY "Super admins can delete platform assets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'platform-assets'
  AND has_role(auth.uid(), 'super_admin'::public.app_role)
);

-- Allow public read access (logos, favicons, OG images are public)
CREATE POLICY "Public can view platform assets"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'platform-assets');
