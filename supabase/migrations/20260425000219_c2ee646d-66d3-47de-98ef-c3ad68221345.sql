-- Add special_schedule and extra_fee to appointments
ALTER TABLE public.appointments 
ADD COLUMN IF NOT EXISTS special_schedule BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS extra_fee NUMERIC(10,2) DEFAULT 0;

-- Update types for these columns (optional but good practice)
COMMENT ON COLUMN public.appointments.special_schedule IS 'Indicates if the appointment was created from a special schedule request';
COMMENT ON COLUMN public.appointments.extra_fee IS 'Additional fee charged for special schedule requests';
