
-- Create event-covers storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-covers', 'event-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload event covers
CREATE POLICY "Authenticated users can upload event covers"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'event-covers');

-- Allow authenticated users to update their event covers
CREATE POLICY "Authenticated users can update event covers"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'event-covers');

-- Allow authenticated users to delete event covers
CREATE POLICY "Authenticated users can delete event covers"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'event-covers');

-- Allow public to view event covers
CREATE POLICY "Public can view event covers"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'event-covers');
