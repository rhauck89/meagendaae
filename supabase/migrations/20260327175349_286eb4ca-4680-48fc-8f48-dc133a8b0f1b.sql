
-- Create blocked_times table for manual time blocking
CREATE TABLE public.blocked_times (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid NOT NULL,
  professional_id uuid NOT NULL,
  block_date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.blocked_times ENABLE ROW LEVEL SECURITY;

-- Company members can manage blocked times
CREATE POLICY "Company members can manage blocked times"
ON public.blocked_times
FOR ALL
TO authenticated
USING (company_id = get_my_company_id())
WITH CHECK (company_id = get_my_company_id());

-- Public can view blocked times (needed for booking page availability calc)
CREATE POLICY "Public can view blocked times"
ON public.blocked_times
FOR SELECT
TO public
USING (true);
