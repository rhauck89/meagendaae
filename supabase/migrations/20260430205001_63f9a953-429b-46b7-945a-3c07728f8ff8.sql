-- 1. Helper Functions
CREATE OR REPLACE FUNCTION public.get_user_company_id(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_company_id uuid;
BEGIN
    -- a) profiles.company_id
    SELECT company_id INTO v_company_id FROM public.profiles WHERE user_id = _user_id LIMIT 1;
    IF v_company_id IS NOT NULL THEN RETURN v_company_id; END IF;

    -- b) companies.user_id = _user_id
    SELECT id INTO v_company_id FROM public.companies WHERE user_id = _user_id LIMIT 1;
    IF v_company_id IS NOT NULL THEN RETURN v_company_id; END IF;

    -- c) user_roles.company_id
    SELECT company_id INTO v_company_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
    IF v_company_id IS NOT NULL THEN RETURN v_company_id; END IF;

    -- d) collaborators ativos ligados ao profile do usuário
    SELECT c.company_id INTO v_company_id 
    FROM public.collaborators c
    JOIN public.profiles p ON p.id = c.profile_id
    WHERE p.user_id = _user_id AND c.active = true
    LIMIT 1;
    
    RETURN v_company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_access_company(_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- e) tiver role super_admin
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ) THEN
        RETURN true;
    END IF;

    -- a) auth.uid() for dono da empresa em companies.user_id
    IF EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id = _company_id AND user_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    -- b) auth.uid() tiver user_roles nessa company_id
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE company_id = _company_id AND user_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    -- c) profile do auth.uid() tiver company_id igual
    IF EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE user_id = auth.uid() AND company_id = _company_id
    ) THEN
        RETURN true;
    END IF;

    -- d) profile do auth.uid() for collaborator ativo nessa empresa
    IF EXISTS (
        SELECT 1 FROM public.collaborators c
        JOIN public.profiles p ON p.id = c.profile_id
        WHERE p.user_id = auth.uid() AND c.company_id = _company_id AND c.active = true
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_manage_company(_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Super admin
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE user_id = auth.uid() AND role = 'super_admin'
    ) THEN
        RETURN true;
    END IF;

    -- Owner
    IF EXISTS (
        SELECT 1 FROM public.companies 
        WHERE id = _company_id AND user_id = auth.uid()
    ) THEN
        RETURN true;
    END IF;

    -- Managerial roles
    IF EXISTS (
        SELECT 1 FROM public.user_roles 
        WHERE company_id = _company_id 
        AND user_id = auth.uid() 
        AND role IN ('admin', 'admin_principal', 'admin_financeiro', 'manager', 'professional')
    ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

-- 2. Update RLS Policies
-- We'll use DO blocks to safely handle policy updates

DO $$ 
BEGIN
    -- Services
    DROP POLICY IF EXISTS "Allow staff to manage services" ON public.services;
    CREATE POLICY "Allow staff to manage services" ON public.services
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_manage_company(company_id));

    -- Service Categories
    DROP POLICY IF EXISTS "Allow staff to manage service categories" ON public.service_categories;
    CREATE POLICY "Allow staff to manage service categories" ON public.service_categories
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_manage_company(company_id));

    -- Collaborators
    DROP POLICY IF EXISTS "Admins can manage collaborators" ON public.collaborators;
    DROP POLICY IF EXISTS "Collaborators can view own record" ON public.collaborators;
    
    CREATE POLICY "Staff can view all collaborators in company" ON public.collaborators
    FOR SELECT TO authenticated
    USING (can_access_company(company_id));

    CREATE POLICY "Admins can manage collaborators v2" ON public.collaborators
    FOR ALL TO authenticated
    USING (can_manage_company(company_id))
    WITH CHECK (can_manage_company(company_id));

    -- Appointments
    DROP POLICY IF EXISTS "appointments_staff_manage" ON public.appointments;
    CREATE POLICY "Staff can manage appointments" ON public.appointments
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_access_company(company_id));

    -- Business Hours
    DROP POLICY IF EXISTS "Company members can manage hours" ON public.business_hours;
    CREATE POLICY "Staff can manage business hours" ON public.business_hours
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_manage_company(company_id));

    -- Professional Working Hours
    DROP POLICY IF EXISTS "Company members can manage professional hours" ON public.professional_working_hours;
    CREATE POLICY "Staff can manage professional hours" ON public.professional_working_hours
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_access_company(company_id));

    -- Blocked Times
    DROP POLICY IF EXISTS "Company members can manage blocked times" ON public.blocked_times;
    DROP POLICY IF EXISTS "Members see only own blocks" ON public.blocked_times;
    CREATE POLICY "Staff can manage blocked times" ON public.blocked_times
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_access_company(company_id));

    -- Service Professionals
    DROP POLICY IF EXISTS "Company members can manage service professionals" ON public.service_professionals;
    CREATE POLICY "Staff can manage service professionals" ON public.service_professionals
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_access_company(company_id));

    -- Company Settings
    DROP POLICY IF EXISTS "Company members can view settings" ON public.company_settings;
    DROP POLICY IF EXISTS "Company members can insert settings" ON public.company_settings;
    DROP POLICY IF EXISTS "Company members can update settings" ON public.company_settings;
    DROP POLICY IF EXISTS "Company members can delete settings" ON public.company_settings;
    
    CREATE POLICY "Staff can manage settings" ON public.company_settings
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_manage_company(company_id));

    -- Company Amenities
    DROP POLICY IF EXISTS "Company members can manage amenities" ON public.company_amenities;
    CREATE POLICY "Staff can manage amenities" ON public.company_amenities
    FOR ALL TO authenticated
    USING (can_access_company(company_id))
    WITH CHECK (can_manage_company(company_id));
END $$;
