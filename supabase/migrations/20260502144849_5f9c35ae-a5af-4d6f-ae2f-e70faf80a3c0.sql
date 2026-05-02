CREATE OR REPLACE FUNCTION public.is_company_admin(_user_id uuid, _company_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.companies
    WHERE id = _company_id AND user_id = _user_id
  ) OR public.has_role(_user_id, 'super_admin'::app_role);
$function$;