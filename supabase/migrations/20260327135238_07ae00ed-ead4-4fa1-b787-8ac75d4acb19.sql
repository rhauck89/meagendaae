CREATE TYPE public.business_type AS ENUM ('barbershop', 'esthetic');

ALTER TABLE public.companies
  ADD COLUMN business_type public.business_type NOT NULL DEFAULT 'barbershop';