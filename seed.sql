
-- ── Product variants ───────────────────────────────────────────────────────

-- Sizes for the tee
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'size', v.value, 0, v.stock::stock_status, v.ord, v.dflt
from products p,
(values
  ('XS', 'in_stock',     0, false),
  ('S',  'in_stock',     1, false),
  ('M',  'in_stock',     2, true),
  ('L',  'in_stock',     3, false),
  ('XL', 'low_stock',    4, false),
  ('2XL','out_of_stock', 5, false)
) as v(value, stock, ord, dflt)
where p.external_id = 'dhgate-shirt-001'
on conflict (product_id, variant_type, value) do nothing;

-- Colors for the hoodie
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'color', v.value, v.mod, v.stock::stock_status, v.ord, v.dflt
from products p,
(values
  ('Black',     0.00, 'in_stock',  0, true),
  ('Navy',      0.00, 'in_stock',  1, false),
  ('Forest',    0.00, 'in_stock',  2, false),
  ('Burgundy',  0.00, 'low_stock', 3, false),
  ('Rainbow',   2.00, 'in_stock',  4, false)
) as v(value, mod, stock, ord, dflt)
where p.external_id = 'dhgate-hoodie-001'
on conflict (product_id, variant_type, value) do nothing;

-- Pack sizes for the USB-C cable
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'pack_size', v.value, v.mod, 'in_stock'::stock_status, v.ord, v.dflt
from products p,
(values
  ('1-pack',   -9.00, 0, false),
  ('3-pack',    0.00, 1, true),
  ('6-pack',   11.00, 2, false)
) as v(value, mod, ord, dflt)
where p.external_id = 'dhgate-cable-001'
on conflict (product_id, variant_type, value) do nothing;

-- ── Blog posts ────────────────────────────────────────────────────────────

insert into blog_posts (slug, title, excerpt, content, featured_image, seo_title, seo_description, author_name, status, published_at)
values
(
  'pride-season-essentials-2025',
  'Pride Season Essentials 2025',
  'Everything you need to fly your colours this Pride season — from flags and pins to limited-edition apparel.',
  E'## Fly Your Colours This Pride\n\nPride season is here and we''ve done the research so you don''t have to. Below are our top picks across categories, all verified for quality and shipped fast.\n\n### Flags\nA good flag makes a statement. Our [Rainbow Pride Flag](#) is the best value we''ve found: vivid polyester, brass grommets, and enough heft to fly in a breeze without tangling.\n\n### Enamel Pins\nThe [Pride Enamel Pin Set](#) covers the six most common flags in a single order. Hard enamel, crisp detail, clutch backs that actually hold.\n\n### Apparel\nFor everyday wear, the [Classic Fitted Tee](#) is the foundation of any Pride outfit. Stock up — they sell out fast in June.\n\n## FTC Disclosure\nWe earn a commission on qualifying purchases at no extra cost to you.',
  'https://picsum.photos/seed/pride-hero/1200/630',
  'Pride Season Essentials 2025 — yourplug.app',
  'Our curated guide to Pride flags, enamel pins, and apparel for 2025.',
  'yourplug Team',
  'published',
  now() - interval '7 days'
),
(
  'best-gym-gear-dhgate',
  'Best Gym Gear on DHgate (Tested)',
  'We ordered, sweated in, and washed the top-rated activewear on DHgate so you know what''s worth buying.',
  E'## We Went to the Gym So You Don''t Have to (Order Wrong)\n\nDHgate has hundreds of activewear listings. Most are fine; a few are outstanding. Here''s what passed our test.\n\n### Compression Shorts\nThe [Compression Training Shorts](#) held up through six weeks of heavy leg days. The liner stays in place — a common failure point — and the waistband doesn''t roll.\n\n### High-Waist Leggings\nSquat-proof claims are everywhere. The [High-Waist Leggings](#) actually delivers: we did a full squat test under bright lights and got zero sheerness. Size up one from your usual.\n\n## FTC Disclosure\nWe earn a commission on qualifying purchases at no extra cost to you.',
  'https://picsum.photos/seed/gym-hero/1200/630',
  'Best DHgate Gym Gear — Tested by yourplug',
  'Compression shorts, leggings, and activewear from DHgate — tested and reviewed.',
  'yourplug Team',
  'published',
  now() - interval '3 days'
),
(
  'affordable-home-upgrades',
  '10 Affordable Home Upgrades Under $30',
  'Small changes, big difference. The best home and living finds we''ve tested for under thirty dollars.',
  E'## Your Home, Upgraded — Without the Price Tag\n\nYou don''t need to spend a lot to make your space feel better. Here are ten picks that punch above their weight.\n\n1. **[Soy Wax Candle Set](#)** — Three scents, ~40 hours each. The cedar one is genuinely excellent.\n2. **[Ceramic Coffee Mug](#)** — Thick walls keep your drink hot longer. The matte exterior doesn''t show fingerprints.\n\n_More picks coming soon._\n\n## FTC Disclosure\nWe earn a commission on qualifying purchases at no extra cost to you.',
  'https://picsum.photos/seed/home-hero/1200/630',
  '10 Affordable Home Upgrades Under $30 — yourplug.app',
  'The best home and living finds from DHgate, Amazon, and AliExpress under $30.',
  'yourplug Team',
  'draft',
  null
)
on conflict (slug) do nothing;

-- Link blog posts to products and categories
with post_pride as (select id from blog_posts where slug = 'pride-season-essentials-2025'),
     post_gym   as (select id from blog_posts where slug = 'best-gym-gear-dhgate'),
     post_home  as (select id from blog_posts where slug = 'affordable-home-upgrades'),
     pride_flag as (select id from products where external_id = 'dhgate-pride-001'),
     pride_pin  as (select id from products where external_id = 'dhgate-pin-001'),
     pride_tee  as (select id from products where external_id = 'dhgate-shirt-001'),
     gym_short  as (select id from products where external_id = 'dhgate-shorts-001'),
     gym_leg    as (select id from products where external_id = 'aliexpress-leggings-001'),
     home_can   as (select id from products where external_id = 'amazon-candle-001'),
     home_mug   as (select id from products where external_id = 'dhgate-mug-001'),
     cat_pride  as (select id from categories where slug = 'pride-lifestyle'),
     cat_app    as (select id from categories where slug = 'apparel-clothing'),
     cat_gym    as (select id from categories where slug = 'activewear-sports'),
     cat_home   as (select id from categories where slug = 'home-living')
insert into blog_post_products (blog_post_id, product_id, display_order)
select post_pride.id, pride_flag.id, 0 from post_pride, pride_flag
union all
select post_pride.id, pride_pin.id,  1 from post_pride, pride_pin
union all
select post_pride.id, pride_tee.id,  2 from post_pride, pride_tee
union all
select post_gym.id,   gym_short.id,  0 from post_gym,   gym_short
union all
select post_gym.id,   gym_leg.id,    1 from post_gym,   gym_leg
union all
select post_home.id,  home_can.id,   0 from post_home,  home_can
union all
select post_home.id,  home_mug.id,   1 from post_home,  home_mug
on conflict do nothing;

insert into blog_post_categories (blog_post_id, category_id)
select post_pride.id, cat_pride.id from post_pride, cat_pride
union all
select post_pride.id, cat_app.id   from post_pride, cat_app
union all
select post_gym.id,   cat_gym.id   from post_gym,   cat_gym
union all
select post_home.id,  cat_home.id  from post_home,  cat_home
on conflict do nothing;
