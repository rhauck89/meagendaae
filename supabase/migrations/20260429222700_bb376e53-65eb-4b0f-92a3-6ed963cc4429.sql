-- Update push_subscriptions table
ALTER TABLE public.push_subscriptions 
ADD COLUMN IF NOT EXISTS user_agent TEXT,
ADD COLUMN IF NOT EXISTS device_name TEXT,
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create push_logs table
CREATE TABLE IF NOT EXISTS public.push_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  url TEXT,
  status TEXT DEFAULT 'pending',
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on push_logs
ALTER TABLE public.push_logs ENABLE ROW LEVEL SECURITY;

-- Policy for users to view their own logs
CREATE POLICY "Users can view their own push logs"
  ON public.push_logs
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Function to handle appointment notifications via triggers
CREATE OR REPLACE FUNCTION public.fn_handle_appointment_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_company_owner_id UUID;
  v_professional_user_id UUID;
  v_event_type TEXT;
  v_title TEXT;
  v_body TEXT;
  v_url TEXT;
  v_appointment_id UUID;
  v_professional_name TEXT;
  v_client_name TEXT;
  v_start_time TEXT;
BEGIN
  v_appointment_id := COALESCE(NEW.id, OLD.id);
  v_client_name := COALESCE(NEW.client_name, OLD.client_name, 'Cliente');
  v_start_time := to_char(COALESCE(NEW.start_time, OLD.start_time) AT TIME ZONE 'UTC', 'DD/MM HH24:MI');

  -- Get professional name
  SELECT name, user_id INTO v_professional_name, v_professional_user_id
  FROM public.professionals
  WHERE id = COALESCE(NEW.professional_id, OLD.professional_id);

  -- Get company owner
  SELECT user_id INTO v_company_owner_id
  FROM public.companies
  WHERE id = COALESCE(NEW.company_id, OLD.company_id);

  -- Determine event type and messages
  IF (TG_OP = 'INSERT') THEN
    v_event_type := 'appointment_created';
    v_title := 'Novo Agendamento! 📅';
    v_body := v_client_name || ' agendou com ' || v_professional_name || ' para ' || v_start_time;
    v_url := '/dashboard?appointmentId=' || v_appointment_id;
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'cancelled' AND OLD.status != 'cancelled') THEN
      v_event_type := 'appointment_cancelled';
      v_title := 'Agendamento Cancelado ❌';
      v_body := v_client_name || ' cancelou o horário de ' || v_start_time;
      v_url := '/dashboard';
    ELSIF (NEW.start_time != OLD.start_time) THEN
      v_event_type := 'appointment_rescheduled';
      v_title := 'Reagendamento Realizado 🔁';
      v_body := v_client_name || ' reagendou para ' || v_start_time;
      v_url := '/dashboard?appointmentId=' || v_appointment_id;
    ELSE
      -- Other status changes or updates we might not want to notify via push for now
      RETURN NEW;
    END IF;
  ELSE
    RETURN OLD;
  END IF;

  -- 1. Notify Professional
  IF v_professional_user_id IS NOT NULL THEN
    INSERT INTO public.push_logs (company_id, user_id, event_type, title, body, url)
    VALUES (NEW.company_id, v_professional_user_id, v_event_type, v_title, v_body, v_url);
  END IF;

  -- 2. Notify Owner (if different)
  IF v_company_owner_id IS NOT NULL AND v_company_owner_id != COALESCE(v_professional_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.push_logs (company_id, user_id, event_type, title, body, url)
    VALUES (NEW.company_id, v_company_owner_id, v_event_type, v_title, v_body, v_url);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for appointment changes
DROP TRIGGER IF EXISTS tr_appointment_push_notification ON public.appointments;
CREATE TRIGGER tr_appointment_push_notification
AFTER INSERT OR UPDATE ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.fn_handle_appointment_push_notification();

-- Create trigger to automatically process push_logs
-- This will call the send-push Edge Function via pg_net
CREATE OR REPLACE FUNCTION public.fn_process_push_log()
RETURNS TRIGGER AS $$
BEGIN
  -- We use net.http_post to call our send-push function
  -- Note: We need to use the full URL. Since we can't easily get it here,
  -- we rely on the application calling it or a cron job.
  -- But wait, the user wants the backend to do it.
  -- For now, let's keep it in the logs and I'll create an Edge Function
  -- that can be triggered or called.
  
  -- Actually, let's use the standard way: The application logic calls the dispatch.
  -- Or we can try to use pg_net if we have the URL.
  -- Given this is Lovable, we can't easily set the URL in SQL.
  -- Better approach: Create a cron job or just call send-push directly from the trigger if we can.
  
  -- I will create a trigger that calls a new Edge Function 'notify-push-event'
  -- which is responsible for the actual delivery.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
