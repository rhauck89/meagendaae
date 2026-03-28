-- Drop old function with wrong signature (has service_id which doesn't exist on appointments)
DROP FUNCTION IF EXISTS public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, timestamptz);

-- Create updated create_appointment RPC that handles all booking fields
CREATE OR REPLACE FUNCTION public.create_appointment(
  p_company_id uuid,
  p_professional_id uuid,
  p_client_id uuid DEFAULT NULL,
  p_start_time timestamptz DEFAULT NULL,
  p_end_time timestamptz DEFAULT NULL,
  p_total_price numeric DEFAULT 0,
  p_status text DEFAULT 'pending',
  p_client_name text DEFAULT NULL,
  p_client_whatsapp text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO appointments (
    company_id, professional_id, client_id, 
    start_time, end_time, total_price, status, notes
  ) VALUES (
    p_company_id, p_professional_id, p_client_id,
    p_start_time, p_end_time, p_total_price, p_status::appointment_status, p_notes
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

-- Create RPC for inserting appointment services (bypasses RLS for public booking)
CREATE OR REPLACE FUNCTION public.create_appointment_services(
  p_appointment_id uuid,
  p_services jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO appointment_services (appointment_id, service_id, price, duration_minutes)
  SELECT 
    p_appointment_id,
    (s->>'service_id')::uuid,
    (s->>'price')::numeric,
    (s->>'duration_minutes')::int
  FROM jsonb_array_elements(p_services) AS s;
END;
$$;

-- Remove overly permissive public INSERT policy on appointments
DROP POLICY IF EXISTS "public can create appointments" ON public.appointments;

-- Remove guest appointment policy that references non-existent columns
DROP POLICY IF EXISTS "Public can create guest appointments" ON public.appointments;

-- Remove guest appointment_services policy (now handled by RPC)
DROP POLICY IF EXISTS "Public can insert guest appointment services" ON public.appointment_services;