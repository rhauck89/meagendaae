-- Add structured location columns to marketplace_banners
ALTER TABLE public.marketplace_banners 
ADD COLUMN state_id UUID REFERENCES public.states(id),
ADD COLUMN city_id UUID REFERENCES public.cities(id),
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION,
ADD COLUMN radius_km DOUBLE PRECISION;

-- Add indexes for performance
CREATE INDEX idx_marketplace_banners_state_id ON public.marketplace_banners(state_id);
CREATE INDEX idx_marketplace_banners_city_id ON public.marketplace_banners(city_id);
CREATE INDEX idx_marketplace_banners_lat_lon ON public.marketplace_banners(latitude, longitude);

-- Update existing banners (optional but helpful if we can map them)
-- This is tricky because we'd need to match names exactly. 
-- We'll rely on the app logic for fallback for now.
