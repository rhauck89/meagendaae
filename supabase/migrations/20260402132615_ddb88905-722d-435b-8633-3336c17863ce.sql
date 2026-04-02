ALTER TABLE public.platform_settings
ADD COLUMN IF NOT EXISTS logo_light text,
ADD COLUMN IF NOT EXISTS logo_dark text;