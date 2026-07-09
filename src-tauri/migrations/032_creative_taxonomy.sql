-- New token categories: Character/Acting, Product Interaction, Direction/Craft,
-- and Storytelling groups, plus more storytelling-oriented Action tokens.
-- token_categories 1-15 were seeded in migration 002; this continues sort_order.

INSERT OR IGNORE INTO token_categories (name, label, sort_order) VALUES
  ('character',             'Character',              16),
  ('acting',                'Acting',                 17),
  ('facial_expressions',    'Facial Expressions',     18),
  ('body_language',         'Body Language',          19),
  ('body_movement',         'Body Movement',          20),
  ('intentions',            'Intentions',             21),
  ('product_placement',     'Product Placement',      22),
  ('product_interaction',   'Product Interaction',    23),
  ('products_in_environment','Products in Environment',24),
  ('product_psychology',    'Product Psychology',     25),
  ('product_semiotics',     'Product Semiotics',      26),
  ('direction',             'Direction',              27),
  ('directors_vision',      'Director''s Vision',     28),
  ('craft',                 'Craft',                  29),
  ('framing_intention',     'Framing Intention',      30),
  ('contrast_relationship', 'Contrast Relationship',  31),
  ('chromatic_contrast',    'Chromatic Contrast',     32),
  ('storytelling',          'Storytelling',           33);

-- ─── CHARACTER ───────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'confident protagonist', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'mysterious stranger', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'weathered veteran', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'effortless icon', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'everyday hero', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'quiet observer', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'commanding presence', id, 1 FROM token_categories WHERE name = 'character';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'vulnerable outsider', id, 1 FROM token_categories WHERE name = 'character';

-- ─── ACTING ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'subtle micro-expression', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'understated performance', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'theatrical intensity', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'naturalistic delivery', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'restrained emotion', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw vulnerability', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'magnetic screen presence', id, 1 FROM token_categories WHERE name = 'acting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'controlled tension', id, 1 FROM token_categories WHERE name = 'acting';

-- ─── FACIAL EXPRESSIONS ──────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'soft genuine smile', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'furrowed brow', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'wide-eyed wonder', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'faint smirk', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'clenched jaw', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'relaxed neutral gaze', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tearful eyes', id, 1 FROM token_categories WHERE name = 'facial_expressions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'confident half-smile', id, 1 FROM token_categories WHERE name = 'facial_expressions';

-- ─── BODY LANGUAGE ───────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'open confident posture', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'guarded crossed arms', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'relaxed shoulders', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'leaning in intently', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'poised upright stance', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'slouched exhaustion', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'grounded stance', id, 1 FROM token_categories WHERE name = 'body_language';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'protective hunch', id, 1 FROM token_categories WHERE name = 'body_language';

-- ─── BODY MOVEMENT ───────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'fluid graceful motion', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sharp deliberate gesture', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sudden burst of movement', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'slow deliberate turn', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'weightless glide', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'powerful stride', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'hesitant step', id, 1 FROM token_categories WHERE name = 'body_movement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'explosive motion', id, 1 FROM token_categories WHERE name = 'body_movement';

-- ─── INTENTIONS ──────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'reaching for connection', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'guarding a secret', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'seeking approval', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'asserting control', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'offering comfort', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'escaping pursuit', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'protecting someone', id, 1 FROM token_categories WHERE name = 'intentions';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'chasing ambition', id, 1 FROM token_categories WHERE name = 'intentions';

-- ─── PRODUCT PLACEMENT ───────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'hero centered placement', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'foreground focal point', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'integrated background presence', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'elevated pedestal display', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'in-hand focal placement', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'negative space isolation', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'environmental integration', id, 1 FROM token_categories WHERE name = 'product_placement';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rule-of-thirds placement', id, 1 FROM token_categories WHERE name = 'product_placement';

-- ─── PRODUCT INTERACTION ─────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'grabbing firmly', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'gently releasing', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tossing playfully', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cradling carefully', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'presenting outward', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'passing between hands', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'unwrapping slowly', id, 1 FROM token_categories WHERE name = 'product_interaction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'lifting toward light', id, 1 FROM token_categories WHERE name = 'product_interaction';

