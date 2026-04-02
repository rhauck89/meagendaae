-- Drop the 5-param version (oldest, no client_name/whatsapp/notes)
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, timestamptz, timestamptz, numeric);

-- Drop the 8-param version (no promotion_id)
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, timestamptz, timestamptz, numeric, text, text, text);