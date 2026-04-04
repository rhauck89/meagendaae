
CREATE TABLE public.event_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  event_price numeric,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (event_id, service_id)
);

ALTER TABLE public.event_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company members can manage event services"
ON public.event_services FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM events e WHERE e.id = event_services.event_id AND e.company_id = get_my_company_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM events e WHERE e.id = event_services.event_id AND e.company_id = get_my_company_id()
));

CREATE POLICY "Public can view event services of published events"
ON public.event_services FOR SELECT
TO public
USING (EXISTS (
  SELECT 1 FROM events e WHERE e.id = event_services.event_id AND e.status = 'published'::event_status
));
