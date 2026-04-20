-- HOTFIX: Corrige a exclusion constraint para usar boundaries half-open '[)'
-- Sem isso, horários consecutivos (09:23 fim / 09:23 início) podem gerar
-- falsos conflitos por arredondamento de microsegundos no tstzrange.
--
-- Comportamento correto com '[)':
--   inclui início, exclui fim
--   09:00-09:23 e 09:23-09:53 → permitido ✓
--   09:00-09:23 e 09:22-09:40 → bloqueado ✓
--
-- A constraint continua filtrando por professional_id, então um profissional
-- NUNCA bloqueia outro.

ALTER TABLE public.appointments
  DROP CONSTRAINT IF EXISTS no_overlapping_appointments;

ALTER TABLE public.appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    professional_id WITH =,
    tstzrange(start_time, end_time, '[)') WITH &&
  )
  WHERE (status NOT IN ('cancelled', 'no_show', 'rescheduled'));