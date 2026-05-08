DROP FUNCTION IF EXISTS public.create_appointment_v2(
  uuid,
  uuid,
  uuid,
  timestamp with time zone,
  timestamp with time zone,
  numeric,
  text,
  text,
  text,
  uuid,
  jsonb,
  uuid[],
  uuid,
  text,
  text
);

NOTIFY pgrst, 'reload schema';