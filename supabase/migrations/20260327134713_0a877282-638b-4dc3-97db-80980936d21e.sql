ALTER TABLE public.collaborators
ALTER COLUMN commission_type SET DEFAULT 'none'::public.commission_type;

UPDATE public.collaborators
SET commission_type = CASE
  WHEN commission_type IS NULL THEN CASE
    WHEN COALESCE(commission_percent, 0) > 0 THEN 'percentage'::public.commission_type
    ELSE 'none'::public.commission_type
  END
  ELSE commission_type
END,
commission_value = CASE
  WHEN COALESCE(commission_value, 0) = 0 AND COALESCE(commission_percent, 0) > 0 THEN commission_percent
  ELSE COALESCE(commission_value, 0)
END;