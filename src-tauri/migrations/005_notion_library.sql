-- Migration 005: Notion Midjourney library import
-- Source: user's Notion reference page, reviewed and categorized
-- Covers: tokens (cinematic, lighting, skin, scenography, film), sref codes, profiles, preset recipes

-- ─── TOKEN HELPER ────────────────────────────────────────────
-- Only inserts tokens not already present (text + category_id match check)

-- ─── CAMERA — Cinematography angles, framing, movement ───────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('wide establishing shot'),
    ('symmetrical framing'),
    ('asymmetrical framing'),
    ('static locked-off shot'),
    ('slow dolly-in'),
    ('dolly-out reveal'),
    ('lateral tracking shot'),
    ('handheld realism'),
    ('subtle camera drift'),
    ('steadicam movement'),
    ('wide spatial framing'),
    ('static architectural framing'),
    ('observer within the space')
) AS t(text)
WHERE c.name = 'camera'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── LENS — Cinematic optics ─────────────────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('14mm ultra-wide distortion'),
    ('24mm environmental perspective'),
    ('35mm natural cinematic look'),
    ('85mm portrait compression'),
    ('135mm strong background compression'),
    ('natural lens falloff'),
    ('optical vignetting'),
    ('edge softness')
) AS t(text)
WHERE c.name = 'lens'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── COMPOSITION — Cinematic spatial structure ────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('cinematic composition'),
    ('visual storytelling'),
    ('depth-driven framing'),
    ('controlled visual hierarchy'),
    ('foreground set elements'),
    ('layered depth planes'),
    ('midground action zone'),
    ('background architectural volume'),
    ('clear spatial separation')
) AS t(text)
WHERE c.name = 'composition'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── LIGHTING — Direction, sources, mood, spatial ────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('top light'),
    ('side light'),
    ('backlight'),
    ('edge light'),
    ('hard directional light'),
    ('practical light sources'),
    ('spotlight beam'),
    ('overhead stage lighting'),
    ('high contrast lighting'),
    ('soft contrast'),
    ('deep shadows'),
    ('moody chiaroscuro'),
    ('cinematic falloff'),
    ('light defining space'),
    ('directional light volumes'),
    ('shadow as architectural element'),
    ('negative space lighting'),
    ('controlled spill'),
    ('theatrical spotlights'),
    ('overhead grid lighting'),
    ('side wash lighting'),
    ('practical light elements'),
    ('hidden light sources')
) AS t(text)
WHERE c.name = 'lighting'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MOOD — Environment narrative, scenography ───────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('contemplative environment'),
    ('tension-driven space'),
    ('ritualistic atmosphere'),
    ('immersive silence'),
    ('controlled sensory experience'),
    ('designed environment'),
    ('intentional spatial layout'),
    ('constructed scenography'),
    ('set-based composition'),
    ('controlled visual narrative'),
    ('experiential space')
) AS t(text)
WHERE c.name = 'mood'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MATERIAL — Set surfaces and fabric ──────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('raw plywood structures'),
    ('painted MDF panels'),
    ('textured fabric drapes'),
    ('scrim layers'),
    ('matte surfaces'),
    ('non-reflective materials')
) AS t(text)
WHERE c.name = 'material'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── COLOR — Film science and digital cinema look ─────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('Kodak Vision3 250D'),
    ('Kodak Vision3 500T'),
    ('Kodak 2383 print film'),
    ('Kodak Portra tonal response'),
    ('Fujifilm Eterna'),
    ('Fuji Pro 400H look'),
    ('filmic contrast curve'),
    ('subtle grain structure'),
    ('soft highlight roll-off'),
    ('analog color separation'),
    ('ARRI Alexa color science'),
    ('RED cinema contrast'),
    ('cinema-grade dynamic range'),
    ('log-encoded tonal response')
) AS t(text)
WHERE c.name = 'color'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── REALISM — Skin, texture, documentary, scenography ───────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('micro-contrast detail'),
    ('realistic skin texture'),
    ('fabric detail preservation'),
    ('editorial photography'),
    ('press photography'),
    ('archival cinema still'),
    ('uneven skin tone'),
    ('real human skin detail'),
    ('fine lines'),
    ('micro wrinkles'),
    ('slight blemishes'),
    ('subtle skin irregularities'),
    ('natural facial lines'),
    ('crow''s feet'),
    ('under-eye texture'),
    ('expression lines'),
    ('skin specularity variation'),
    ('natural oil sheen'),
    ('matte skin with highlights'),
    ('uneven light absorption'),
    ('light perspiration'),
    ('skin moisture buildup'),
    ('post-performance sweat'),
    ('unretouched skin'),
    ('no beauty retouching'),
    ('installation documentation'),
    ('exhibition photography'),
    ('theatre stage documentation'),
    ('architectural spatial photography'),
    ('high-resolution fabric texture'),
    ('realistic textile stretch'),
    ('sweat absorption'),
    ('sharp motion capture timing'),
    ('grounded jumps'),
    ('realistic gravity'),
    ('slight motion blur on limbs')
) AS t(text)
WHERE c.name = 'realism'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── ENVIRONMENT — Scenography, studio, outdoor ───────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('gallery space'),
    ('brutalist interior'),
    ('modernist interior'),
    ('controlled artificial lighting'),
    ('natural daylight'),
    ('overcast sky diffusion'),
    ('urban exterior'),
    ('minimal environment'),
    ('black box theatre'),
    ('gallery installation space'),
    ('industrial hall interior'),
    ('warehouse-scale environment'),
    ('exhibition scenography'),
    ('open-air installation'),
    ('urban courtyard set'),
    ('architectural facade intervention'),
    ('public space activation')
) AS t(text)
WHERE c.name = 'environment'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── MOTION — Focus, exposure, atmosphere ────────────────────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('motion trails'),
    ('long exposure streaks'),
    ('focus pull'),
    ('rack focus foreground to background'),
    ('intentional focus breathing'),
    ('natural exposure roll-off'),
    ('highlight bloom'),
    ('volumetric haze'),
    ('light diffusion in air'),
    ('subtle smoke layers'),
    ('depth-enhancing atmosphere')
) AS t(text)
WHERE c.name = 'motion'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── AVOIDANCE — Anti-CGI, skin, environment safeguards ──────
INSERT INTO tokens (text, category_id, is_builtin)
SELECT t.text, c.id, 1 FROM token_categories c, (
  VALUES
    ('no cgi'),
    ('no illustration'),
    ('no unreal lighting'),
    ('no smooth skin'),
    ('no airbrushed skin'),
    ('no doll-like face'),
    ('no beauty filter'),
    ('no fantasy environment'),
    ('no sci-fi architecture'),
    ('no surreal floating structures'),
    ('no impossible geometry'),
    ('no decorative overload')
) AS t(text)
WHERE c.name = 'avoidance'
  AND NOT EXISTS (
    SELECT 1 FROM tokens x WHERE x.text = t.text AND x.category_id = c.id
  );

