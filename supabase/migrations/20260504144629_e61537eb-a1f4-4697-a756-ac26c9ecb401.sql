-- Allow public to see blocked times so availability is accurate
-- (They can already see them via the engine output, this just makes the direct fetch work)
CREATE POLICY "Public can view blocked times" 
ON public.blocked_times 
FOR SELECT 
USING (true);
