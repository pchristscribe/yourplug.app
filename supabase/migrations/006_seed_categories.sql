-- Migration 004: Seed initial product categories
-- Categories curated for the Swordfighters affiliate platform

insert into categories (name, slug, description) values
  ('Apparel & Clothing',   'apparel-clothing',   'Fashion, streetwear, and everyday clothing'),
  ('Accessories',          'accessories',         'Bags, belts, hats, sunglasses, and jewellery'),
  ('Pride & Lifestyle',    'pride-lifestyle',     'Pride flags, pins, patches, and community gear'),
  ('Activewear & Sports',  'activewear-sports',   'Gym gear, athletic wear, and outdoor equipment'),
  ('Home & Living',        'home-living',         'Decor, kitchenware, and home essentials'),
  ('Tech & Gadgets',       'tech-gadgets',        'Electronics, phone cases, and smart accessories'),
  ('Wellness & Grooming',  'wellness-grooming',   'Skincare, grooming kits, and self-care products'),
  ('Novelty & Gifts',      'novelty-gifts',       'Fun gifts, gag items, and quirky finds')
on conflict (slug) do nothing;
