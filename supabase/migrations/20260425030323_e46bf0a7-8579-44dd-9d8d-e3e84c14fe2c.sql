CREATE OR REPLACE VIEW public.public_company AS
 SELECT c.id,
    c.name,
    c.slug,
    c.logo_url,
    c.cover_url,
    c.description,
    c.business_type,
    c.buffer_minutes,
    c.booking_mode,
    c.fixed_slot_interval,
    c.allow_custom_requests,
    c.phone,
    c.address,
    c.address_number,
    c.district,
    c.city,
    c.state,
    c.postal_code,
    c.latitude,
    c.longitude,
    c.website,
    c.facebook,
    c.instagram,
    c.google_maps_url,
    c.google_review_url,
    c.whatsapp,
    COALESCE(r.avg_rating, (0)::numeric) AS average_rating,
    COALESCE(r.review_count, 0) AS review_count
   FROM (companies c
     LEFT JOIN ( SELECT reviews.company_id,
            avg(reviews.rating) AS avg_rating,
            (count(*))::integer AS review_count
           FROM reviews
          WHERE reviews.review_type = 'company'
          GROUP BY reviews.company_id) r ON ((r.company_id = c.id)));
