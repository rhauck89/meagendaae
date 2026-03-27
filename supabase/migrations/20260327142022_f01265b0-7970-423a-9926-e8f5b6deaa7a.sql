
-- Create public storage bucket for company logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view logos (public bucket)
CREATE POLICY "Public can view logos"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'logos');

-- Allow authenticated users to upload logos to their company folder
CREATE POLICY "Authenticated can upload logos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'logos');

-- Allow authenticated users to update their logos
CREATE POLICY "Authenticated can update logos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'logos');

-- Allow authenticated users to delete their logos
CREATE POLICY "Authenticated can delete logos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'logos');
