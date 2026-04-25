-- Add onboarding columns to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS onboarding_hidden BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;

-- Update RLS policies if necessary (profiles are usually editable by the owner)
-- Assuming existing policies allow users to update their own profile.
