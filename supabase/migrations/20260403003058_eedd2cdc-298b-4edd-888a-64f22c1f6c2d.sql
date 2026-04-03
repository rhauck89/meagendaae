
-- Step 1: Deduplicate clients - keep the one with smallest created_at, reassign references
DO $$
DECLARE
  rec RECORD;
  keep_id uuid;
  dup_id uuid;
BEGIN
  FOR rec IN
    SELECT company_id, whatsapp
    FROM clients
    WHERE whatsapp IS NOT NULL
    GROUP BY company_id, whatsapp
    HAVING COUNT(*) > 1
  LOOP
    -- Keep the oldest
    SELECT id INTO keep_id FROM clients
      WHERE company_id = rec.company_id AND whatsapp = rec.whatsapp
      ORDER BY created_at ASC LIMIT 1;

    -- Reassign all references from duplicates to the keeper
    FOR dup_id IN
      SELECT id FROM clients
        WHERE company_id = rec.company_id AND whatsapp = rec.whatsapp AND id != keep_id
    LOOP
      UPDATE appointments SET client_id = keep_id WHERE client_id = dup_id;
      UPDATE reviews SET client_id = keep_id WHERE client_id = dup_id;
      UPDATE promotion_bookings SET client_id = keep_id WHERE client_id = dup_id;
      DELETE FROM clients WHERE id = dup_id;
    END LOOP;
  END LOOP;
END;
$$;

-- Step 2: Drop old non-unique index and create unique partial index
DROP INDEX IF EXISTS idx_clients_company_whatsapp;
CREATE UNIQUE INDEX unique_client_company_whatsapp ON public.clients (company_id, whatsapp) WHERE whatsapp IS NOT NULL;

-- Step 3: Drop legacy CPF function
DROP FUNCTION IF EXISTS public.lookup_client_by_cpf(uuid, text);

-- Step 4: Recreate book_event_slot without CPF parameter
CREATE OR REPLACE FUNCTION public.book_event_slot(
  p_slot_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_client_email text DEFAULT '',
  p_service_ids uuid[] DEFAULT '{}',
  p_notes text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot RECORD;
  v_client_id uuid;
  v_appointment_id uuid;
  v_total_price numeric := 0;
  v_total_duration integer := 0;
  v_end_time timestamptz;
  v_company_id uuid;
  v_service RECORD;
BEGIN
  SELECT * INTO v_slot FROM event_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF v_slot.current_bookings >= v_slot.max_bookings THEN RAISE EXCEPTION 'Slot is full'; END IF;

  SELECT company_id INTO v_company_id FROM events WHERE id = v_slot.event_id;

  SELECT id INTO v_client_id FROM clients
    WHERE company_id = v_company_id AND whatsapp = p_client_whatsapp LIMIT 1;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (company_id, name, whatsapp, email)
    VALUES (v_company_id, p_client_name, p_client_whatsapp, NULLIF(p_client_email, ''))
    RETURNING id INTO v_client_id;
  ELSE
    UPDATE clients SET
      email = COALESCE(NULLIF(p_client_email, ''), email),
      name = COALESCE(NULLIF(p_client_name, ''), name)
    WHERE id = v_client_id;
  END IF;

  IF array_length(p_service_ids, 1) > 0 THEN
    FOR v_service IN
      SELECT s.id, COALESCE(esp.override_price, s.price) AS price, s.duration_minutes
      FROM services s
      LEFT JOIN event_service_prices esp ON esp.service_id = s.id AND esp.event_id = v_slot.event_id
      WHERE s.id = ANY(p_service_ids)
    LOOP
      v_total_price := v_total_price + v_service.price;
      v_total_duration := v_total_duration + v_service.duration_minutes;
    END LOOP;
  END IF;

  IF v_total_duration = 0 THEN v_total_duration := 30; END IF;

  v_end_time := (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz + (v_total_duration || ' minutes')::interval;

  INSERT INTO appointments (
    company_id, professional_id, client_id, client_name, client_whatsapp,
    start_time, end_time, total_price, status, event_id, notes
  ) VALUES (
    v_company_id, v_slot.professional_id, v_client_id, p_client_name, p_client_whatsapp,
    (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz, v_end_time,
    v_total_price, 'confirmed', v_slot.event_id, p_notes
  ) RETURNING id INTO v_appointment_id;

  IF array_length(p_service_ids, 1) > 0 THEN
    INSERT INTO appointment_services (appointment_id, service_id, price, duration_minutes)
    SELECT v_appointment_id, s.id, COALESCE(esp.override_price, s.price), s.duration_minutes
    FROM services s
    LEFT JOIN event_service_prices esp ON esp.service_id = s.id AND esp.event_id = v_slot.event_id
    WHERE s.id = ANY(p_service_ids);
  END IF;

  UPDATE event_slots SET current_bookings = current_bookings + 1 WHERE id = p_slot_id;

  RETURN v_appointment_id::text;
END;
$$;
