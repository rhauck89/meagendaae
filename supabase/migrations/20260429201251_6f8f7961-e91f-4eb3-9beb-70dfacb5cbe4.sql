-- Create a unique index to prevent duplicate successful automation messages
-- Based on company, appointment and the specific trigger source
CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_logs_unique_sent 
ON public.whatsapp_logs (company_id, appointment_id, source) 
WHERE (status = 'sent');
