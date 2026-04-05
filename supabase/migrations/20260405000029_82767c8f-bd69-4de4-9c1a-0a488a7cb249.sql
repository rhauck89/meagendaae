DROP FUNCTION IF EXISTS public.get_booking_appointments(uuid, uuid, date, text);

CREATE FUNCTION public.get_booking_appointments(
  p_company_id uuid,
  p_professional_id uuid,
  p_selected_date date,
  p_timezone text DEFAULT 'America/Sao_Paulo'
)
RETURNS TABLE(start_time timestamptz, end_time timestamptz, status text)
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    a.start_time,
    a.end_time,
    a.status::text
  FROM public.appointments a
  WHERE a.company_id = p_company_id
    AND a.professional_id = p_professional_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled')
    AND ((a.start_time AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'America/Sao_Paulo'))::date = p_selected_date)
  ORDER BY a.start_time;
$$;