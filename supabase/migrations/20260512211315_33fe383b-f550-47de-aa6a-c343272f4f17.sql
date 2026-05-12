-- Update existing appointments
UPDATE public.appointments
SET is_subscription_covered = true
WHERE id IN (SELECT appointment_id FROM public.subscription_usage);

-- Function to update appointment subscription coverage
CREATE OR REPLACE FUNCTION public.handle_subscription_usage()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.appointment_id IS NOT NULL) THEN
        UPDATE public.appointments
        SET is_subscription_covered = true
        WHERE id = NEW.appointment_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for subscription_usage
DROP TRIGGER IF EXISTS on_subscription_usage_added ON public.subscription_usage;
CREATE TRIGGER on_subscription_usage_added
AFTER INSERT ON public.subscription_usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_subscription_usage();
