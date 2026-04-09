
-- Create storage bucket for loyalty reward images
INSERT INTO storage.buckets (id, name, public) VALUES ('loyalty-rewards', 'loyalty-rewards', true)
ON CONFLICT (id) DO NOTHING;

-- Public can view images
CREATE POLICY "Public can view loyalty reward images"
ON storage.objects FOR SELECT
USING (bucket_id = 'loyalty-rewards');

-- Company members can upload images to their company folder
CREATE POLICY "Company members can upload loyalty reward images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'loyalty-rewards' AND (storage.foldername(name))[1] = get_my_company_id()::text);

-- Company members can update their images
CREATE POLICY "Company members can update loyalty reward images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'loyalty-rewards' AND (storage.foldername(name))[1] = get_my_company_id()::text);

-- Company members can delete their images
CREATE POLICY "Company members can delete loyalty reward images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'loyalty-rewards' AND (storage.foldername(name))[1] = get_my_company_id()::text);
