ALTER TABLE public.whatsapp_otp_codes ADD COLUMN company_id UUID;

-- Optional: If you want to enforce company_id later, you can add a foreign key
-- ALTER TABLE public.whatsapp_otp_codes ADD CONSTRAINT whatsapp_otp_codes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;
