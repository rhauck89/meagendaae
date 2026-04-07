
-- Create tutorial_categories table
CREATE TABLE public.tutorial_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  icon text,
  sort_order smallint NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tutorial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active categories" ON public.tutorial_categories
  FOR SELECT TO public USING (is_active = true);

CREATE POLICY "Super admins can manage categories" ON public.tutorial_categories
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- Add new columns to tutorial_videos
ALTER TABLE public.tutorial_videos
  ADD COLUMN category_id uuid REFERENCES public.tutorial_categories(id) ON DELETE SET NULL,
  ADD COLUMN thumbnail_url text,
  ADD COLUMN duration text,
  ADD COLUMN visible_for text NOT NULL DEFAULT 'all';

-- Create storage bucket for tutorial thumbnails
INSERT INTO storage.buckets (id, name, public) VALUES ('tutorial-thumbnails', 'tutorial-thumbnails', true);

CREATE POLICY "Super admins can upload tutorial thumbnails" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'tutorial-thumbnails' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Super admins can delete tutorial thumbnails" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'tutorial-thumbnails' AND has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Public can view tutorial thumbnails" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'tutorial-thumbnails');
