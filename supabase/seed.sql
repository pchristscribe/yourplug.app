-- yourplug.app — Development Seed Data
-- Run: supabase db reset  (applies all migrations then this file)
-- or:  supabase db seed

-- ── Products ──────────────────────────────────────────────────────────────

with cats as (
  select id, slug from categories
)
insert into products (external_id, platform, title, description, image_url, price, currency, category_id, status, rating, review_count, tags)
select
  p.external_id, p.platform::platform, p.title, p.description, p.image_url,
  p.price, 'USD', cats.id, 'ACTIVE'::product_status, p.rating, p.review_count, p.tags
from (values
  -- Apparel & Clothing
  ('dhgate-shirt-001', 'DHGATE', 'Classic Fitted Crew-Neck Tee',
   'Soft 100% cotton crew-neck tee with a tailored fit. Available in 8 colours.',
   'https://picsum.photos/seed/shirt001/400/400', 12.99, 'apparel-clothing', 4.2, 138,
   array['t-shirt','cotton','basics']),
  ('dhgate-hoodie-001', 'DHGATE', 'Heavyweight Pullover Hoodie',
   '450gsm fleece hoodie with kangaroo pocket and ribbed cuffs. Unisex sizing.',
   'https://picsum.photos/seed/hoodie001/400/400', 29.99, 'apparel-clothing', 4.5, 94,
   array['hoodie','fleece','streetwear']),
  ('amazon-jeans-001', 'AMAZON', 'Slim-Fit Stretch Jeans',
   'Mid-rise slim jeans with 2% elastane for all-day comfort. 5-pocket styling.',
   'https://picsum.photos/seed/jeans001/400/400', 34.99, 'apparel-clothing', 4.1, 211,
   array['jeans','denim','slim-fit']),

  -- Accessories
  ('dhgate-bag-001', 'DHGATE', 'Canvas Tote Bag',
   'Heavy-duty 12oz canvas tote with reinforced handles. 15L capacity.',
   'https://picsum.photos/seed/tote001/400/400', 9.99, 'accessories', 4.3, 76,
   array['bag','tote','canvas','eco']),
  ('aliexpress-watch-001', 'ALIEXPRESS', 'Minimalist Quartz Watch',
   '36mm brushed stainless case with leather strap. 3ATM water resistance.',
   'https://picsum.photos/seed/watch001/400/400', 24.99, 'accessories', 4.0, 55,
   array['watch','minimalist','quartz']),
  ('dhgate-hat-001', 'DHGATE', '5-Panel Embroidered Cap',
   'Structured 5-panel cap with custom embroidery patch. One-size strap back.',
   'https://picsum.photos/seed/hat001/400/400', 14.99, 'accessories', 4.4, 89,
   array['hat','cap','embroidered']),

  -- Pride & Lifestyle
  ('dhgate-pride-001', 'DHGATE', 'Rainbow Pride Flag (3×5ft)',
   'Vibrant polyester rainbow flag. Grommets on left side for easy hanging.',
   'https://picsum.photos/seed/pride001/400/400', 7.99, 'pride-lifestyle', 4.7, 312,
   array['pride','flag','rainbow','lgbtq']),
  ('dhgate-pin-001', 'DHGATE', 'Pride Enamel Pin Set (6-pack)',
   'Hard enamel pins: rainbow, bisexual, trans, non-binary, pansexual, lesbian flags.',
   'https://picsum.photos/seed/pins001/400/400', 11.99, 'pride-lifestyle', 4.6, 178,
   array['pins','enamel','pride','lgbtq']),
  ('amazon-patch-001', 'AMAZON', 'Embroidered Pride Patch Bundle',
   'Iron-on embroidered patches. Set of 4 includes rainbow heart, equals sign, and more.',
   'https://picsum.photos/seed/patches001/400/400', 8.99, 'pride-lifestyle', 4.3, 67,
   array['patches','embroidered','pride']),

  -- Activewear & Sports
  ('dhgate-shorts-001', 'DHGATE', 'Compression Training Shorts',
   '4-way stretch compression shorts. Built-in liner. Moisture-wicking fabric.',
   'https://picsum.photos/seed/shorts001/400/400', 19.99, 'activewear-sports', 4.2, 103,
   array['shorts','compression','gym','activewear']),
  ('aliexpress-leggings-001', 'ALIEXPRESS', 'High-Waist Squat-Proof Leggings',
   'Squat-tested 80% nylon/20% spandex. 4-way stretch with wide waistband.',
   'https://picsum.photos/seed/leggings001/400/400', 22.99, 'activewear-sports', 4.5, 247,
   array['leggings','gym','activewear','yoga']),

  -- Home & Living
  ('dhgate-mug-001', 'DHGATE', 'Ceramic Coffee Mug 14oz',
   'Heavyweight ceramic mug with glossy glaze inside, matte outside. Dishwasher safe.',
   'https://picsum.photos/seed/mug001/400/400', 8.99, 'home-living', 4.1, 53,
   array['mug','coffee','ceramic','kitchen']),
  ('amazon-candle-001', 'AMAZON', 'Soy Wax Scented Candle Set',
   'Set of 3 hand-poured soy candles: cedar, vanilla, and eucalyptus. ~40hr burn each.',
   'https://picsum.photos/seed/candle001/400/400', 27.99, 'home-living', 4.6, 189,
   array['candle','soy','scented','home-decor']),

  -- Tech & Gadgets
  ('dhgate-cable-001', 'DHGATE', 'Braided USB-C Cable 3-Pack',
   '2m nylon-braided USB-C cables rated 65W / 3A. Compatible with all USB-C devices.',
   'https://picsum.photos/seed/cable001/400/400', 13.99, 'tech-gadgets', 4.3, 421,
   array['usb-c','cable','charging','tech']),
  ('aliexpress-stand-001', 'ALIEXPRESS', 'Adjustable Laptop Stand',
   'Aluminium laptop stand with 6 height settings. Compatible with 10–15.6" laptops.',
   'https://picsum.photos/seed/stand001/400/400', 18.99, 'tech-gadgets', 4.4, 134,
   array['laptop','stand','desk','aluminium']),

  -- Wellness & Grooming
  ('dhgate-razor-001', 'DHGATE', 'Safety Razor with 20 Blades',
   'Butterfly-open double-edge safety razor. Includes 20 stainless steel blades.',
   'https://picsum.photos/seed/razor001/400/400', 16.99, 'wellness-grooming', 4.5, 96,
   array['razor','grooming','shaving','sustainable']),
  ('amazon-skincare-001', 'AMAZON', 'Vitamin C Serum 30ml',
   '15% L-ascorbic acid + hyaluronic acid. Brightening serum for all skin types.',
   'https://picsum.photos/seed/serum001/400/400', 14.99, 'wellness-grooming', 4.2, 308,
   array['skincare','serum','vitamin-c','face']),

  -- Novelty & Gifts
  ('dhgate-card-001', 'DHGATE', 'Funny Card Game (90-card deck)',
   'Party card game for 3–10 players. Adult humour. Ages 17+.',
   'https://picsum.photos/seed/card001/400/400', 11.99, 'novelty-gifts', 4.4, 72,
   array['game','cards','party','funny']),
  ('amazon-socks-001', 'AMAZON', 'Novelty Crew Socks 6-Pack',
   'Combed cotton novelty-print socks. One size fits 7–12. Designs vary per pack.',
   'https://picsum.photos/seed/socks001/400/400', 15.99, 'novelty-gifts', 4.3, 160,
   array['socks','novelty','gift','fun'])
) as p(external_id, platform, title, description, image_url, price, slug, rating, review_count, tags)
join cats on cats.slug = p.slug
on conflict (external_id, platform) do nothing;

