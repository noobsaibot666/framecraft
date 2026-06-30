-- Migration 005: Notion Midjourney library import
-- Source: user's Notion reference page, reviewed and categorized
-- Covers: tokens (cinematic, lighting, skin, scenography, film), sref codes, profiles, preset recipes

-- ─── TOKEN HELPER ────────────────────────────────────────────
-- Only inserts tokens not already present (text + category_id match check)

-- ─── CAMERA — Cinematography angles, framing, movement ───────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'wide establishing shot' AS text UNION ALL
 SELECT 'symmetrical framing' UNION ALL
 SELECT 'asymmetrical framing' UNION ALL
 SELECT 'static locked-off shot' UNION ALL
 SELECT 'slow dolly-in' UNION ALL
 SELECT 'dolly-out reveal' UNION ALL
 SELECT 'lateral tracking shot' UNION ALL
 SELECT 'handheld realism' UNION ALL
 SELECT 'subtle camera drift' UNION ALL
 SELECT 'steadicam movement' UNION ALL
 SELECT 'wide spatial framing' UNION ALL
 SELECT 'static architectural framing' UNION ALL
 SELECT 'observer within the space') AS t
WHERE c.name = 'camera'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── LENS — Cinematic optics ─────────────────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT '14mm ultra-wide distortion' AS text UNION ALL
 SELECT '24mm environmental perspective' UNION ALL
 SELECT '35mm natural cinematic look' UNION ALL
 SELECT '85mm portrait compression' UNION ALL
 SELECT '135mm strong background compression' UNION ALL
 SELECT 'natural lens falloff' UNION ALL
 SELECT 'optical vignetting' UNION ALL
 SELECT 'edge softness') AS t
WHERE c.name = 'lens'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── COMPOSITION — Cinematic spatial structure ────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'cinematic composition' AS text UNION ALL
 SELECT 'visual storytelling' UNION ALL
 SELECT 'depth-driven framing' UNION ALL
 SELECT 'controlled visual hierarchy' UNION ALL
 SELECT 'foreground set elements' UNION ALL
 SELECT 'layered depth planes' UNION ALL
 SELECT 'midground action zone' UNION ALL
 SELECT 'background architectural volume' UNION ALL
 SELECT 'clear spatial separation') AS t
WHERE c.name = 'composition'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── LIGHTING — Direction, sources, mood, spatial ────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'top light' AS text UNION ALL
 SELECT 'side light' UNION ALL
 SELECT 'backlight' UNION ALL
 SELECT 'edge light' UNION ALL
 SELECT 'hard directional light' UNION ALL
 SELECT 'practical light sources' UNION ALL
 SELECT 'spotlight beam' UNION ALL
 SELECT 'overhead stage lighting' UNION ALL
 SELECT 'high contrast lighting' UNION ALL
 SELECT 'soft contrast' UNION ALL
 SELECT 'deep shadows' UNION ALL
 SELECT 'moody chiaroscuro' UNION ALL
 SELECT 'cinematic falloff' UNION ALL
 SELECT 'light defining space' UNION ALL
 SELECT 'directional light volumes' UNION ALL
 SELECT 'shadow as architectural element' UNION ALL
 SELECT 'negative space lighting' UNION ALL
 SELECT 'controlled spill' UNION ALL
 SELECT 'theatrical spotlights' UNION ALL
 SELECT 'overhead grid lighting' UNION ALL
 SELECT 'side wash lighting' UNION ALL
 SELECT 'practical light elements' UNION ALL
 SELECT 'hidden light sources') AS t
WHERE c.name = 'lighting'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MOOD — Environment narrative, scenography ───────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'contemplative environment' AS text UNION ALL
 SELECT 'tension-driven space' UNION ALL
 SELECT 'ritualistic atmosphere' UNION ALL
 SELECT 'immersive silence' UNION ALL
 SELECT 'controlled sensory experience' UNION ALL
 SELECT 'designed environment' UNION ALL
 SELECT 'intentional spatial layout' UNION ALL
 SELECT 'constructed scenography' UNION ALL
 SELECT 'set-based composition' UNION ALL
 SELECT 'controlled visual narrative' UNION ALL
 SELECT 'experiential space') AS t
WHERE c.name = 'mood'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MATERIAL — Set surfaces and fabric ──────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'raw plywood structures' AS text UNION ALL
 SELECT 'painted MDF panels' UNION ALL
 SELECT 'textured fabric drapes' UNION ALL
 SELECT 'scrim layers' UNION ALL
 SELECT 'matte surfaces' UNION ALL
 SELECT 'non-reflective materials') AS t
WHERE c.name = 'material'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── COLOR — Film science and digital cinema look ─────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'Kodak Vision3 250D' AS text UNION ALL
 SELECT 'Kodak Vision3 500T' UNION ALL
 SELECT 'Kodak 2383 print film' UNION ALL
 SELECT 'Kodak Portra tonal response' UNION ALL
 SELECT 'Fujifilm Eterna' UNION ALL
 SELECT 'Fuji Pro 400H look' UNION ALL
 SELECT 'filmic contrast curve' UNION ALL
 SELECT 'subtle grain structure' UNION ALL
 SELECT 'soft highlight roll-off' UNION ALL
 SELECT 'analog color separation' UNION ALL
 SELECT 'ARRI Alexa color science' UNION ALL
 SELECT 'RED cinema contrast' UNION ALL
 SELECT 'cinema-grade dynamic range' UNION ALL
 SELECT 'log-encoded tonal response') AS t
