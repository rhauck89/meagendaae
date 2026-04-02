DROP VIEW IF EXISTS public.public_company;

CREATE VIEW public.public_company WITH (security_barrier = true) AS
SELECT c.id,
    c.name,
    c.slug,
    c.business_type,
    c.logo_url,
    c.cover_url,
    c.address,
    c.address_number,
    c.district,
    c.city,
    c.state,
    c.postal_code,
    c.phone,
    CASE
        WHEN ((c.whatsapp IS NOT NULL) AND (length(c.whatsapp) > 4)) THEN (left(c.whatsapp, (length(c.whatsapp) - 4)) || '****'::text)
        ELSE c.whatsapp
    END AS whatsapp,
    c.description,
    c.google_maps_url,
    c.google_review_url,
    c.instagram,
    c.facebook,
    c.website,
    c.buffer_minutes,
    c.latitude,
    c.longitude,
    COALESCE(rs.avg_rating, (0)::numeric) AS average_rating,
    COALESCE(rs.review_count, 0) AS review_count
FROM (companies c
    LEFT JOIN ( SELECT reviews.company_id,
            avg(reviews.rating) AS avg_rating,
            (count(*))::integer AS review_count
        FROM reviews
        GROUP BY reviews.company_id) rs ON ((rs.company_id = c.id)));

GRANT SELECT ON public.public_company TO anon, authenticated;