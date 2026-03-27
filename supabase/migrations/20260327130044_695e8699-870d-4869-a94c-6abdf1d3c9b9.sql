
-- Add reminders_enabled flag to companies
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS reminders_enabled boolean NOT NULL DEFAULT true;

-- Add new webhook event types for granular reminders
-- Note: appointment_reminder already exists in the enum, we need to add the specific ones
ALTER TYPE public.webhook_event_type ADD VALUE IF NOT EXISTS 'appointment_reminder_24h';
ALTER TYPE public.webhook_event_type ADD VALUE IF NOT EXISTS 'appointment_reminder_3h';
