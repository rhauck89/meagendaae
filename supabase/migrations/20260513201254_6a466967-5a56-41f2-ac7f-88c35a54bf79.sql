-- Add all_professionals to subscription_plans
ALTER TABLE public.subscription_plans 
ADD COLUMN IF NOT EXISTS all_professionals BOOLEAN DEFAULT true;

-- Create subscription_plan_professionals table
CREATE TABLE IF NOT EXISTS public.subscription_plan_professionals (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    professional_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(plan_id, professional_id)
);

-- Enable RLS
ALTER TABLE public.subscription_plan_professionals ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Subscription plan professionals are viewable by everyone" 
ON public.subscription_plan_professionals 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage subscription plan professionals" 
ON public.subscription_plan_professionals 
FOR ALL 
USING (is_admin(auth.uid(), company_id));
