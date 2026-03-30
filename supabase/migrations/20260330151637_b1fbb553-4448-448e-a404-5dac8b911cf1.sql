-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  professional_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  rating smallint NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(appointment_id)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can view reviews (public ratings)
CREATE POLICY "Public can view reviews"
  ON public.reviews FOR SELECT
  TO public
  USING (true);

-- Reviews are created via RPC, but allow insert for authenticated users
CREATE POLICY "Authenticated can insert reviews"
  ON public.reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Company members can manage reviews
CREATE POLICY "Company members can manage reviews"
  ON public.reviews FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

-- RPC to get average rating per professional
CREATE OR REPLACE FUNCTION public.get_professional_ratings(p_company_id uuid)
RETURNS TABLE(professional_id uuid, avg_rating numeric, review_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    r.professional_id,
    ROUND(AVG(r.rating), 1) as avg_rating,
    COUNT(*) as review_count
  FROM public.reviews r
  WHERE r.company_id = p_company_id
  GROUP BY r.professional_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_professional_ratings(uuid) TO anon, authenticated;

-- RPC to submit a review securely
CREATE OR REPLACE FUNCTION public.submit_review(
  p_appointment_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_review_id uuid;
  v_professional_id uuid;
  v_company_id uuid;
  v_client_id uuid;
  v_status text;
BEGIN
  -- Get appointment details
  SELECT professional_id, company_id, client_id, status
  INTO v_professional_id, v_company_id, v_client_id, v_status
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Validate rating
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  -- Sanitize comment length
  IF p_comment IS NOT NULL AND length(p_comment) > 500 THEN
    p_comment := substring(p_comment FROM 1 FOR 500);
  END IF;

  -- Check if already reviewed
  IF EXISTS (SELECT 1 FROM public.reviews WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'This appointment has already been reviewed';
  END IF;

  INSERT INTO public.reviews (appointment_id, professional_id, company_id, client_id, rating, comment)
  VALUES (p_appointment_id, v_professional_id, v_company_id, v_client_id, p_rating, p_comment)
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) TO anon, authenticated;