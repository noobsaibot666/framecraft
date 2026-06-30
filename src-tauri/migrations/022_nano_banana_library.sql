-- Nano Banana reference prompts — The Realism Formula by timkoda
-- Four macro-realism starting points for Gemini image generation

INSERT OR IGNORE INTO prompts (
  id, title, description, provider, category, use_case,
  prompt_text, camera, lens, lighting,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Nano Banana — Skin Texture Macro',
  'Ultra-detailed skin realism: pores, fine lines, natural surface for cosmetic and editorial use',
  'nano_banana', 'portrait', 'skin texture realism study, editorial macro detail, cosmetic research visuals',
  'Ultra-detailed close-up of human skin with visible pores, fine lines, and natural texture',
  'extreme close-up', 'macro', 'soft, diffused from side and slightly top',
  'Realism Formula by timkoda. Key: diffused side-top lighting, sharp pores/lines with gentle edge falloff. Exclusions: heavy makeup, foundation, skin smoothing, retouching, filters.',
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO prompts (
  id, title, description, provider, category, use_case,
  prompt_text, camera, lens, lighting,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Nano Banana — Eye Detail Macro',
  'Extreme eye close-up: iris texture, eyelashes, natural skin and sclera detail',
  'nano_banana', 'portrait', 'eye macro realism study, iris detail documentation, optometric visuals',
  'Ultra-detailed close-up of a human eye with green-hazel iris, complex radial patterns, dark pupil, visible sclera veins, eye open looking straight toward camera, neutral and calm expression',
  'eye-level extreme close-up', 'macro', 'soft, even from front and slightly top with subtle catchlight reflection in the pupil',
  'Realism Formula by timkoda. Key: iris radial patterns, catchlight in pupil, sclera veins visible. Exclusions: heavy makeup, eyeliner, mascara clumps, retouching.',
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO prompts (
  id, title, description, provider, category, use_case,
  prompt_text, camera, lens, lighting,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Nano Banana — Lip Texture Macro',
  'Intimate macro lip study: fine lines, pores, subtle dryness texture, raw organic feel',
  'nano_banana', 'portrait', 'lip texture macro detail, beauty editorial, skincare documentation',
  'Ultra-macro close-up of slightly parted woman lips with visible fine lines, pores, and subtle dryness texture, lips slightly parted revealing a small portion of teeth, neutral intimate unposed expression',
  'extreme close-up', 'macro', 'soft but directional from side and top, emphasizing texture depth',
  'Realism Formula by timkoda. Mood: intimate, raw, organic. Key: fine lines + pores, slight teeth reveal. Exclusions: eyes, full nose, full face, makeup, lipstick, gloss, filters.',
  datetime('now'), datetime('now')
);

INSERT OR IGNORE INTO prompts (
  id, title, description, provider, category, use_case,
  prompt_text, camera, lens, lighting,
  notes, created_at, updated_at
) VALUES (
  lower(hex(randomblob(16))),
  'Nano Banana — Tongue Texture Macro',
  'Clinical macro tongue study: papillae, taste buds, natural moisture and granular surface',
  'nano_banana', 'portrait', 'tongue texture documentation, medical macro detail, anatomical study',
  'Ultra-macro photorealistic image of a human tongue with pinkish surface, clearly visible taste buds, granular texture, natural moisture, tongue extended forward slightly curved, non-sexualized neutral presentation',
  'extreme close-up', 'macro', 'soft but directional from side and top, highlighting surface texture',
  'Realism Formula by timkoda. Mood: clinical, organic, highly detailed. Key: papillae, natural moisture, granular texture. Exclusions: lips, teeth, full face, makeup, piercings, food.',
  datetime('now'), datetime('now')
);
