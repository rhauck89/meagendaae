-- Update get_booking_appointments to be security definer
-- This allows the public booking page to correctly identify occupied slots
-- while still respecting client privacy (since it only returns times and status).
CREATE OR REPLACE FUNCTION public.get_booking_appointments(
    p_company_id uuid,
    p_professional_id uuid,
    p_selected_date date,
    p_timezone text DEFAULT 'America/Sao_Paulo'::text
)
RETURNS TABLE(start_time timestamp with time zone, end_time timestamp with time zone, status text)
LANGUAGE sql
SECURITY DEFINER -- Change to DEFINER to bypass RLS for public availability checks
SET search_path = public
AS $$
  SELECT
    a.start_time,
    a.end_time,
    a.status::text
  FROM public.appointments a
  WHERE a.company_id = p_company_id
    AND a.professional_id = p_professional_id
    AND a.status NOT IN ('cancelled', 'no_show', 'rescheduled', 'completed')
    AND ((a.start_time AT TIME ZONE COALESCE(NULLIF(p_timezone, ''), 'America/Sao_Paulo'))::date = p_selected_date)
  ORDER BY a.start_time;
$$;
