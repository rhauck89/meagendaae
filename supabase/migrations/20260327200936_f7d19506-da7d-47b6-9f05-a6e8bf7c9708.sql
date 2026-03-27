CREATE INDEX IF NOT EXISTS idx_collaborators_company_active ON public.collaborators (company_id, active);
CREATE INDEX IF NOT EXISTS idx_service_professionals_service_prof ON public.service_professionals (service_id, professional_id);
CREATE INDEX IF NOT EXISTS idx_professional_working_hours_company ON public.professional_working_hours (company_id);
CREATE INDEX IF NOT EXISTS idx_appointments_prof_start ON public.appointments (professional_id, start_time);