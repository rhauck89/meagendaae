
-- Add protocol_number column to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS protocol_number text UNIQUE;

-- Create sequence for protocol numbers
CREATE SEQUENCE IF NOT EXISTS support_ticket_seq START 10001;

-- Create function to auto-generate protocol number
CREATE OR REPLACE FUNCTION public.generate_ticket_protocol()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.protocol_number := 'SUP-' || EXTRACT(YEAR FROM now())::text || '-' || LPAD(nextval('support_ticket_seq')::text, 6, '0');
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS set_ticket_protocol ON public.support_tickets;
CREATE TRIGGER set_ticket_protocol
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_ticket_protocol();

-- Also allow company members (not just the ticket owner) to view company tickets
CREATE POLICY "Company members can view company tickets"
  ON public.support_tickets
  FOR SELECT
  TO authenticated
  USING (company_id = get_my_company_id());
