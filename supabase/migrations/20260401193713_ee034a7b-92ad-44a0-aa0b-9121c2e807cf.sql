
CREATE TABLE public.platform_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  target_plan uuid REFERENCES public.plans(id) ON DELETE SET NULL,
  target_business_type text DEFAULT 'all',
  send_whatsapp boolean NOT NULL DEFAULT false,
  send_dashboard_notification boolean NOT NULL DEFAULT true,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid DEFAULT auth.uid()
);

ALTER TABLE public.platform_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can manage platform messages"
ON public.platform_messages FOR ALL TO authenticated
USING (has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE POLICY "Authenticated users can view active messages"
ON public.platform_messages FOR SELECT TO authenticated
USING (active = true);
