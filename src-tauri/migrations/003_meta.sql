CREATE TABLE IF NOT EXISTS token_patterns (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token_combination TEXT NOT NULL,
  occurrence_count  INTEGER DEFAULT 1,
  avg_rating        REAL DEFAULT 0.0,
  category          TEXT,
  provider          TEXT,
  last_seen         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_meta (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT OR IGNORE INTO app_meta (key, value) VALUES ('schema_version', '3');
INSERT OR IGNORE INTO app_meta (key, value) VALUES ('created_at', datetime('now'));

INSERT OR IGNORE INTO avoidance_patterns (artifact_type, label, category, description, correction_prompt, severity) VALUES
  ('plastic_skin',       'Plastic Skin',          'texture',     'Unnaturally smooth, waxy skin',              'authentic skin texture, real pore detail, natural skin imperfections, no airbrushing',      'high'),
  ('ai_glow',            'AI Glow',               'lighting',    'Fake uniform luminance',                     'practical lighting, no fill-all glow, real shadow depth, controlled contrast',             'high'),
  ('bad_hands',          'Bad Hands / Fingers',   'anatomy',     'Extra or fused fingers',                     'anatomically correct hands, natural finger joints, realistic hand proportions',            'critical'),
  ('bad_eyes',           'Eye / Pupil Issues',    'anatomy',     'Mismatched catchlights or pupils',           'consistent pupil size, natural iris detail, matching catchlights',                        'high'),
  ('gibberish_text',     'Gibberish Text',        'text',        'Unreadable or fake text',                    'no text in frame, keep text out of composition, avoid sign visibility',                   'medium'),
  ('background_melting', 'Background Melting',    'structure',   'Objects merging incorrectly',                'sharp environmental separation, clear background logic, defined object boundaries',        'high'),
  ('fake_dof',           'Fake Depth of Field',   'optical',     'Unnatural blur falloff',                     'natural lens bokeh, realistic depth falloff, optical aberration',                         'medium'),
  ('waxy_surfaces',      'Waxy Surfaces',         'texture',     'Overpolished materials',                     'real material imperfections, subtle surface variation, natural wear',                     'high'),
  ('perfect_symmetry',   'Perfect Symmetry',      'composition', 'Unnaturally perfect balance',                'natural asymmetry, organic imperfection, real-world alignment',                           'medium'),
  ('floating_objects',   'Floating Objects',      'structure',   'Objects not grounded',                       'proper weight and grounding, realistic shadow casting, physical plausibility',             'medium'),
  ('generic_luxury',     'Generic Luxury Mood',   'style',       'Over-produced lifestyle feel',               'specific visual reference, editorial restraint, brand-specific lighting',                  'low'),
  ('jewelry_mismatch',   'Jewelry Mismatch',      'anatomy',     'Asymmetric or floating accessories',         'physically attached jewelry, symmetric earrings, natural jewelry interaction',             'medium'),
  ('texture_blending',   'Texture Blending',      'texture',     'Materials merging incorrectly',              'clear material separation, defined surface boundaries',                                   'medium'),
  ('unreal_reflections', 'Unreal Reflections',    'optical',     'Physically impossible reflections',          'physically accurate reflections, real specular behavior',                                 'medium'),
  ('fake_cinematic',     'Fake Cinematic Sheen',  'lighting',    'Over-processed cinematic look',              'restrained color grade, real film contrast, practical color balance',                     'medium'),
  ('oversharpened',      'Over-Sharpened Detail', 'texture',     'Hyper-detail that looks digital',            'natural detail resolution, film grain, optical softness',                                 'low');
