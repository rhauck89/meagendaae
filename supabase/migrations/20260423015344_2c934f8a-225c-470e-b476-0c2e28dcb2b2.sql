-- 1. Add completed_at column
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

-- 2. Trigger function to auto-set completed_at
CREATE OR REPLACE FUNCTION public.set_appointment_completed_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When status transitions TO completed, stamp completed_at if not already set
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := now();
    END IF;
  END IF;

  -- If reverted away from completed, clear the timestamp
  IF NEW.status <> 'completed' AND OLD.status = 'completed' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

-- 3. Attach trigger
DROP TRIGGER IF EXISTS trg_set_appointment_completed_at ON public.appointments;
CREATE TRIGGER trg_set_appointment_completed_at
BEFORE UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.set_appointment_completed_at();

-- 4. Backfill existing completed appointments (use end_time as best estimate)
UPDATE public.appointments
SET completed_at = end_time
WHERE status = 'completed' AND completed_at IS NULL;

-- 5. Index for efficient lookups in reviews-followup window queries
CREATE INDEX IF NOT EXISTS idx_appointments_completed_at
  ON public.appointments (completed_at)
  WHERE status = 'completed';