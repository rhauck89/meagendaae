ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS whatsapp_reminder_1d_sent BOOLEAN DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_appointments_whatsapp_reminder_1d_sent ON public.appointments(whatsapp_reminder_1d_sent);