-- ─── PRODUCTS IN ENVIRONMENT ─────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'catching ambient light', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'casting a defined shadow', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'resting on natural surface', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'submerged in liquid', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'surrounded by complementary props', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'floating mid-air', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'nestled in texture', id, 1 FROM token_categories WHERE name = 'products_in_environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'framed by negative space', id, 1 FROM token_categories WHERE name = 'products_in_environment';

-- ─── PRODUCT PSYCHOLOGY ──────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'aspirational desire', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'quiet confidence', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'effortless luxury', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'everyday reliability', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'indulgent reward', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'trustworthy assurance', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'exclusive belonging', id, 1 FROM token_categories WHERE name = 'product_psychology';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'playful discovery', id, 1 FROM token_categories WHERE name = 'product_psychology';

-- ─── PRODUCT SEMIOTICS ───────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'status symbol', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'heritage craftsmanship', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimalist purity', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bold rebellion', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'timeless tradition', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cutting-edge innovation', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'artisanal authenticity', id, 1 FROM token_categories WHERE name = 'product_semiotics';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'understated wealth', id, 1 FROM token_categories WHERE name = 'product_semiotics';

-- ─── DIRECTION ───────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'restrained and deliberate', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bold and unapologetic', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'quiet and observational', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'high-energy and kinetic', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'intimate and close', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'epic and expansive', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimal and precise', id, 1 FROM token_categories WHERE name = 'direction';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw and unpolished', id, 1 FROM token_categories WHERE name = 'direction';

-- ─── DIRECTOR'S VISION ───────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'auteur-driven singular vision', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'uncompromising aesthetic', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'deliberate visual signature', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cohesive world-building', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'intentional imperfection', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'controlled spontaneity', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'signature color language', id, 1 FROM token_categories WHERE name = 'directors_vision';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'consistent tonal identity', id, 1 FROM token_categories WHERE name = 'directors_vision';

-- ─── CRAFT ───────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'meticulous attention to detail', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'masterful technical execution', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'deliberate imperfection', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'precise composition', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'refined finishing', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'controlled grain', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'intentional texture', id, 1 FROM token_categories WHERE name = 'craft';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'disciplined restraint', id, 1 FROM token_categories WHERE name = 'craft';

-- ─── FRAMING INTENTION ───────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'isolating the subject', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'guiding the eye inward', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'creating tension through crop', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'emphasizing scale', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'withholding information', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'revealing context gradually', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'centering power', id, 1 FROM token_categories WHERE name = 'framing_intention';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'offsetting for balance', id, 1 FROM token_categories WHERE name = 'framing_intention';

-- ─── CONTRAST RELATIONSHIP ───────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'light versus shadow', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'soft versus sharp', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'chaos versus order', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'stillness versus motion', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'texture versus smoothness', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'warmth versus cool', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'density versus space', id, 1 FROM token_categories WHERE name = 'contrast_relationship';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'old versus new', id, 1 FROM token_categories WHERE name = 'contrast_relationship';

-- ─── CHROMATIC CONTRAST ──────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'complementary color clash', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'monochromatic restraint', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'warm-cool split', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'saturated against desaturated', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'analogous harmony', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'high-key brightness', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'low-key darkness', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'isolated accent color', id, 1 FROM token_categories WHERE name = 'chromatic_contrast';

-- ─── STORYTELLING ────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'implied backstory', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'decisive moment', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'quiet aftermath', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rising tension', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'unresolved conflict', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'turning point', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'callback detail', id, 1 FROM token_categories WHERE name = 'storytelling';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'open-ended mystery', id, 1 FROM token_categories WHERE name = 'storytelling';

-- ─── ACTION (storytelling-oriented additions) ────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'mid-gesture pause', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'caught in a decisive moment', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'reacting to off-screen event', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'frozen mid-transition', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'anticipating what''s next', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'recovering from impact', id, 1 FROM token_categories WHERE name = 'action';