-- ── Affiliate links ────────────────────────────────────────────────────────

insert into affiliate_links (product_id, original_url, tracked_url)
select
  p.id,
  case p.platform
    when 'DHGATE'     then 'https://www.dhgate.com/product/' || p.external_id
    when 'ALIEXPRESS' then 'https://www.aliexpress.com/item/' || p.external_id || '.html'
    when 'AMAZON'     then 'https://www.amazon.com/dp/' || p.external_id
    when 'WISH'       then 'https://www.wish.com/product/' || p.external_id
  end,
  'https://yourplug.app/go/' || p.external_id
from products p
where not exists (
  select 1 from affiliate_links al where al.product_id = p.id
);

-- ── Editorial reviews ──────────────────────────────────────────────────────

insert into reviews (product_id, rating, title, content, pros, cons, author_name, is_featured)
select
  p.id, r.rating, r.title, r.content, r.pros, r.cons, 'yourplug Team', r.is_featured
from (values
  ('dhgate-shirt-001', 'DHGATE', 5, 'The go-to basic tee',
   'We ordered 10 colours and every one arrived true-to-colour with consistent sizing. The fabric washes beautifully without shrinking.',
   array['Great value','Consistent sizing','Wide colour range'],
   array['Slightly long torso on shorter folks'],
   true),
  ('dhgate-pride-001', 'DHGATE', 5, 'Perfect for Pride season',
   'Vivid colours, sturdy stitching, and the grommets are solid brass — not the cheap aluminium that tears out after one hang. Highly recommend stocking up.',
   array['Brilliant colours','Solid grommets','Great price'],
   array['Only ships in bulk packs of 10+'],
   true),
  ('aliexpress-leggings-001', 'ALIEXPRESS', 4, 'Actually squat-proof',
   'We put these through their paces at the gym. No sheerness whatsoever, and the wide waistband stays put during workouts. Sizing runs slightly small — go up one.',
   array['Truly opaque','Comfortable waistband','Moisture-wicking'],
   array['Size up recommended','Limited colour options'],
   true),
  ('amazon-candle-001', 'AMAZON', 5, 'Excellent gift option',
   'Clean burn, strong scent throw, and the minimalist packaging makes them perfect to give as-is. The cedar scent in particular is a standout.',
   array['Strong scent throw','Clean soy burn','Gift-ready packaging'],
   array['Cedar sells out fast'],
   false),
  ('dhgate-cable-001', 'DHGATE', 4, 'Solid everyday cables',
   'Three cables for under $14 is hard to beat. All three charge at full 65W and the braiding shows no fraying after two months of daily use.',
   array['Great value per cable','65W charging confirmed','Durable braiding'],
   array['Connectors are a touch loose on some ports'],
   false)
) as r(external_id, platform, rating, title, content, pros, cons, is_featured)
join products p on p.external_id = r.external_id and p.platform = r.platform::platform
on conflict do nothing;

