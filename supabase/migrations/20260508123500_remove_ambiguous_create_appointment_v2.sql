-- Remove the older create_appointment_v2 overload so PostgREST can choose the
-- current function unambiguously when public booking sends extra fields.

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

-- Refresh PostgREST schema cache after changing overloaded RPCs.
NOTIFY pgrst, 'reload schema';
