-- Set search_path for handle_cashback_transaction_sync
ALTER FUNCTION public.handle_cashback_transaction_sync() SET search_path = public;

-- Set search_path for handle_appointment_cancellation_cashback
ALTER FUNCTION public.handle_appointment_cancellation_cashback() SET search_path = public;
