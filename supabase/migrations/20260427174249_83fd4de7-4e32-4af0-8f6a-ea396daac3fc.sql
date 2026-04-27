-- Add profile_name and instance_name to whatsapp_instances
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS profile_name TEXT;
ALTER TABLE public.whatsapp_instances ADD COLUMN IF NOT EXISTS instance_name TEXT;

-- Update whatsapp_status enum
-- Note: ALTER TYPE ... ADD VALUE cannot be executed inside a transaction block in some Postgres versions, 
-- but Supabase migrations usually handle this. 
-- If it fails, we might need a different approach, but let's try.
ALTER TYPE public.whatsapp_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE public.whatsapp_status ADD VALUE IF NOT EXISTS 'closed';
