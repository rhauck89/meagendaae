-- Fix for non-existent public.professionals table in push notification trigger
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
  v_log_id UUID;
BEGIN
  v_appointment_id := COALESCE(NEW.id, OLD.id);
  v_client_name := COALESCE(NEW.client_name, OLD.client_name, 'Cliente');
  v_start_time := to_char(COALESCE(NEW.start_time, OLD.start_time) AT TIME ZONE 'UTC', 'DD/MM HH24:MI');

  -- Correctly get professional name and user_id from profiles table
  -- professional_id in appointments refers to profiles.id
  SELECT full_name, user_id INTO v_professional_name, v_professional_user_id
  FROM public.profiles
  WHERE id = COALESCE(NEW.professional_id, OLD.professional_id);

  -- Get company owner user_id
  SELECT user_id INTO v_company_owner_id
  FROM public.companies
  WHERE id = COALESCE(NEW.company_id, OLD.company_id);

  -- Determine event type and messages
  IF (TG_OP = 'INSERT') THEN
    v_event_type := 'appointment_created';
    v_title := 'Novo Agendamento! 📅';
    v_body := v_client_name || ' agendou com ' || COALESCE(v_professional_name, 'profissional') || ' para ' || v_start_time;
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
      RETURN NEW;
    END IF;
  ELSE
    RETURN OLD;
  END IF;

  -- Notify Professional
  IF v_professional_user_id IS NOT NULL THEN
    INSERT INTO public.push_logs (company_id, user_id, event_type, title, body, url, status)
    VALUES (COALESCE(NEW.company_id, OLD.company_id), v_professional_user_id, v_event_type, v_title, v_body, v_url, 'pending')
    RETURNING id INTO v_log_id;

    -- Call Edge Function via pg_net
    PERFORM net.http_post(
      url := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidWpuZGptYWluaXpnbWxpZ3h0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1MTQwMSwiZXhwIjoyMDkwMTI3NDAxfQ.qrhQ5TLyL_KSb8LD0DPqZRYRr14JzEkn7XjibSldsOA'
      ),
      body := jsonb_build_object(
        'user_id', v_professional_user_id,
        'title', v_title,
        'body', v_body,
        'url', v_url,
        'log_id', v_log_id
      )
    );
  END IF;

  -- Notify Owner (if different)
  IF v_company_owner_id IS NOT NULL AND v_company_owner_id != COALESCE(v_professional_user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.push_logs (company_id, user_id, event_type, title, body, url, status)
    VALUES (COALESCE(NEW.company_id, OLD.company_id), v_company_owner_id, v_event_type, v_title, v_body, v_url, 'pending')
    RETURNING id INTO v_log_id;

    PERFORM net.http_post(
      url := 'https://fbujndjmainizgmligxt.supabase.co/functions/v1/send-push',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidWpuZGptYWluaXpnbWxpZ3h0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU1MTQwMSwiZXhwIjoyMDkwMTI3NDAxfQ.qrhQ5TLyL_KSb8LD0DPqZRYRr14JzEkn7XjibSldsOA'
      ),
      body := jsonb_build_object(
        'user_id', v_company_owner_id,
        'title', v_title,
        'body', v_body,
        'url', v_url,
        'log_id', v_log_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;