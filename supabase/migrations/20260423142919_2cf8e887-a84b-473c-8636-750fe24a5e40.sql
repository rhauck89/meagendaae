CREATE OR REPLACE FUNCTION public.get_appointment_public(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', a.id,
    'status', a.status,
    'start_time', a.start_time,
    'end_time', a.end_time,
    'completed_at', a.completed_at,
    'total_price', a.total_price,
    'company_id', a.company_id,
    'professional_id', a.professional_id,
    'client_id', a.client_id,
    'client_name', a.client_name,
    'client_whatsapp', a.client_whatsapp,
    'promotion_id', a.promotion_id,
    'professional', CASE
      WHEN p.id IS NOT NULL THEN jsonb_build_object(
        'full_name', p.full_name,
        'avatar_url', p.avatar_url
      )
      ELSE jsonb_build_object('full_name', 'Profissional', 'avatar_url', NULL)
    END,
    'company', CASE
      WHEN c.id IS NOT NULL THEN jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'business_type', c.business_type,
        'buffer_minutes', c.buffer_minutes,
        'phone', c.phone,
        'logo_url', c.logo_url,
        'google_review_url', c.google_review_url
      )
      ELSE jsonb_build_object('name', 'Estabelecimento')
    END,
    'appointment_services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', asv.id,
        'duration_minutes', asv.duration_minutes,
        'price', asv.price,
        'service', jsonb_build_object('name', s.name, 'duration_minutes', s.duration_minutes)
      ))
      FROM appointment_services asv
      JOIN services s ON s.id = asv.service_id
      WHERE asv.appointment_id = a.id
    ), '[]'::jsonb)
  )
  INTO v_result
  FROM appointments a
  LEFT JOIN profiles p ON p.id = a.professional_id
  LEFT JOIN companies c ON c.id = a.company_id
  WHERE a.id = p_appointment_id;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_appointment_public(uuid) TO anon, authenticated;