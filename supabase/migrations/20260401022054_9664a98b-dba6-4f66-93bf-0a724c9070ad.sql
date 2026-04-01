
-- Promotions table
CREATE TABLE public.promotions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  start_time time without time zone,
  end_time time without time zone,
  max_slots integer NOT NULL DEFAULT 0,
  used_slots integer NOT NULL DEFAULT 0,
  client_filter text NOT NULL DEFAULT 'all',
  client_filter_value integer,
  professional_filter text NOT NULL DEFAULT 'all',
  professional_ids uuid[],
  message_template text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Company members can manage promotions
CREATE POLICY "Company members can manage promotions"
  ON public.promotions FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Public can view active promotions
CREATE POLICY "Public can view active promotions"
  ON public.promotions FOR SELECT
  TO public
  USING (status = 'active' AND end_date >= CURRENT_DATE);

-- Promotion bookings tracking
CREATE TABLE public.promotion_bookings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id),
  client_id uuid REFERENCES public.clients(id),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.promotion_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage promotion bookings"
  ON public.promotion_bookings FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- Trigger to update used_slots
CREATE OR REPLACE FUNCTION public.increment_promotion_slots()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.promotions
  SET used_slots = used_slots + 1
  WHERE id = NEW.promotion_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_promotion_booking_insert
  AFTER INSERT ON public.promotion_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_promotion_slots();

-- Updated_at trigger
CREATE TRIGGER update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
