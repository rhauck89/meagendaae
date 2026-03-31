
-- Update create_client RPC to accept optional birth_date parameter
CREATE OR REPLACE FUNCTION public.create_client(
  p_company_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_cpf text,
  p_birth_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_client_id uuid;
BEGIN
  -- Try to find existing client by CPF
  IF p_cpf IS NOT NULL AND p_cpf <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE cpf = p_cpf AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- If not found try whatsapp
  IF v_client_id IS NULL AND p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE whatsapp = p_whatsapp AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- If found and birth_date provided but previously empty, update it
  IF v_client_id IS NOT NULL AND p_birth_date IS NOT NULL THEN
    UPDATE clients
    SET birth_date = COALESCE(birth_date, p_birth_date)
    WHERE id = v_client_id AND birth_date IS NULL;
  END IF;

  -- If still not found create new client
  IF v_client_id IS NULL THEN
    INSERT INTO clients (company_id, name, whatsapp, email, cpf, birth_date)
    VALUES (p_company_id, p_name, p_whatsapp, p_email, p_cpf, p_birth_date)
    RETURNING id INTO v_client_id;
  END IF;

  RETURN v_client_id;
END;
$function$;
