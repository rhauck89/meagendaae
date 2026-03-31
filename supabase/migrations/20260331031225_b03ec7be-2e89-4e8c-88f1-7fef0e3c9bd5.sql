
CREATE OR REPLACE FUNCTION public.get_professional_recent_bookings(p_professional_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
  FROM public.appointments
  WHERE professional_id = p_professional_id
    AND created_at >= (now() - interval '7 days')
    AND status NOT IN ('cancelled', 'no_show');
$$;