WHERE c.name = 'color'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── REALISM — Skin, texture, documentary, scenography ───────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'micro-contrast detail' AS text UNION ALL
 SELECT 'realistic skin texture' UNION ALL
 SELECT 'fabric detail preservation' UNION ALL
 SELECT 'editorial photography' UNION ALL
 SELECT 'press photography' UNION ALL
 SELECT 'archival cinema still' UNION ALL
 SELECT 'uneven skin tone' UNION ALL
 SELECT 'real human skin detail' UNION ALL
 SELECT 'fine lines' UNION ALL
 SELECT 'micro wrinkles' UNION ALL
 SELECT 'slight blemishes' UNION ALL
 SELECT 'subtle skin irregularities' UNION ALL
 SELECT 'natural facial lines' UNION ALL
 SELECT 'crow''s feet' UNION ALL
 SELECT 'under-eye texture' UNION ALL
 SELECT 'expression lines' UNION ALL
 SELECT 'skin specularity variation' UNION ALL
 SELECT 'natural oil sheen' UNION ALL
 SELECT 'matte skin with highlights' UNION ALL
 SELECT 'uneven light absorption' UNION ALL
 SELECT 'light perspiration' UNION ALL
 SELECT 'skin moisture buildup' UNION ALL
 SELECT 'post-performance sweat' UNION ALL
 SELECT 'unretouched skin' UNION ALL
 SELECT 'no beauty retouching' UNION ALL
 SELECT 'installation documentation' UNION ALL
 SELECT 'exhibition photography' UNION ALL
 SELECT 'theatre stage documentation' UNION ALL
 SELECT 'architectural spatial photography' UNION ALL
 SELECT 'high-resolution fabric texture' UNION ALL
 SELECT 'realistic textile stretch' UNION ALL
 SELECT 'sweat absorption' UNION ALL
 SELECT 'sharp motion capture timing' UNION ALL
 SELECT 'grounded jumps' UNION ALL
 SELECT 'realistic gravity' UNION ALL
 SELECT 'slight motion blur on limbs') AS t
WHERE c.name = 'realism'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── ENVIRONMENT — Scenography, studio, outdoor ───────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'gallery space' AS text UNION ALL
 SELECT 'brutalist interior' UNION ALL
 SELECT 'modernist interior' UNION ALL
 SELECT 'controlled artificial lighting' UNION ALL
 SELECT 'natural daylight' UNION ALL
 SELECT 'overcast sky diffusion' UNION ALL
 SELECT 'urban exterior' UNION ALL
 SELECT 'minimal environment' UNION ALL
 SELECT 'black box theatre' UNION ALL
 SELECT 'gallery installation space' UNION ALL
 SELECT 'industrial hall interior' UNION ALL
 SELECT 'warehouse-scale environment' UNION ALL
 SELECT 'exhibition scenography' UNION ALL
 SELECT 'open-air installation' UNION ALL
 SELECT 'urban courtyard set' UNION ALL
 SELECT 'architectural facade intervention' UNION ALL
 SELECT 'public space activation') AS t
WHERE c.name = 'environment'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MOTION — Focus, exposure, atmosphere ────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'motion trails' AS text UNION ALL
 SELECT 'long exposure streaks' UNION ALL
 SELECT 'focus pull' UNION ALL
 SELECT 'rack focus foreground to background' UNION ALL
 SELECT 'intentional focus breathing' UNION ALL
 SELECT 'natural exposure roll-off' UNION ALL
 SELECT 'highlight bloom' UNION ALL
 SELECT 'volumetric haze' UNION ALL
 SELECT 'light diffusion in air' UNION ALL
 SELECT 'subtle smoke layers' UNION ALL
 SELECT 'depth-enhancing atmosphere') AS t
WHERE c.name = 'motion'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── AVOIDANCE — Anti-CGI, skin, environment safeguards ──────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c,
(SELECT 'no cgi' AS text UNION ALL
 SELECT 'no illustration' UNION ALL
 SELECT 'no unreal lighting' UNION ALL
 SELECT 'no smooth skin' UNION ALL
 SELECT 'no airbrushed skin' UNION ALL
 SELECT 'no doll-like face' UNION ALL
 SELECT 'no beauty filter' UNION ALL
 SELECT 'no fantasy environment' UNION ALL
 SELECT 'no sci-fi architecture' UNION ALL
 SELECT 'no surreal floating structures' UNION ALL
 SELECT 'no impossible geometry' UNION ALL
 SELECT 'no decorative overload') AS t
