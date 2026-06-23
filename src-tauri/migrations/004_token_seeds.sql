-- Seed built-in tokens across all categories.
-- token_categories were seeded in migration 002.

-- Helper: look up category id by name in INSERT statements using subquery.

-- ─── SUBJECT ─────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'woman', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'man', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'couple', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'child', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'person', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'model', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'athlete', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'chef', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'product', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'luxury product', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'perfume bottle', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'skincare product', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'food dish', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'beverage', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cocktail glass', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'car', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'luxury vehicle', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'motorcycle', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'building exterior', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'interior space', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'clothing item', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'accessory', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'jewelry piece', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'watch', id, 1 FROM token_categories WHERE name = 'subject';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'technology device', id, 1 FROM token_categories WHERE name = 'subject';

-- ─── ACTION ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'running', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'walking', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'standing still', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sitting', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'looking at camera', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'looking away', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'floating', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'pouring liquid', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'holding product', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'jumping', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dancing', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'driving', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'reflected in surface', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'submerged in water', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'in motion', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'at rest', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'profile view', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'three quarter view', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'interacting with product', id, 1 FROM token_categories WHERE name = 'action';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'applying product', id, 1 FROM token_categories WHERE name = 'action';

-- ─── ENVIRONMENT ─────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'studio white seamless', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dark studio', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimal studio', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'outdoor natural', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'golden hour field', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'urban street', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'city at night', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rooftop terrace', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'luxury interior', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'marble surface', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'concrete surface', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'forest path', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'beach shore', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'mountain landscape', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'desert terrain', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'industrial space', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'warehouse', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'empty road', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'race track', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'snowy landscape', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rainy street', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'botanical garden', id, 1 FROM token_categories WHERE name = 'environment';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'water surface', id, 1 FROM token_categories WHERE name = 'environment';

-- ─── CAMERA ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'eye-level shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'low angle shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'high angle shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bird''s eye view', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tracking shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dolly shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'drone aerial', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'close-up', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'extreme close-up', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'medium shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'full body shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'environmental portrait', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'macro shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'Dutch angle', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'over-the-shoulder', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'POV shot', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'side profile', id, 1 FROM token_categories WHERE name = 'camera';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'top-down flat lay', id, 1 FROM token_categories WHERE name = 'camera';

-- ─── LENS ────────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '85mm portrait lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '50mm standard lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '35mm wide lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '24mm wide lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '14mm ultra-wide', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '135mm telephoto', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT '200mm telephoto', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'macro lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tilt-shift lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'anamorphic lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'fisheye lens', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'f/1.4 wide aperture', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'f/2.8 aperture', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'f/8 deep focus', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'shallow depth of field', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'deep depth of field', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural bokeh', id, 1 FROM token_categories WHERE name = 'lens';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'anamorphic flare', id, 1 FROM token_categories WHERE name = 'lens';

-- ─── COMPOSITION ─────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rule of thirds', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'centered composition', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'negative space', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'foreground separation', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'leading lines', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'frame within frame', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'layered depth', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'tight crop', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'wide open composition', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'asymmetric balance', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'editorial white space', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'diagonal tension', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'symmetrical layout', id, 1 FROM token_categories WHERE name = 'composition';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'environmental scale', id, 1 FROM token_categories WHERE name = 'composition';

-- ─── LIGHTING ────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural diffused light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'golden hour light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'blue hour light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'overcast diffused', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'practical key light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'single source side light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'Rembrandt lighting', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'split lighting', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'backlit silhouette', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rim light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'high-key lighting', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'low-key lighting', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'neon accent light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'candlelight', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'window light', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'studio softbox', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'beauty dish', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'harsh direct sun', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'dappled light through trees', id, 1 FROM token_categories WHERE name = 'lighting';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'moonlight', id, 1 FROM token_categories WHERE name = 'lighting';

-- ─── MOOD ────────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'editorial cool tone', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'warm intimate', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'industrial neutral', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'premium restrained', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bold editorial', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'human warmth', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cinematic tension', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'documentary realism', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'minimal zen', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'energetic dynamic', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'melancholic quiet', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'optimistic bright', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'mysterious dark', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sophisticated luxury', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw authenticity', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'playful youthful', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'serious professional', id, 1 FROM token_categories WHERE name = 'mood';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'nostalgic analog', id, 1 FROM token_categories WHERE name = 'mood';

-- ─── MATERIAL ────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'matte concrete', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'glossy ceramic', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw linen', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'brushed metal', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'polished marble', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'rough stone', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural wood', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'glass surface', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'frosted glass', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'aged leather', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'silk fabric', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'denim', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'woven textile', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'carbon fiber', id, 1 FROM token_categories WHERE name = 'material';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'gold foil', id, 1 FROM token_categories WHERE name = 'material';

-- ─── COLOR ───────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'restrained neutral palette', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'warm earth tones', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'cool blue tones', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'monochromatic', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'high contrast black and white', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'desaturated muted tones', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'vibrant saturated colors', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'pastel soft palette', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'deep jewel tones', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'forest green accent', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'terracotta accent', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'navy and gold', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'clean white background', id, 1 FROM token_categories WHERE name = 'color';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'deep black background', id, 1 FROM token_categories WHERE name = 'color';

-- ─── REALISM ─────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'authentic skin texture', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'real pore detail', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural skin imperfections', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'real glass refraction', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'physically accurate reflections', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural lens distortion', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'film grain', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'optical softness', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural shadow depth', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'real material imperfections', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'subtle surface variation', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural wear and patina', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'organic asymmetry', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'wind-affected clothing', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'real terrain imperfections', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'sweat and physical effort', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'natural motion blur', id, 1 FROM token_categories WHERE name = 'realism';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'consistent catchlights', id, 1 FROM token_categories WHERE name = 'realism';

-- ─── BRAND TONE ──────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'premium restrained', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'bold editorial restraint', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'human warmth', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'technical precision', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'athletic performance', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'understated luxury', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'democratic accessibility', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'heritage craftsmanship', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'youthful energy', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'calm sustainability', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'clinical authority', id, 1 FROM token_categories WHERE name = 'brand_tone';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'raw streetwear', id, 1 FROM token_categories WHERE name = 'brand_tone';

-- ─── MOTION ──────────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'slow shutter blur', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'freeze frame', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'subtle motion blur', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'panning blur', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'speed lines', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'frozen water splash', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'fabric in motion', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'hair motion', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'liquid pour mid-motion', id, 1 FROM token_categories WHERE name = 'motion';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'smoke drift', id, 1 FROM token_categories WHERE name = 'motion';

-- ─── AVOIDANCE ───────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no plastic skin', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no AI glow', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no bad hands', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no gibberish text', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no floating objects', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no background melting', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no fake depth of field', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no waxy surfaces', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no generic luxury feel', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no over-sharpening', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no perfect symmetry', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no unreal reflections', id, 1 FROM token_categories WHERE name = 'avoidance';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin) SELECT 'no fake cinematic sheen', id, 1 FROM token_categories WHERE name = 'avoidance';

-- ─── PARAMETERS ──────────────────────────────────────────────
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--ar 16:9', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--ar 9:16', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--ar 4:5', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--ar 1:1', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--v 7', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--v 6.1', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--s 400', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--s 750', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--s 100', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--q 1', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--c 10', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--c 25', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';
INSERT OR IGNORE INTO tokens (text, category_id, is_builtin, provider) SELECT '--w 500', id, 1, 'midjourney' FROM token_categories WHERE name = 'parameters';

UPDATE app_meta SET value = '4', updated_at = datetime('now') WHERE key = 'schema_version';
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('token_seeds_version', '1');
