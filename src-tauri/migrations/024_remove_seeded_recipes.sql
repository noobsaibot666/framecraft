-- Remove pre-seeded recipe prompts from migrations 005 and 022.
-- Library should start empty; users build their own recipe collection.
DELETE FROM prompts WHERE title IN (
  'Clean Realism — Editorial',
  'Brand Campaign — Consistency Stack',
  'Controlled Exploration',
  'Skin Realism — Minimal Stack',
  'Scenography — Immersive Set',
  'Nano Banana — Skin Texture Macro',
  'Nano Banana — Eye Detail Macro',
  'Nano Banana — Lip Texture Macro',
  'Nano Banana — Tongue Texture Macro'
) AND is_recipe = 1;
