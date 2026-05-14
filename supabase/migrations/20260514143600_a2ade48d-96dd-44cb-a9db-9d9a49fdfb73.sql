-- Migration to update client_subscriptions for the new professional link

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'client_subscriptions' AND column_name = 'professional_id') THEN
        ALTER TABLE public.client_subscriptions ADD COLUMN professional_id UUID REFERENCES public.profiles(id);
    END IF;
END $$;

COMMENT ON COLUMN public.client_subscriptions.professional_id IS 'The professional responsible for this client subscription. Only this professional can be used with this subscription.';
