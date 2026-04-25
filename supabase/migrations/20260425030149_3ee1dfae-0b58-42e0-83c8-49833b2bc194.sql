-- 1. Remover restrição antiga e preparar colunas
ALTER TABLE public.reviews DROP CONSTRAINT IF EXISTS reviews_appointment_id_key;
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS review_type TEXT DEFAULT 'professional';

-- 2. Migrar dados existentes antes de aplicar a nova restrição
-- Se houver linhas sem review_type, definir como professional
UPDATE public.reviews SET review_type = 'professional' WHERE review_type IS NULL;

-- Criar novas linhas para avaliações de empresa que estavam embutidas nas linhas de profissional
INSERT INTO public.reviews (
  appointment_id, professional_id, company_id, client_id, 
  rating, comment, created_at, review_type
)
SELECT 
  appointment_id, professional_id, company_id, client_id, 
  barbershop_rating, barbershop_comment, created_at, 'company'
FROM public.reviews 
WHERE barbershop_rating IS NOT NULL 
AND NOT EXISTS (
  SELECT 1 FROM public.reviews r2 
  WHERE r2.appointment_id = public.reviews.appointment_id 
  AND r2.review_type = 'company'
);

-- Limpar dados redundantes nas linhas de profissional
UPDATE public.reviews 
SET barbershop_rating = NULL, barbershop_comment = NULL
WHERE review_type = 'professional';

-- 3. Adicionar nova restrição de unicidade composta
ALTER TABLE public.reviews ADD CONSTRAINT reviews_appointment_type_key UNIQUE (appointment_id, review_type);

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_reviews_review_type ON public.reviews(review_type);

-- 5. Atualizar a função submit_review
CREATE OR REPLACE FUNCTION public.submit_review(
  p_appointment_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL,
  p_barbershop_rating smallint DEFAULT NULL,
  p_barbershop_comment text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_review_id uuid;
  v_professional_id uuid;
  v_company_id uuid;
  v_client_id uuid;
BEGIN
  -- Buscar detalhes do agendamento
  SELECT professional_id, company_id, client_id
  INTO v_professional_id, v_company_id, v_client_id
  FROM public.appointments
  WHERE id = p_appointment_id;

  IF v_professional_id IS NULL THEN
    RAISE EXCEPTION 'Agendamento não encontrado';
  END IF;

  -- Validar se já existem ambas as avaliações
  IF (SELECT count(*) FROM public.reviews WHERE appointment_id = p_appointment_id) >= 2 THEN
    RAISE EXCEPTION 'Este agendamento já foi totalmente avaliado';
  END IF;

  -- Inserir avaliação do profissional (Step 1)
  -- Tentamos inserir apenas se não existir ainda para este tipo
  IF p_rating IS NOT NULL AND p_rating > 0 AND NOT EXISTS (SELECT 1 FROM public.reviews WHERE appointment_id = p_appointment_id AND review_type = 'professional') THEN
    INSERT INTO public.reviews (
      appointment_id, professional_id, company_id, client_id, 
      rating, comment, review_type
    )
    VALUES (
      p_appointment_id, v_professional_id, v_company_id, v_client_id, 
      p_rating, p_comment, 'professional'
    )
    RETURNING id INTO v_review_id;
  END IF;

  -- Inserir avaliação da empresa (Step 2)
  IF p_barbershop_rating IS NOT NULL AND p_barbershop_rating > 0 AND NOT EXISTS (SELECT 1 FROM public.reviews WHERE appointment_id = p_appointment_id AND review_type = 'company') THEN
    INSERT INTO public.reviews (
      appointment_id, professional_id, company_id, client_id, 
      rating, comment, review_type
    )
    VALUES (
      p_appointment_id, v_professional_id, v_company_id, v_client_id, 
      p_barbershop_rating, p_barbershop_comment, 'company'
    );
    
    IF v_review_id IS NULL THEN
      SELECT id INTO v_review_id FROM public.reviews 
      WHERE appointment_id = p_appointment_id AND review_type = 'company' 
      LIMIT 1;
    END IF;
  END IF;

  RETURN v_review_id;
END;
$$;
