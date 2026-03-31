
-- Create event status enum
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');

-- Create events table
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  cover_image text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status event_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, slug)
);

-- Create event_slots table
CREATE TABLE public.event_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id),
  slot_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  max_bookings int NOT NULL DEFAULT 1,
  current_bookings int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create event_service_prices table for price overrides
CREATE TABLE public.event_service_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  override_price numeric NOT NULL,
  UNIQUE (event_id, service_id)
);

-- Add event_id to appointments
ALTER TABLE public.appointments ADD COLUMN event_id uuid REFERENCES public.events(id);

-- Add event_id to waitlist
ALTER TABLE public.waitlist ADD COLUMN event_id uuid REFERENCES public.events(id);

-- Create indexes
CREATE INDEX idx_events_company ON public.events(company_id);
CREATE INDEX idx_events_slug ON public.events(slug);
CREATE INDEX idx_events_status ON public.events(company_id, status);
CREATE INDEX idx_event_slots_event ON public.event_slots(event_id);
CREATE INDEX idx_event_slots_date ON public.event_slots(event_id, slot_date);
CREATE INDEX idx_appointments_event ON public.appointments(event_id) WHERE event_id IS NOT NULL;

-- Enable RLS
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_service_prices ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Public can view published events" ON public.events
  FOR SELECT TO public USING (status = 'published');

CREATE POLICY "Company members can manage events" ON public.events
  FOR ALL TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Event slots policies
CREATE POLICY "Public can view slots of published events" ON public.event_slots
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_slots.event_id AND e.status = 'published'));

CREATE POLICY "Company members can manage event slots" ON public.event_slots
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_slots.event_id AND e.company_id = get_my_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_slots.event_id AND e.company_id = get_my_company_id()));

-- Event service prices policies
CREATE POLICY "Public can view event prices" ON public.event_service_prices
  FOR SELECT TO public
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_service_prices.event_id AND e.status = 'published'));

CREATE POLICY "Company members can manage event prices" ON public.event_service_prices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_service_prices.event_id AND e.company_id = get_my_company_id()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_service_prices.event_id AND e.company_id = get_my_company_id()));

-- Update trigger
CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RPC to book an event slot
CREATE OR REPLACE FUNCTION public.book_event_slot(
  p_slot_id uuid,
  p_client_name text,
  p_client_whatsapp text,
  p_client_email text,
  p_client_cpf text,
  p_service_ids uuid[],
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slot RECORD;
  v_event RECORD;
  v_client_id uuid;
  v_appointment_id uuid;
  v_total_price numeric := 0;
  v_total_duration int := 0;
  v_start_ts timestamptz;
  v_end_ts timestamptz;
  v_sid uuid;
  v_svc RECORD;
  v_override_price numeric;
BEGIN
  -- Lock and get slot
  SELECT * INTO v_slot FROM public.event_slots WHERE id = p_slot_id FOR UPDATE;
  IF v_slot IS NULL THEN RAISE EXCEPTION 'Slot not found'; END IF;
  IF v_slot.current_bookings >= v_slot.max_bookings THEN RAISE EXCEPTION 'Slot is full'; END IF;

  -- Get event
  SELECT * INTO v_event FROM public.events WHERE id = v_slot.event_id;
  IF v_event.status <> 'published' THEN RAISE EXCEPTION 'Event is not available'; END IF;

  -- Validate inputs
  IF p_client_name IS NULL OR trim(p_client_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF p_client_whatsapp IS NULL OR trim(p_client_whatsapp) = '' THEN RAISE EXCEPTION 'WhatsApp is required'; END IF;
  IF length(p_client_name) > 100 THEN p_client_name := substring(p_client_name FROM 1 FOR 100); END IF;
  IF length(p_client_whatsapp) > 20 THEN RAISE EXCEPTION 'Invalid WhatsApp'; END IF;

  -- Create/find client
  v_client_id := public.create_client(v_event.company_id, trim(p_client_name), trim(p_client_whatsapp), NULLIF(trim(COALESCE(p_client_email, '')), ''), NULLIF(trim(COALESCE(p_client_cpf, '')), ''));

  -- Calculate prices with event overrides
  FOREACH v_sid IN ARRAY p_service_ids LOOP
    SELECT s.price, s.duration_minutes INTO v_svc FROM public.services s WHERE s.id = v_sid;
    SELECT esp.override_price INTO v_override_price FROM public.event_service_prices esp WHERE esp.event_id = v_event.id AND esp.service_id = v_sid;
    v_total_price := v_total_price + COALESCE(v_override_price, v_svc.price);
    v_total_duration := v_total_duration + v_svc.duration_minutes;
  END LOOP;

  -- Build timestamps
  v_start_ts := (v_slot.slot_date || ' ' || v_slot.start_time)::timestamptz;
  v_end_ts := v_start_ts + (v_total_duration || ' minutes')::interval;

  -- Create appointment
  INSERT INTO public.appointments (company_id, professional_id, client_id, client_name, client_whatsapp, start_time, end_time, total_price, status, event_id, notes)
  VALUES (v_event.company_id, v_slot.professional_id, v_client_id, trim(p_client_name), trim(p_client_whatsapp), v_start_ts, v_end_ts, v_total_price, 'confirmed', v_event.id, p_notes)
  RETURNING id INTO v_appointment_id;

  -- Create appointment services
  FOREACH v_sid IN ARRAY p_service_ids LOOP
    SELECT s.price, s.duration_minutes INTO v_svc FROM public.services s WHERE s.id = v_sid;
    SELECT esp.override_price INTO v_override_price FROM public.event_service_prices esp WHERE esp.event_id = v_event.id AND esp.service_id = v_sid;
    INSERT INTO public.appointment_services (appointment_id, service_id, price, duration_minutes)
    VALUES (v_appointment_id, v_sid, COALESCE(v_override_price, v_svc.price), v_svc.duration_minutes);
  END LOOP;

  -- Increment slot bookings
  UPDATE public.event_slots SET current_bookings = current_bookings + 1 WHERE id = p_slot_id;

  RETURN v_appointment_id;
END;
$$;
