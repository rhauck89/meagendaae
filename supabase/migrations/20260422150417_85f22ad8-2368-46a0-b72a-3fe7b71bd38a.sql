-- ============================================================
-- WHATSAPP CENTER MODULE
-- ============================================================

-- Enums
CREATE TYPE public.whatsapp_status AS ENUM ('disconnected', 'connecting', 'connected', 'error');
CREATE TYPE public.whatsapp_message_status AS ENUM ('pending', 'sent', 'delivered', 'read', 'failed');
CREATE TYPE public.whatsapp_automation_trigger AS ENUM (
  'appointment_confirmed',
  'appointment_reminder',
  'post_service_review',
  'inactive_client',
  'birthday',
  'appointment_cancelled',
  'appointment_rescheduled',
  'loyalty_cashback',
  'waitlist_slot_open'
);

-- ============================================================
-- 1. INSTANCES (one connection per company)
-- ============================================================
CREATE TABLE public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE,
  instance_id TEXT,
  session_name TEXT,
  phone TEXT,
  status public.whatsapp_status NOT NULL DEFAULT 'disconnected',
  qr_code TEXT,
  last_seen_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage own instance"
  ON public.whatsapp_instances FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Super admins manage all instances"
  ON public.whatsapp_instances FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================
-- 2. TEMPLATES
-- ============================================================
CREATE TABLE public.whatsapp_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  body TEXT NOT NULL,
  variables TEXT[] NOT NULL DEFAULT '{}',
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_templates_company ON public.whatsapp_templates(company_id);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage templates"
  ON public.whatsapp_templates FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Super admins manage all templates"
  ON public.whatsapp_templates FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================
-- 3. AUTOMATIONS
-- ============================================================
CREATE TABLE public.whatsapp_automations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  trigger public.whatsapp_automation_trigger NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 0,
  send_window_start TIME NOT NULL DEFAULT '08:00',
  send_window_end TIME NOT NULL DEFAULT '20:00',
  weekdays SMALLINT[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  daily_limit INTEGER NOT NULL DEFAULT 100,
  exclude_blocked BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, trigger)
);

CREATE INDEX idx_whatsapp_automations_company ON public.whatsapp_automations(company_id);

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members manage automations"
  ON public.whatsapp_automations FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Super admins manage all automations"
  ON public.whatsapp_automations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================
-- 4. LOGS
-- ============================================================
CREATE TABLE public.whatsapp_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  client_id UUID,
  client_name TEXT,
  phone TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'manual',
  template_id UUID REFERENCES public.whatsapp_templates(id) ON DELETE SET NULL,
  automation_id UUID REFERENCES public.whatsapp_automations(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  status public.whatsapp_message_status NOT NULL DEFAULT 'pending',
  source TEXT,
  error_message TEXT,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_whatsapp_logs_company_created ON public.whatsapp_logs(company_id, created_at DESC);
CREATE INDEX idx_whatsapp_logs_status ON public.whatsapp_logs(company_id, status);

ALTER TABLE public.whatsapp_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view logs"
  ON public.whatsapp_logs FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Company members insert logs"
  ON public.whatsapp_logs FOR INSERT
  TO authenticated
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Company members update logs"
  ON public.whatsapp_logs FOR UPDATE
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Super admins view all logs"
  ON public.whatsapp_logs FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================
-- 5. METRICS (daily aggregate)
-- ============================================================
CREATE TABLE public.whatsapp_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  metric_date DATE NOT NULL,
  sent_count INTEGER NOT NULL DEFAULT 0,
  delivered_count INTEGER NOT NULL DEFAULT 0,
  read_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  reply_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, metric_date)
);

CREATE INDEX idx_whatsapp_metrics_company_date ON public.whatsapp_metrics(company_id, metric_date DESC);

ALTER TABLE public.whatsapp_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members view metrics"
  ON public.whatsapp_metrics FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());

CREATE POLICY "Company members manage metrics"
  ON public.whatsapp_metrics FOR ALL
  TO authenticated
  USING (company_id = get_my_company_id())
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "Super admins view all metrics"
  ON public.whatsapp_metrics FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'super_admin'::app_role));

-- ============================================================
-- Triggers for updated_at
-- ============================================================
CREATE TRIGGER trg_whatsapp_instances_updated
  BEFORE UPDATE ON public.whatsapp_instances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_whatsapp_templates_updated
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_whatsapp_automations_updated
  BEFORE UPDATE ON public.whatsapp_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_whatsapp_metrics_updated
  BEFORE UPDATE ON public.whatsapp_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();