-- Casting/wardrobe/styling taxonomy: Casting Style, Wardrobe, Designer
-- Influence, Accessories, Weather, Time of Day — plus enrichments to
-- subject (missing people-groupings), environment (named locations),
-- material (product textures), and realism (skin detail).
-- token_categories 1-33 seeded in migrations 002 and 032.

INSERT OR IGNORE INTO token_categories (name, label, sort_order) VALUES
  ('casting_style',      'Casting Style',      34),
  ('wardrobe',           'Wardrobe',           35),
  ('designer_influence', 'Designer Influence', 36),
  ('accessories',        'Accessories',        37),
  ('weather',            'Weather',            38),
  ('time_of_day',        'Time of Day',        39);

-- ─── CASTING STYLE ───────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'diverse ensemble cast', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'single hero talent', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'real-people documentary cast', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'professional model cast', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'unconventional beauty casting', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'age-diverse casting', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'authentic non-model casting', id, 1 FROM token_categories WHERE name = 'casting_style';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'multigenerational cast', id, 1 FROM token_categories WHERE name = 'casting_style';

-- ─── WARDROBE ────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tailored suit', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'flowing evening gown', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'streetwear ensemble', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'vintage-inspired outfit', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimalist monochrome outfit', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'athletic performance wear', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bohemian layered look', id, 1 FROM token_categories WHERE name = 'wardrobe';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'structured blazer', id, 1 FROM token_categories WHERE name = 'wardrobe';

-- ─── DESIGNER INFLUENCE ──────────────────────────────────────
-- Descriptive style/craft references only — no real brand or designer
-- names, to avoid trademark issues while still giving a design-house feel.
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'haute couture atelier', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'avant-garde fashion house', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'heritage boutique tailoring', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimalist Scandinavian design house', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'streetwear label collab', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'artisanal bespoke boutique', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'runway-editorial styling', id, 1 FROM token_categories WHERE name = 'designer_influence';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'old-money quiet luxury', id, 1 FROM token_categories WHERE name = 'designer_influence';

-- ─── ACCESSORIES ─────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'statement jewelry', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'delicate gold chain', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'structured handbag', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'oversized sunglasses', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'leather belt', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'silk scarf', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'wide-brim hat', id, 1 FROM token_categories WHERE name = 'accessories';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'layered rings', id, 1 FROM token_categories WHERE name = 'accessories';

-- ─── WEATHER ─────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'clear blue sky', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'overcast diffused light', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'light rain', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'heavy storm clouds', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'misty fog', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'fresh snowfall', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'golden dust haze', id, 1 FROM token_categories WHERE name = 'weather';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'wind-swept', id, 1 FROM token_categories WHERE name = 'weather';

-- ─── TIME OF DAY ─────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'pre-dawn darkness', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dawn', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'early morning', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'midday', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'late afternoon', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dusk', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'blue hour', id, 1 FROM token_categories WHERE name = 'time_of_day';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'night', id, 1 FROM token_categories WHERE name = 'time_of_day';

-- ─── SUBJECT (missing people-groupings) ─────────────────────
-- 'couple' already exists (seeded in migration 004) — not re-added here,
-- since tokens.text has no unique constraint and INSERT OR IGNORE would
-- silently create a duplicate row rather than a no-op.
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'group of people', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'kids', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'a man and a woman', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'a crowd of people', id, 1 FROM token_categories WHERE name = 'subject';

-- ─── ENVIRONMENT (named locations) ───────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rooftop bar', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'art gallery', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'grand hotel lobby', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'vintage diner', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'subway platform', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'artist''s loft', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'greenhouse conservatory', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'farmers market', id, 1 FROM token_categories WHERE name = 'environment';

-- ─── MATERIAL (product textures — metal, glass, leather variants) ───
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'polished chrome', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw ceramic', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'matte finish', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'glossy lacquer', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'woven leather', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tempered glass', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'anodized aluminum', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'patinated bronze', id, 1 FROM token_categories WHERE name = 'material';

-- ─── REALISM (skin imperfections / blemishes) ────────────────
-- 'uneven skin tone' already exists (seeded in migration 005) — 'beauty
-- mark' added instead so this doesn't create a duplicate row.
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'faint freckles', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'subtle blemish', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'fine expression lines', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'beauty mark', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'soft under-eye shadow', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sun-kissed complexion', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'visible scar', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural flush', id, 1 FROM token_categories WHERE name = 'realism';
