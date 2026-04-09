
-- Add point_value to loyalty_config (value of each point in currency)
ALTER TABLE public.loyalty_config
ADD COLUMN IF NOT EXISTS point_value numeric NOT NULL DEFAULT 0.05;

-- Add real_value to loyalty_reward_items (actual monetary value of the item)
ALTER TABLE public.loyalty_reward_items
ADD COLUMN IF NOT EXISTS real_value numeric NOT NULL DEFAULT 0;
