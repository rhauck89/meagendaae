-- Delete any records that were used for mock testing
DELETE FROM whatsapp_instances WHERE instance_id LIKE 'mock-%' OR instance_name IS NULL;

-- Ensure the table is ready for clean inserts
ALTER TABLE whatsapp_instances ENABLE ROW LEVEL SECURITY;
