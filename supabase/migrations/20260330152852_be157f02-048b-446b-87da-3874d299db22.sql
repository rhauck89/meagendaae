
-- Add barbershop_rating column to reviews
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS barbershop_rating smallint;

-- Add constraint for barbershop_rating
ALTER TABLE public.reviews ADD CONSTRAINT reviews_barbershop_rating_check CHECK (barbershop_rating IS NULL OR (barbershop_rating >= 1 AND barbershop_rating <= 5));

-- Update submit_review to accept barbershop_rating
CREATE OR REPLACE FUNCTION public.submit_review(
  p_appointment_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL,
  p_barbershop_rating smallint DEFAULT NULL
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
  SELECT professional_id, company_id, client_id, status
  INTO v_professional_id, v_company_id, v_client_id, v_status
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5';
  END IF;

  IF p_barbershop_rating IS NOT NULL AND (p_barbershop_rating < 1 OR p_barbershop_rating > 5) THEN
    RAISE EXCEPTION 'Barbershop rating must be between 1 and 5';
  END IF;

  IF p_comment IS NOT NULL AND length(p_comment) > 500 THEN
    p_comment := substring(p_comment FROM 1 FOR 500);
  END IF;

  IF EXISTS (SELECT 1 FROM public.reviews WHERE appointment_id = p_appointment_id) THEN
    RAISE EXCEPTION 'This appointment has already been reviewed';
  END IF;

  INSERT INTO public.reviews (appointment_id, professional_id, company_id, client_id, rating, barbershop_rating, comment)
  VALUES (p_appointment_id, v_professional_id, v_company_id, v_client_id, p_rating, p_barbershop_rating, p_comment)
  RETURNING id INTO v_review_id;

  RETURN v_review_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text, smallint) TO anon, authenticated;

-- Add review_request webhook event type
ALTER TYPE public.webhook_event_type ADD VALUE IF NOT EXISTS 'review_request';
