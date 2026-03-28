DROP FUNCTION IF EXISTS public.create_client(text, text, text, text, uuid);
DROP FUNCTION IF EXISTS public.create_client(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.create_client(
  p_company_id uuid,
  p_name text,
  p_whatsapp text,
  p_email text,
  p_cpf text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- If still not found create new client
  IF v_client_id IS NULL THEN
    INSERT INTO clients (company_id, name, whatsapp, email, cpf)
    VALUES (p_company_id, p_name, p_whatsapp, p_email, p_cpf)
    RETURNING id INTO v_client_id;
  END IF;

  RETURN v_client_id;
END;
$$;

ALTER FUNCTION public.create_client(uuid, text, text, text, text) OWNER TO postgres;