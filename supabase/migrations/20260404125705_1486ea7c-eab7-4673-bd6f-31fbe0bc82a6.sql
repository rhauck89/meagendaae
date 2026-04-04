ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS image_position_x numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_position_y numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS image_zoom numeric NOT NULL DEFAULT 1;