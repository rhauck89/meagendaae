CREATE OR REPLACE FUNCTION get_company_dashboard_stats(
    p_company_id UUID,
    p_professional_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_clients BIGINT,
    new_clients_month BIGINT,
    total_appointments BIGINT,
    top_client_name TEXT,
    top_client_count BIGINT
) AS $$
DECLARE
    v_start_month TIMESTAMP WITH TIME ZONE := date_trunc('month', now());
    v_end_month TIMESTAMP WITH TIME ZONE := (date_trunc('month', now()) + interval '1 month');
BEGIN
    RETURN QUERY
    WITH client_pool AS (
        -- Total clients for the company/professional
        SELECT DISTINCT c.id, c.name
        FROM clients c
        LEFT JOIN appointments a ON a.client_id = c.id
        WHERE c.company_id = p_company_id
          AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
          AND (p_professional_id IS NULL OR a.status IN ('completed', 'confirmed', 'pending'))
    ),
    client_first_visits AS (
        -- Absolute first visit to the company for NEW client detection
        SELECT 
            a.client_id,
            MIN(a.start_time) as first_visit
        FROM appointments a
        WHERE a.company_id = p_company_id
          AND a.status IN ('completed', 'confirmed', 'pending')
        GROUP BY a.client_id
    ),
    month_appts AS (
        -- Appointments in the current month for the filter scope
        SELECT 
            a.id,
            a.client_id
        FROM appointments a
        WHERE a.company_id = p_company_id
          AND (p_professional_id IS NULL OR a.professional_id = p_professional_id)
          AND a.status IN ('completed', 'confirmed', 'pending')
          AND a.start_time >= v_start_month 
          AND a.start_time < v_end_month
    ),
    top_client AS (
        SELECT 
            cp.name,
            COUNT(ma.id) as appt_count
        FROM month_appts ma
        JOIN client_pool cp ON cp.id = ma.client_id
        GROUP BY cp.id, cp.name
        ORDER BY appt_count DESC
        LIMIT 1
    )
    SELECT 
        (SELECT COUNT(*) FROM client_pool)::BIGINT as total_clients,
        (SELECT COUNT(DISTINCT cp.id) 
         FROM client_pool cp 
         JOIN client_first_visits cfv ON cfv.client_id = cp.id 
         WHERE cfv.first_visit >= v_start_month)::BIGINT as new_clients_month,
        (SELECT COUNT(*) FROM month_appts)::BIGINT as total_appointments,
        (SELECT name FROM top_client) as top_client_name,
        (SELECT appt_count FROM top_client)::BIGINT as top_client_count;
END;
$$ LANGUAGE plpgsql STABLE;
