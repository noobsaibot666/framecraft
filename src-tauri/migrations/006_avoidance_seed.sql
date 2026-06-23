-- Seed built-in avoidance patterns for the AI-look risk engine
-- Severity scoring: critical=3pts, high=2pts, medium=1pt, low=0.5pts

INSERT INTO avoidance_patterns (artifact_type, label, category, description, correction_prompt, severity, is_builtin) VALUES
  (
    'bad_hands',
    'Bad Hands / Fingers',
    'all',
    'Deformed or extra fingers, fused joints, incorrect hand proportions. Triggered whenever the scene includes human hands.',
    'anatomically correct hands, natural finger joints, realistic hand proportions, five fingers per hand',
    'critical',
    1
  ),
  (
    'plastic_skin',
    'Plastic Skin / Waxy Texture',
    'portrait',
    'Skin that looks synthetic, over-smoothed, or lacks real pore detail. Common in portraits and beauty work.',
    'authentic skin texture, real pore detail, natural skin imperfections, subtle skin variation',
    'high',
    1
  ),
  (
    'gibberish_text',
    'Gibberish Text / Fake Signage',
    'all',
    'AI-generated text that reads as nonsense. Triggered when the prompt includes signage, labels, or visible text.',
    'avoid visible text in frame, keep signage out of shot, no readable labels or logos',
    'high',
    1
  ),
  (
    'eye_inconsistency',
    'Eye / Pupil Inconsistency',
    'portrait',
    'Pupils that are different sizes, off-axis, or reflect impossible environments.',
    'consistent pupil size, natural iris detail, correct eye alignment, realistic corneal reflection',
    'high',
    1
  ),
  (
    'ai_glow',
    'AI Glow / Fake Luminance',
    'all',
    'Uniform, unnatural glow that makes the image look digitally processed. Objects emit light they should not.',
    'no artificial glow, practical light sources only, natural light falloff, no fake luminance halos',
    'medium',
    1
  ),
  (
    'jewelry_mismatch',
    'Jewelry Mismatch / Floating Accessories',
    'portrait',
    'Earrings that are asymmetric, necklaces that float, or accessories not physically attached to the subject.',
    'physically attached jewelry, symmetric earrings, natural accessory interaction, properly fitted accessories',
    'medium',
    1
  ),
  (
    'background_melting',
    'Background Melting / Object Merging',
    'all',
    'Background and foreground elements blending together at edges, losing clear object definition.',
    'clear subject-background separation, distinct object edges, no blending between elements',
    'medium',
    1
  ),
  (
    'floating_objects',
    'Floating Objects / Ungrounded Elements',
    'product',
    'Products or objects that appear to hover without a logical relationship to the surface or environment.',
    'grounded objects, correct shadow casting, natural weight and surface contact',
    'medium',
    1
  ),
  (
    'texture_blending',
    'Texture Blending / Material Merge',
    'all',
    'Two different materials blending into each other — fabric turning into metal, skin into cloth.',
    'distinct material boundaries, clean material separation, accurate surface properties',
    'medium',
    1
  ),
  (
    'impossible_architecture',
    'Impossible Architecture',
    'architecture',
    'Structures that could not physically exist — staircases without supports, walls without logic.',
    'structurally plausible design, load-bearing elements visible, realistic construction materials',
    'medium',
    1
  ),
  (
    'unreal_reflections',
    'Unreal Reflections',
    'all',
    'Reflective surfaces showing impossible environments or content not present in the scene.',
    'accurate surface reflections, consistent reflection environment, physically correct refraction',
    'low',
    1
  ),
  (
    'fake_dof',
    'Fake Depth of Field',
    'all',
    'Bokeh or blur applied inconsistently, unnatural blurring of elements at the same focal distance.',
    'consistent focal plane, natural lens blur falloff, no selective artificial blur',
    'low',
    1
  ),
  (
    'over_sharpened',
    'Over-Sharpened Detail',
    'all',
    'Hyper-detailed textures that exceed photographic realism — every pore, fibre, or grain visible at macro level.',
    'natural sharpness level, realistic detail density, no hyper-rendered micro-texture',
    'low',
    1
  ),
  (
    'perfect_symmetry',
    'Perfect Symmetry (Unnatural)',
    'portrait',
    'Faces or scenes that are mathematically symmetric in a way no photograph or person ever is.',
    'natural asymmetry, slightly off-center composition, authentic facial variation',
    'low',
    1
  ),
  (
    'generic_luxury_mood',
    'Generic Luxury Mood',
    'advertising',
    'Vague cinematic sheen without specific brand meaning — visually expensive but conceptually empty.',
    'specific brand visual language, intentional mood over generic luxury, defined color story',
    'low',
    1
  ),
  (
    'fake_cinematic_sheen',
    'Fake Cinematic Sheen',
    'all',
    'Anamorphic flares, film grain, or color grades applied without a specific cinematographic intent.',
    'motivated camera style, specific film reference, intentional grain structure',
    'low',
    1
  );
