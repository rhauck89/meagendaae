
-- Drop both overloaded create_client functions
DROP FUNCTION IF EXISTS public.create_client(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_client(uuid, text, text, text, text, date);

-- Create single create_client function without CPF
CREATE OR REPLACE FUNCTION public.create_client(
  p_company_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text DEFAULT NULL,
  p_birth_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
BEGIN
  -- Find existing client by whatsapp
  IF p_whatsapp IS NOT NULL AND p_whatsapp <> '' THEN
    SELECT id INTO v_client_id
    FROM clients
    WHERE whatsapp = p_whatsapp AND company_id = p_company_id
    LIMIT 1;
  END IF;

  -- If found, enrich empty fields
  IF v_client_id IS NOT NULL THEN
    UPDATE clients
    SET
      email = COALESCE(email, NULLIF(p_email, '')),
      birth_date = COALESCE(birth_date, p_birth_date),
      name = COALESCE(NULLIF(p_name, ''), name)
    WHERE id = v_client_id;
    RETURN v_client_id;
  END IF;

  -- Create new client without CPF
  INSERT INTO clients (company_id, name, whatsapp, email, birth_date)
  VALUES (p_company_id, p_name, p_whatsapp, NULLIF(p_email, ''), p_birth_date)
  RETURNING id INTO v_client_id;

  RETURN v_client_id;
END;
$$;

-- Drop the CPF unique index since CPF is no longer used
DROP INDEX IF EXISTS idx_clients_company_cpf;
