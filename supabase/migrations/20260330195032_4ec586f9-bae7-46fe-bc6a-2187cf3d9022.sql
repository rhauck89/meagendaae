
-- Add recommended_return_days to services table (default NULL means use company average)
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS recommended_return_days integer;

-- Add next_recommended_visit to clients table
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS next_recommended_visit date;

-- Create function to calculate and set next_recommended_visit when appointment is completed
CREATE OR REPLACE FUNCTION public.update_client_return_date()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_avg_days numeric;
  v_client_id uuid;
  v_company_id uuid;
BEGIN
  -- Only trigger when status changes to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status <> 'completed') THEN
    v_client_id := NEW.client_id;
    v_company_id := NEW.company_id;

    IF v_client_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- Calculate weighted average return days from appointment services
    SELECT AVG(COALESCE(s.recommended_return_days, 25))
    INTO v_avg_days
    FROM public.appointment_services aps
    JOIN public.services s ON s.id = aps.service_id
    WHERE aps.appointment_id = NEW.id
      AND s.recommended_return_days IS NOT NULL;

    -- If no services have recommended days, use default 25
    IF v_avg_days IS NULL THEN
      v_avg_days := 25;
    END IF;

    -- Update the client's next_recommended_visit
    UPDATE public.clients
    SET next_recommended_visit = CURRENT_DATE + ROUND(v_avg_days)::integer
    WHERE id = v_client_id AND company_id = v_company_id;

    -- Also update profile expected_return_date for dashboard stats
    UPDATE public.profiles
    SET expected_return_date = CURRENT_DATE + ROUND(v_avg_days)::integer,
        last_visit_date = CURRENT_DATE
    WHERE id = v_client_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_update_client_return_date ON public.appointments;
CREATE TRIGGER trg_update_client_return_date
  AFTER UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_client_return_date();