WHERE c.name = 'avoidance'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── PARAMETERS — v7 key flags ───────────────────────────────
INSERT INTO tokens (text, category_id, is_builtin, provider)
SELECT t.text, c.id, 1, 'midjourney' FROM token_categories c,
(SELECT '--style raw' AS text UNION ALL
 SELECT '--sv 1' UNION ALL
 SELECT '--sw 30' UNION ALL
 SELECT '--sw 40' UNION ALL
 SELECT '--sw 50' UNION ALL
 SELECT '--sw 70' UNION ALL
 SELECT '--exp 10' UNION ALL
 SELECT '--exp 30' UNION ALL
 SELECT '--exp 60' UNION ALL
 SELECT '--zoom 1.5' UNION ALL
 SELECT '--zoom 2') AS t
WHERE c.name = 'parameters'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── SREFS ───────────────────────────────────────────────────
-- Individual codes from the reference page.
-- Group A — general library
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1752440308', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('437192403',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3213854184', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3827426689', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('364269681',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2533988981', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('627825589',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1001260060', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3552910216', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('174814473',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1940968638', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('4173633986', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1374709361', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2537726996', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('909896426',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3815336367', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1412977448', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2060251142', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3648658859', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('4179632712', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2822390401', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('747537547',  'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2567556963', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3493489734', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3689676847', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1213814505', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2881425763', 'midjourney', 0, 'general library');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3979054814', 'midjourney', 0, 'general library');
-- Group B
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2207611679', 'midjourney', 0, NULL);
INSERT INTO srefs (code, provider, rating, notes) VALUES ('4135125841', 'midjourney', 0, NULL);
-- Group C — with style weights
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2963506762', 'midjourney', 0, NULL);
INSERT INTO srefs (code, provider, rating, notes) VALUES ('4100289737', 'midjourney', 0, 'best at ::3 weight');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2095998657', 'midjourney', 0, NULL);
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1432138761', 'midjourney', 0, 'best at ::2 weight');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('26398924',   'midjourney', 0, NULL);
-- Group D — favorites
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1302065766', 'midjourney', 5, 'top pick');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('1529672586', 'midjourney', 5, 'top pick');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3881464256', 'midjourney', 5, 'top pick — best at ::3 weight');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('3184442238', 'midjourney', 5, 'top pick');
-- Group E — favorites with profile combo
INSERT INTO srefs (code, provider, rating, notes) VALUES ('872275923',  'midjourney', 5, 'top pick — combine with --p');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2549935434', 'midjourney', 5, 'top pick — best at ::3 weight, combine with --p');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('889673409',  'midjourney', 5, 'top pick — best at ::2 weight, combine with --p');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2527129708', 'midjourney', 5, 'top pick — combine with --p');
INSERT INTO srefs (code, provider, rating, notes) VALUES ('2556966953', 'midjourney', 5, 'top pick — combine with --p');

-- ─── PROFILES ────────────────────────────────────────────────
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('letkx5u', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('9kfodp8', 'midjourney', 'fashion', 'fashion — combine with m9jp5y4 fy8rnyh');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('m9jp5y4', 'midjourney', 'fashion', 'fashion — combine with 9kfodp8 fy8rnyh');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('fy8rnyh', 'midjourney', 'fashion', 'fashion — combine with 9kfodp8 m9jp5y4');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('2fsaith', 'midjourney', NULL, 'combine with 4wklqm1');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('4wklqm1', 'midjourney', NULL, 'combine with 2fsaith');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('d3ytkj2', 'midjourney', 'photography', 'photography — try --stylize 200');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('m8cjh6h', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('syumkio', 'midjourney', NULL, 'combine with latb1cc');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('latb1cc', 'midjourney', NULL, 'combine with syumkio');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('uqwkyub', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('8pq6kxn', 'midjourney', NULL, 'best with --stylize 75');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('h3izih4', 'midjourney', NULL, 'best with --stylize 325');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('gtbhewc', 'midjourney', NULL, 'combine with avw472p gj5325t gy97k8r');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('avw472p', 'midjourney', NULL, 'combine with gtbhewc gj5325t gy97k8r');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('gj5325t', 'midjourney', NULL, 'combine with gtbhewc avw472p gy97k8r');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('gy97k8r', 'midjourney', NULL, 'combine with gtbhewc avw472p gj5325t');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('njoijyy', 'midjourney', NULL, 'best with --stylize 500');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('rhwyqeu', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('xqdwnuo', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('ou1vizd', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('9qj77fq', 'midjourney', NULL, 'best with --stylize 250');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('b4iwxew', 'midjourney', NULL, 'best with --stylize 35');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('2ll7143', 'midjourney', NULL, 'best with --stylize 150');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('am3sk3z', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('rhuorij', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('kn7bbid', 'midjourney', NULL, NULL);
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('vkn6wee', 'midjourney', NULL, 'best with --stylize 1000');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('isoxsyg', 'midjourney', NULL, 'best with --stylize 500');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('waefcgm', 'midjourney', NULL, 'combine with x9scs97');
INSERT INTO profiles (code, provider, best_use, notes) VALUES ('x9scs97', 'midjourney', NULL, 'combine with waefcgm');

-- ─── META ────────────────────────────────────────────────────
UPDATE app_meta SET value = '5', updated_at = datetime('now') WHERE key = 'schema_version';
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('notion_library_imported', '2026-06-23');
