-- Create waiting_list_status enum
CREATE TYPE public.waiting_list_status AS ENUM ('waiting', 'notified', 'confirmed', 'expired', 'cancelled');

-- Create waiting_list table
CREATE TABLE public.waiting_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_ids uuid[] NOT NULL,
  professional_id uuid REFERENCES public.profiles(id),
  desired_date date NOT NULL,
  status waiting_list_status NOT NULL DEFAULT 'waiting',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.waiting_list ENABLE ROW LEVEL SECURITY;

-- Clients can insert for themselves
CREATE POLICY "Clients can insert own waitlist entry" ON public.waiting_list
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Clients can view their own entries
CREATE POLICY "Clients can view own waitlist" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

-- Company professionals can view all entries
CREATE POLICY "Company can view waitlist" ON public.waiting_list
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

-- Company professionals can update entries (to change status)
CREATE POLICY "Professionals can update waitlist" ON public.waiting_list
  FOR UPDATE TO authenticated
  USING (has_company_role(auth.uid(), company_id, 'professional'::app_role));

-- Clients can cancel their own entries
CREATE POLICY "Clients can update own waitlist" ON public.waiting_list
  FOR UPDATE TO authenticated
  USING (client_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
