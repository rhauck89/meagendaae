ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS site_title text DEFAULT 'AgendaPro',
  ADD COLUMN IF NOT EXISTS meta_description text,
  ADD COLUMN IF NOT EXISTS og_image text,
  ADD COLUMN IF NOT EXISTS favicon_url text,
  ADD COLUMN IF NOT EXISTS default_keywords text;