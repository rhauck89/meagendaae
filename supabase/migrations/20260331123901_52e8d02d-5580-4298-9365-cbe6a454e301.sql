-- Create company_gallery table for barbershop photos
CREATE TABLE public.company_gallery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  caption text,
  sort_order smallint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_gallery ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage gallery"
  ON public.company_gallery FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Public can view gallery"
  ON public.company_gallery FOR SELECT TO public
  USING (true);

CREATE INDEX idx_company_gallery_company ON public.company_gallery(company_id, sort_order);

INSERT INTO storage.buckets (id, name, public)
VALUES ('gallery', 'gallery', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload gallery images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = (SELECT id::text FROM public.companies WHERE id = get_my_company_id())
  );

CREATE POLICY "Authenticated users can update gallery images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = (SELECT id::text FROM public.companies WHERE id = get_my_company_id())
  );

CREATE POLICY "Authenticated users can delete gallery images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'gallery'
    AND (storage.foldername(name))[1] = (SELECT id::text FROM public.companies WHERE id = get_my_company_id())
  );

CREATE POLICY "Public can view gallery images"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'gallery');