-- ── Product variants ───────────────────────────────────────────────────────

-- Sizes for the tee
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'size'::variant_type, v.value, 0, v.stock::stock_status, v.ord, v.dflt
from products p,
(values ('XS','in_stock',0,false),('S','in_stock',1,false),('M','in_stock',2,true),
        ('L','in_stock',3,false),('XL','low_stock',4,false),('2XL','out_of_stock',5,false)
) as v(value,stock,ord,dflt)
where p.external_id = 'dhgate-shirt-001'
on conflict (product_id, variant_type, value) do nothing;

-- Colors for the hoodie
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'color'::variant_type, v.value, v.mod, v.stock::stock_status, v.ord, v.dflt
from products p,
(values ('Black',0.00,'in_stock',0,true),('Navy',0.00,'in_stock',1,false),
        ('Forest',0.00,'in_stock',2,false),('Burgundy',0.00,'low_stock',3,false),
        ('Rainbow',2.00,'in_stock',4,false)
) as v(value,mod,stock,ord,dflt)
where p.external_id = 'dhgate-hoodie-001'
on conflict (product_id, variant_type, value) do nothing;

-- Pack sizes for the USB-C cable
insert into product_variants (product_id, variant_type, value, price_modifier, stock_status, sort_order, is_default)
select p.id, 'pack_size'::variant_type, v.value, v.mod, 'in_stock'::stock_status, v.ord, v.dflt
from products p,
(values ('1-pack',-9.00,0,false),('3-pack',0.00,1,true),('6-pack',11.00,2,false)
) as v(value,mod,ord,dflt)
where p.external_id = 'dhgate-cable-001'
on conflict (product_id, variant_type, value) do nothing;

-- ── Blog posts ─────────────────────────────────────────────────────────────

