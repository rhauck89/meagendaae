
-- Add per-professional booking configuration columns
ALTER TABLE public.collaborators
  ADD COLUMN IF NOT EXISTS booking_mode text NOT NULL DEFAULT 'fixed_grid',
  ADD COLUMN IF NOT EXISTS grid_interval integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS break_time integer NOT NULL DEFAULT 0;

-- Update public_professionals view to expose booking config
CREATE OR REPLACE VIEW public.public_professionals AS
SELECT
  p.id,
  p.full_name AS name,
  p.avatar_url,
  p.banner_url,
  c.company_id,
  c.slug,
  c.active,
  c.booking_mode,
  c.grid_interval,
  c.break_time
FROM profiles p
JOIN collaborators c ON c.profile_id = p.id
WHERE c.active = true;
