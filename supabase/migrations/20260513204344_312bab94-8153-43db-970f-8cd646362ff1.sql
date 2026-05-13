-- Create enum for collaborator roles if not exists
DO $$ BEGIN
    CREATE TYPE public.collaborator_role AS ENUM ('professional', 'receptionist', 'manager', 'admin', 'administrative', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create company_collaborators table
CREATE TABLE IF NOT EXISTS public.company_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role public.collaborator_role NOT NULL DEFAULT 'professional',
    is_service_provider BOOLEAN NOT NULL DEFAULT true,
    permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(company_id, profile_id)
);

-- Enable RLS
ALTER TABLE public.company_collaborators ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view collaborators of their own company"
ON public.company_collaborators
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.user_id = auth.uid()
        AND (profiles.company_id = company_collaborators.company_id OR profiles.id = company_collaborators.profile_id)
    )
);

CREATE POLICY "Admins can manage collaborators"
ON public.company_collaborators
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.companies
        WHERE companies.id = company_collaborators.company_id
        AND companies.user_id = auth.uid()
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.companies
        WHERE companies.id = company_collaborators.company_id
        AND companies.user_id = auth.uid()
    )
);

-- Trigger for updated_at
CREATE TRIGGER update_company_collaborators_updated_at
BEFORE UPDATE ON public.company_collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Function to check permission
CREATE OR REPLACE FUNCTION public.check_collaborator_permission(
    p_profile_id UUID,
    p_company_id UUID,
    p_module TEXT,
    p_action TEXT DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
    v_permissions JSONB;
    v_is_owner BOOLEAN;
BEGIN
    -- Check if is company owner
    SELECT (user_id = auth.uid()) INTO v_is_owner
    FROM public.companies
    WHERE id = p_company_id;

    IF v_is_owner THEN
        RETURN TRUE;
    END IF;

    -- Get permissions
    SELECT permissions INTO v_permissions
    FROM public.company_collaborators
    WHERE profile_id = p_profile_id AND company_id = p_company_id AND active = true;

    IF v_permissions IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Check permission
    RETURN (v_permissions->p_module->>p_action)::BOOLEAN IS TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Migrate existing collaborators
INSERT INTO public.company_collaborators (company_id, profile_id, role, is_service_provider, active, created_at)
SELECT company_id, profile_id, 'professional'::public.collaborator_role, true, COALESCE(active, true), created_at
FROM public.collaborators
ON CONFLICT (company_id, profile_id) DO NOTHING;
