-- Create a table for application error logs
CREATE TABLE public.app_error_logs (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NULL REFERENCES public.companies(id),
    user_id UUID NULL,
    context TEXT NOT NULL,
    friendly_title TEXT,
    friendly_message TEXT,
    technical_message TEXT,
    error_code TEXT,
    error_name TEXT,
    stack TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.app_error_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for access
CREATE POLICY "Anyone authenticated can insert their own errors" 
ON public.app_error_logs 
FOR INSERT 
TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Only super_admins can view error logs" 
ON public.app_error_logs 
FOR SELECT 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR system_role = 'super_admin')
    )
);

CREATE POLICY "Only super_admins can delete error logs" 
ON public.app_error_logs 
FOR DELETE 
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND (role = 'super_admin' OR system_role = 'super_admin')
    )
);

-- Create indexes for performance
CREATE INDEX idx_app_error_logs_created_at ON public.app_error_logs (created_at DESC);
CREATE INDEX idx_app_error_logs_company_id ON public.app_error_logs (company_id);
CREATE INDEX idx_app_error_logs_context ON public.app_error_logs (context);

-- Notify postgrest to reload schema
SELECT pg_notify('pgrst', 'reload schema');
