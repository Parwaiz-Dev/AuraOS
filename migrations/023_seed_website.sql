-- 023_seed_website.sql
-- Development seed for the public website. Enriches the existing demo-kitchen
-- restaurant (from 006_seed.sql) with branding, theme, opening hours, gallery
-- and editable page content so every website page renders with real data.
--
-- Idempotent: re-running updates in place. Dev/staging only — production
-- restaurants configure this through the owner dashboard.

-- ── Branding fields on the demo restaurant ─────────────────────────────────────
UPDATE restaurants SET
  tagline        = 'Authentic flavours, made fresh daily',
  description     = 'Demo Kitchen has served the neighbourhood for over a decade, '
                 || 'blending time-honoured recipes with locally sourced ingredients. '
                 || 'Dine in, take away, or order online.',
  logo_url        = 'https://pub-demo.r2.dev/demo-kitchen/logo.png',
  hero_image_url  = 'https://pub-demo.r2.dev/demo-kitchen/hero.jpg',
  address         = '42 MG Road, Koramangala, Bengaluru 560034',
  phone           = '+918041234567',
  whatsapp        = '+918041234567',
  public_email    = 'hello@demo-kitchen.local',
  social_links    = '{"instagram":"https://instagram.com/demokitchen","facebook":"https://facebook.com/demokitchen"}'::jsonb,
  latitude        = 12.9352,
  longitude       = 77.6245,
  website_published = TRUE
WHERE id = '11111111-1111-1111-1111-111111111111'::uuid;

-- ── Theme (1:1) ────────────────────────────────────────────────────────────────
INSERT INTO restaurant_themes (restaurant_id, primary_color, secondary_color, accent_color, background_color, text_color, font_family)
VALUES ('11111111-1111-1111-1111-111111111111'::uuid, '#7c2d12', '#f59e0b', '#16a34a', '#fffdf9', '#1c1917', 'Inter')
ON CONFLICT (restaurant_id) DO UPDATE SET
  primary_color = EXCLUDED.primary_color,
  secondary_color = EXCLUDED.secondary_color,
  accent_color = EXCLUDED.accent_color,
  background_color = EXCLUDED.background_color,
  text_color = EXCLUDED.text_color,
  font_family = EXCLUDED.font_family;

-- ── Opening hours (Mon–Sat open, Sun closed) ───────────────────────────────────
INSERT INTO opening_hours (restaurant_id, day_of_week, open_time, close_time, is_closed) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 0, NULL, NULL, TRUE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 1, '11:00', '23:00', FALSE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 2, '11:00', '23:00', FALSE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 3, '11:00', '23:00', FALSE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 4, '11:00', '23:00', FALSE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 5, '11:00', '23:30', FALSE),
  ('11111111-1111-1111-1111-111111111111'::uuid, 6, '11:00', '23:30', FALSE)
ON CONFLICT (restaurant_id, day_of_week) DO UPDATE SET
  open_time = EXCLUDED.open_time,
  close_time = EXCLUDED.close_time,
  is_closed = EXCLUDED.is_closed;

-- ── Gallery (URLs only — R2/CDN) ───────────────────────────────────────────────
-- Clear prior demo rows so re-runs stay deterministic, then insert.
DELETE FROM gallery_images WHERE restaurant_id = '11111111-1111-1111-1111-111111111111'::uuid;
INSERT INTO gallery_images (restaurant_id, url, caption, category, sort_order) VALUES
  ('11111111-1111-1111-1111-111111111111'::uuid, 'https://pub-demo.r2.dev/demo-kitchen/food-1.jpg', 'Butter Chicken', 'food', 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'https://pub-demo.r2.dev/demo-kitchen/food-2.jpg', 'Paneer Tikka', 'food', 2),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'https://pub-demo.r2.dev/demo-kitchen/interior-1.jpg', 'Main dining hall', 'interior', 1),
  ('11111111-1111-1111-1111-111111111111'::uuid, 'https://pub-demo.r2.dev/demo-kitchen/event-1.jpg', 'Private dining', 'event', 1);

-- ── Home page builder sections ─────────────────────────────────────────────────
INSERT INTO website_pages (restaurant_id, page_key, content, is_published)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid, 'home',
  '{
    "hero_heading": "Welcome to Demo Kitchen",
    "hero_subheading": "Authentic flavours, made fresh daily",
    "cta_label": "Order Now",
    "offers": [
      {"title": "Weekday Lunch Combo", "description": "Main + drink for just ₹199, Mon–Fri 12–3pm"},
      {"title": "Family Feast", "description": "10% off on orders above ₹1500"}
    ],
    "testimonials": [
      {"name": "Aarti S.", "text": "Best butter chicken in Koramangala, hands down."},
      {"name": "Rahul M.", "text": "Fast delivery and always fresh. My go-to."},
      {"name": "Priya K.", "text": "Cosy interior and lovely staff. Highly recommend."}
    ]
  }'::jsonb,
  TRUE
)
ON CONFLICT (restaurant_id, page_key) DO UPDATE SET content = EXCLUDED.content, is_published = TRUE;

-- ── About page content ─────────────────────────────────────────────────────────
INSERT INTO website_pages (restaurant_id, page_key, content, is_published)
VALUES (
  '11111111-1111-1111-1111-111111111111'::uuid, 'about',
  '{
    "story": "Founded in 2012, Demo Kitchen began as a small family stall and grew into a neighbourhood favourite. We still cook every dish to order using recipes passed down three generations.",
    "chef_name": "Chef Imran Qureshi",
    "chef_bio": "With 20 years in North Indian kitchens, Chef Imran leads our team with a passion for slow-cooked gravies and fresh tandoor breads.",
    "facilities": ["Air-conditioned dining", "Family seating", "Takeaway counter", "Online ordering", "Private events"]
  }'::jsonb,
  TRUE
)
ON CONFLICT (restaurant_id, page_key) DO UPDATE SET content = EXCLUDED.content, is_published = TRUE;
