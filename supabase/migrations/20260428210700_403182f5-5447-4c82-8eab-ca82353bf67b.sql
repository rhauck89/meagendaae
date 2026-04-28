-- Add global_client_id to clients table
ALTER TABLE public.clients 
ADD COLUMN global_client_id UUID REFERENCES public.clients_global(id) ON DELETE SET NULL;

-- Create an index for faster lookups
CREATE INDEX idx_clients_global_client_id ON public.clients(global_client_id);