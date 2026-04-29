-- Create a table to track required super admin emails if they don't exist yet
CREATE TABLE IF NOT EXISTS public.pending_super_admins (
    email TEXT PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Insert the desired super admin email
INSERT INTO public.pending_super_admins (email) 
VALUES ('grow@vemserup.com.br')
ON CONFLICT (email) DO NOTHING;

-- Function to apply super admin role
CREATE OR REPLACE FUNCTION public.apply_super_admin_role(target_user_id UUID, target_email TEXT)
RETURNS VOID AS $$
BEGIN
    -- 1. Ensure the role exists in user_roles
    INSERT INTO public.user_roles (user_id, role)
    VALUES (target_user_id, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING;

    -- 2. Update profiles table
    UPDATE public.profiles
    SET 
        system_role = 'super_admin',
        role = 'super_admin'
    WHERE user_id = target_user_id;

    -- 3. Remove from pending list
    DELETE FROM public.pending_super_admins WHERE email = target_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function to automatically handle signup of super admins
CREATE OR REPLACE FUNCTION public.on_auth_user_created_super_admin()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.pending_super_admins WHERE email = NEW.email) THEN
        -- The profile is usually created by another trigger, but we ensure role is applied
        -- We might need a small delay or use a background process if the profile isn't ready,
        -- but usually, the user_roles table is independent.
        INSERT INTO public.user_roles (user_id, role)
        VALUES (NEW.id, 'super_admin')
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users (requires superuser, which migrations have)
DROP TRIGGER IF EXISTS tr_on_auth_user_created_super_admin ON auth.users;
CREATE TRIGGER tr_on_auth_user_created_super_admin
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.on_auth_user_created_super_admin();

-- Also handle existing users just in case they were created between checks
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT id, email FROM auth.users WHERE email IN (SELECT email FROM public.pending_super_admins)) LOOP
        PERFORM public.apply_super_admin_role(r.id, r.email);
    END LOOP;
END $$;
