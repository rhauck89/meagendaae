-- Add return frequency columns to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS average_return_days numeric,
  ADD COLUMN IF NOT EXISTS last_visit_date date,
  ADD COLUMN IF NOT EXISTS expected_return_date date;

-- Create a function to recalculate return stats for all clients of a company
CREATE OR REPLACE FUNCTION public.recalculate_client_return_stats(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
  avg_days numeric;
  last_date date;
BEGIN
  FOR rec IN
    SELECT DISTINCT client_id
    FROM appointments
    WHERE company_id = _company_id AND status = 'completed'
  LOOP
    -- Calculate average days between completed visits
    SELECT
      AVG(day_diff),
      MAX(visit_date)
    INTO avg_days, last_date
    FROM (
      SELECT
        start_time::date AS visit_date,
        EXTRACT(EPOCH FROM (start_time - LAG(start_time) OVER (ORDER BY start_time))) / 86400.0 AS day_diff
      FROM appointments
      WHERE client_id = rec.client_id
        AND company_id = _company_id
        AND status = 'completed'
      ORDER BY start_time
    ) sub
    WHERE day_diff IS NOT NULL;

    -- Update the profile
    UPDATE profiles
    SET
      average_return_days = ROUND(avg_days, 1),
      last_visit_date = last_date,
      expected_return_date = CASE WHEN avg_days IS NOT NULL AND last_date IS NOT NULL THEN last_date + ROUND(avg_days)::int ELSE NULL END
    WHERE id = rec.client_id;
  END LOOP;
END;
$$;
