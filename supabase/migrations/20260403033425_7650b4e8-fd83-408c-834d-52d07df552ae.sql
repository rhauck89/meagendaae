ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS pwa_icon_192 text,
  ADD COLUMN IF NOT EXISTS pwa_icon_512 text,
  ADD COLUMN IF NOT EXISTS splash_logo text,
  ADD COLUMN IF NOT EXISTS splash_background_color text DEFAULT '#0f2a5c';