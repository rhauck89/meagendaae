-- Add system_role to collaborators
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'collaborators' AND column_name = 'system_role') THEN
    ALTER TABLE public.collaborators ADD COLUMN system_role TEXT DEFAULT 'collaborator';
  END IF;
END $$;

-- Add system_role to profiles if needed (for user-level role tracking)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'system_role') THEN
    ALTER TABLE public.profiles ADD COLUMN system_role TEXT DEFAULT 'user';
  END IF;
END $$;

-- Update existing data: owner of company is Admin Principal
UPDATE public.collaborators c
SET system_role = 'admin_principal'
FROM public.companies comp
WHERE c.company_id = comp.id 
  AND c.profile_id IN (SELECT id FROM public.profiles WHERE user_id = comp.owner_id);

-- Other collaborators with system access are 'admin' by default for now
UPDATE public.collaborators
SET system_role = 'admin'
WHERE has_system_access = true AND system_role = 'collaborator';
