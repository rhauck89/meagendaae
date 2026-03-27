-- Auto-link: when a collaborator is created, link them to all active company services
CREATE OR REPLACE FUNCTION public.auto_link_collaborator_to_services()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  linked_count INT;
BEGIN
  INSERT INTO public.service_professionals (service_id, professional_id, company_id)
  SELECT s.id, NEW.profile_id, NEW.company_id
  FROM public.services s
  WHERE s.company_id = NEW.company_id
    AND s.active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.service_professionals sp
      WHERE sp.service_id = s.id AND sp.professional_id = NEW.profile_id
    );

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RAISE LOG 'auto_link_collaborator_to_services: linked % services to professional % in company %',
    linked_count, NEW.profile_id, NEW.company_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_collaborator_services ON public.collaborators;
CREATE TRIGGER trg_auto_link_collaborator_services
  AFTER INSERT ON public.collaborators
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_collaborator_to_services();

-- Also auto-link: when a new service is created, link it to all active collaborators in the company
CREATE OR REPLACE FUNCTION public.auto_link_service_to_collaborators()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  linked_count INT;
BEGIN
  INSERT INTO public.service_professionals (service_id, professional_id, company_id)
  SELECT NEW.id, c.profile_id, NEW.company_id
  FROM public.collaborators c
  WHERE c.company_id = NEW.company_id
    AND c.active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.service_professionals sp
      WHERE sp.service_id = NEW.id AND sp.professional_id = c.profile_id
    );

  GET DIAGNOSTICS linked_count = ROW_COUNT;
  RAISE LOG 'auto_link_service_to_collaborators: linked service % to % professionals in company %',
    NEW.id, linked_count, NEW.company_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_link_service_collaborators ON public.services;
CREATE TRIGGER trg_auto_link_service_collaborators
  AFTER INSERT ON public.services
  FOR EACH ROW
  EXECUTE FUNCTION auto_link_service_to_collaborators();