-- ─── PARAMETERS — v7 key flags ───────────────────────────────
INSERT INTO tokens (text, category_id, is_builtin, provider)
SELECT t.text, c.id, 1, 'midjourney' FROM token_categories c, (
  VALUES
    ('--style raw'),
    ('--sv 1'),
    ('--sw 30'),
    ('--sw 40'),
    ('--sw 50'),
    ('--sw 70'),
    ('--exp 10'),
    ('--exp 30'),
    ('--exp 60'),
    ('--zoom 1.5'),
    ('--zoom 2')
) AS t(text)
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

-- ─── PRESET RECIPES ──────────────────────────────────────────
-- Recommended parameter presets from the Notion reference saved as recipes

INSERT INTO prompts (
  id, title, description, provider, category, prompt_text, is_recipe,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Clean Realism — Editorial',
  'v7 preset optimized for photography-grade realism and editorial work',
  'midjourney', 'editorial',
  '[subject] [environment] [camera] [lighting] --v 7 --sv 1 --style raw --ar 16:9 --s 100 --chaos 10 --q 1',
  1,
  'MJ v7 recommended preset. Reduces AI polish via --style raw. Use low --chaos for consistency.',
  datetime('now'), datetime('now')
);

INSERT INTO prompts (
  id, title, description, provider, category, prompt_text, is_recipe,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Brand Campaign — Consistency Stack',
  'v7 preset for repeatable brand imagery across a campaign using sref + seed lock',
  'midjourney', 'advertising',
  '[subject] [environment] [camera] [lighting] --v 7 --sv 1 --style raw --sref [sref_code] --sw 40 --s 100 --seed 123456',
  1,
  'Replace [sref_code] with your chosen style reference. --seed locks randomness for iterative consistency. --sw 40 is moderate style influence.',
  datetime('now'), datetime('now')
);

INSERT INTO prompts (
  id, title, description, provider, category, prompt_text, is_recipe,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Controlled Exploration',
  'v7 preset for exploring unexpected directions while maintaining structural quality',
  'midjourney', 'editorial',
  '[subject] [environment] [mood] --v 7 --style raw --chaos 30 --weird 30',
  1,
  'Higher --chaos + --weird introduces unpredictability. Good for concepting, not final deliverables.',
  datetime('now'), datetime('now')
);

INSERT INTO prompts (
  id, title, description, provider, category, prompt_text, is_recipe,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Skin Realism — Minimal Stack',
  'Minimal token set for authentic skin rendering in v7',
  'midjourney', 'portrait',
  'natural skin texture, visible pores, uneven skin tone, subtle blemishes, skin specularity variation, unretouched skin, documentary realism',
  1,
  'Safe minimal stack. Add post-performance sweat + skin texture under hard light for athletic/fashion contexts.',
  datetime('now'), datetime('now')
);

INSERT INTO prompts (
  id, title, description, provider, category, prompt_text, is_recipe,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Scenography — Immersive Set',
  'Minimal token set for constructed environment and installation photography',
  'midjourney', 'architecture',
  'constructed scenography inside a black box theatre, modular plywood set structures, layered depth planes with fabric scrims, theatrical side lighting defining space, volumetric haze enhancing depth, immersive installation documentation --v 7 --style raw --s 70 --ar 16:9',
  1,
  'Remove adjectives if environment becomes decorative. Increase light logic specificity instead.',
  datetime('now'), datetime('now')
);

-- ─── META ────────────────────────────────────────────────────
UPDATE app_meta SET value = '5', updated_at = datetime('now') WHERE key = 'schema_version';
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('notion_library_imported', '2026-06-23');
