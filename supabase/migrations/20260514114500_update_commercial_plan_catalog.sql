-- Reorganize commercial plans around team size instead of feature gating.
-- Marketplace remains enabled in product logic for all plans; Black only exposes it as a commercial/visual differentiator.

WITH plan_catalog AS (
  SELECT *
  FROM (
    VALUES
      (
        'solo', 'Solo', NULL::text, 49.90::numeric, 499.00::numeric, 16.69::numeric, 1, 1, 1,
        'plan_solo', 'plan_solo_monthly', 'plan_solo_yearly'
      ),
      (
        'studio', 'Studio', 'MAIS VENDIDO'::text, 69.90::numeric, 699.00::numeric, 16.69::numeric, 3, 2, 1,
        'plan_studio', 'plan_studio_monthly', 'plan_studio_yearly'
      ),
      (
        'elite', 'Elite', 'PREMIUM'::text, 89.90::numeric, 899.00::numeric, 16.59::numeric, 0, 3, 1,
        'plan_elite', 'plan_elite_monthly', 'plan_elite_yearly'
      ),
      (
        'black', 'Black', 'MARKETPLACE'::text, 104.90::numeric, 1049.00::numeric, 16.66::numeric, 0, 4, 2,
        'plan_black', 'plan_black_monthly', 'plan_black_yearly'
      )
  ) AS p(
    slug, name, badge, monthly_price, yearly_price, yearly_discount, members_limit, sort_order, marketplace_priority,
    paddle_product_id, paddle_monthly_price_id, paddle_yearly_price_id
  )
)
INSERT INTO public.plans (
  slug, name, badge, monthly_price, yearly_price, yearly_discount, members_limit, sort_order, marketplace_priority,
  paddle_product_id, paddle_monthly_price_id, paddle_yearly_price_id,
  stripe_product_id, stripe_monthly_price_id, stripe_yearly_price_id,
  active,
  automatic_messages, open_scheduling, promotions, discount_coupons, whitelabel,
  feature_requests, feature_financial_level, custom_branding,
  cashback, loyalty, open_agenda, automation, monthly_reports, advanced_reports,
  whatsapp_default, premium_templates, custom_domain, custom_colors, support_priority, multi_location_ready
)
SELECT
  slug, name, badge, monthly_price, yearly_price, yearly_discount, members_limit, sort_order, marketplace_priority,
  paddle_product_id, paddle_monthly_price_id, paddle_yearly_price_id,
  stripe_product_id, stripe_monthly_price_id, stripe_yearly_price_id,
  true,
  true, true, true, true, true,
  true, 'full', true,
  true, true, true, true, true, true,
  true, true, true, true, true, true
FROM (
  SELECT
    pc.*,
    COALESCE(existing.stripe_product_id, pc.paddle_product_id) AS stripe_product_id,
    COALESCE(existing.stripe_monthly_price_id, pc.paddle_monthly_price_id) AS stripe_monthly_price_id,
    COALESCE(existing.stripe_yearly_price_id, pc.paddle_yearly_price_id) AS stripe_yearly_price_id
  FROM plan_catalog pc
  LEFT JOIN public.plans existing ON existing.slug = pc.slug
) seeded
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  monthly_price = EXCLUDED.monthly_price,
  yearly_price = EXCLUDED.yearly_price,
  yearly_discount = EXCLUDED.yearly_discount,
  members_limit = EXCLUDED.members_limit,
  sort_order = EXCLUDED.sort_order,
  marketplace_priority = EXCLUDED.marketplace_priority,
  paddle_product_id = EXCLUDED.paddle_product_id,
  paddle_monthly_price_id = EXCLUDED.paddle_monthly_price_id,
  paddle_yearly_price_id = EXCLUDED.paddle_yearly_price_id,
  stripe_product_id = COALESCE(public.plans.stripe_product_id, EXCLUDED.stripe_product_id),
  stripe_monthly_price_id = COALESCE(public.plans.stripe_monthly_price_id, EXCLUDED.stripe_monthly_price_id),
  stripe_yearly_price_id = COALESCE(public.plans.stripe_yearly_price_id, EXCLUDED.stripe_yearly_price_id),
  active = true,
  automatic_messages = true,
  open_scheduling = true,
  promotions = true,
  discount_coupons = true,
  whitelabel = true,
  feature_requests = true,
  feature_financial_level = 'full',
  custom_branding = true,
  cashback = true,
  loyalty = true,
  open_agenda = true,
  automation = true,
  monthly_reports = true,
  advanced_reports = true,
  whatsapp_default = true,
  premium_templates = true,
  custom_domain = true,
  custom_colors = true,
  support_priority = true,
  multi_location_ready = true,
  updated_at = now();