insert into blog_posts (slug, title, excerpt, content, featured_image, seo_title, seo_description, author_name, status, published_at)
values
(
  'pride-season-essentials-2025',
  'Pride Season Essentials 2025',
  'Everything you need to fly your colours this Pride season — from flags and pins to limited-edition apparel.',
  E'## Fly Your Colours This Pride\n\nPride season is here and we''ve done the research so you don''t have to.\n\n### Flags\nOur [Rainbow Pride Flag](#) is the best value we''ve found: vivid polyester, brass grommets, and enough heft to fly in a breeze.\n\n### Enamel Pins\nThe [Pride Enamel Pin Set](#) covers six flags in one order. Hard enamel, crisp detail, clutch backs that hold.\n\n### Apparel\nThe [Classic Fitted Tee](#) is the foundation of any Pride outfit. Stock up — they sell out fast in June.\n\n_We earn a commission on qualifying purchases at no extra cost to you._',
  'https://picsum.photos/seed/pride-hero/1200/630',
  'Pride Season Essentials 2025 — yourplug.app',
  'Our curated guide to Pride flags, enamel pins, and apparel for 2025.',
  'yourplug Team', 'published', now() - interval '7 days'
),
(
  'best-gym-gear-dhgate',
  'Best Gym Gear on DHgate (Tested)',
  'We ordered, sweated in, and washed the top-rated activewear on DHgate so you know what''s worth buying.',
  E'## We Went to the Gym So You Don''t Have to (Order Wrong)\n\nDHgate has hundreds of activewear listings. Most are fine; a few are outstanding.\n\n### Compression Shorts\nThe [Compression Training Shorts](#) held up through six weeks of heavy leg days. The liner stays in place and the waistband doesn''t roll.\n\n### High-Waist Leggings\nThe [High-Waist Leggings](#) delivers on the squat-proof claim. Size up one from your usual.\n\n_We earn a commission on qualifying purchases at no extra cost to you._',
  'https://picsum.photos/seed/gym-hero/1200/630',
  'Best DHgate Gym Gear — Tested by yourplug',
  'Compression shorts and leggings from DHgate — tested and reviewed.',
  'yourplug Team', 'published', now() - interval '3 days'
),
(
  'affordable-home-upgrades',
  '10 Affordable Home Upgrades Under $30',
  'Small changes, big difference. The best home and living finds we''ve tested for under thirty dollars.',
  E'## Your Home, Upgraded\n\n1. **[Soy Wax Candle Set](#)** — Three scents, ~40 hours each.\n2. **[Ceramic Coffee Mug](#)** — Thick walls, stays hot longer.\n\n_More picks coming soon._\n\n_We earn a commission on qualifying purchases at no extra cost to you._',
  'https://picsum.photos/seed/home-hero/1200/630',
  '10 Affordable Home Upgrades Under $30 — yourplug.app',
  'The best home finds from DHgate, Amazon, and AliExpress under $30.',
  'yourplug Team', 'draft', null
)
on conflict (slug) do nothing;

-- Link posts → products
with
  pp  as (select id from blog_posts where slug = 'pride-season-essentials-2025'),
  gp  as (select id from blog_posts where slug = 'best-gym-gear-dhgate'),
  hp  as (select id from blog_posts where slug = 'affordable-home-upgrades')
insert into blog_post_products (blog_post_id, product_id, display_order)
select pp.id, p.id, row_number() over (partition by pp.id order by p.external_id) - 1
from pp cross join products p
where p.external_id in ('dhgate-pride-001','dhgate-pin-001','dhgate-shirt-001')
union all
select gp.id, p.id, row_number() over (partition by gp.id order by p.external_id) - 1
from gp cross join products p
where p.external_id in ('dhgate-shorts-001','aliexpress-leggings-001')
union all
select hp.id, p.id, row_number() over (partition by hp.id order by p.external_id) - 1
from hp cross join products p
where p.external_id in ('amazon-candle-001','dhgate-mug-001')
on conflict do nothing;

-- Link posts → categories
with
  pp as (select id from blog_posts where slug = 'pride-season-essentials-2025'),
  gp as (select id from blog_posts where slug = 'best-gym-gear-dhgate'),
  hp as (select id from blog_posts where slug = 'affordable-home-upgrades')
insert into blog_post_categories (blog_post_id, category_id)
select pp.id, c.id from pp cross join categories c where c.slug in ('pride-lifestyle','apparel-clothing')
union all
select gp.id, c.id from gp cross join categories c where c.slug = 'activewear-sports'
union all
select hp.id, c.id from hp cross join categories c where c.slug = 'home-living'
on conflict do nothing;
