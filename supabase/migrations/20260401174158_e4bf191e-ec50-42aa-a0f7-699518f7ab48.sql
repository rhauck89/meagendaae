
-- Create storage bucket for support attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('support-attachments', 'support-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Support tickets table
CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'open',
  priority text NOT NULL DEFAULT 'medium',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Support messages table
CREATE TABLE public.support_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  message text NOT NULL,
  is_admin boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Support attachments table
CREATE TABLE public.support_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE CASCADE NOT NULL,
  message_id uuid REFERENCES public.support_messages(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_support_tickets_company ON public.support_tickets(company_id);
CREATE INDEX idx_support_tickets_user ON public.support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON public.support_tickets(status);
CREATE INDEX idx_support_messages_ticket ON public.support_messages(ticket_id);
CREATE INDEX idx_support_attachments_ticket ON public.support_attachments(ticket_id);

-- Enable RLS
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: support_tickets
CREATE POLICY "Users can view own tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Super admins can manage all tickets"
  ON public.support_tickets FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS: support_messages
CREATE POLICY "Users can view messages on own tickets"
  ON public.support_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can send messages on own tickets"
  ON public.support_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_messages.ticket_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all messages"
  ON public.support_messages FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- RLS: support_attachments
CREATE POLICY "Users can view attachments on own tickets"
  ON public.support_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_attachments.ticket_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Users can add attachments to own tickets"
  ON public.support_attachments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.support_tickets t
    WHERE t.id = support_attachments.ticket_id AND t.user_id = auth.uid()
  ));

CREATE POLICY "Super admins can manage all attachments"
  ON public.support_attachments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'super_admin'))
  WITH CHECK (has_role(auth.uid(), 'super_admin'));

-- Storage RLS for support-attachments bucket
CREATE POLICY "Users can upload support attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Super admins can view all support attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'support-attachments' AND has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins can manage support attachments"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'support-attachments' AND has_role(auth.uid(), 'super_admin'))
  WITH CHECK (bucket_id = 'support-attachments' AND has_role(auth.uid(), 'super_admin'));
