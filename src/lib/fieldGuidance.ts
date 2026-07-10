// Field-aware craft guidance for the Builder-mode fields in Prompt Craft.
// Distinct from recommendations.ts (which answers "what has worked before in
// my library"): this answers "given the field I'm filling in right now, and
// what I've already written elsewhere in this prompt, what dimensions should
// I be thinking about, and what are good example values?" — a director's
// checklist, not a search-your-library feature. Deliberately static/rule-based
// (no AI call, no ML) so it's simple, sequential, and instant while typing.

export type BuilderFieldKey =
  | "subject" | "character" | "environment" | "composition" | "camera"
  | "lighting" | "mood" | "realism" | "product_interaction" | "direction_notes" | "wardrobe_notes";

export type SubjectRegister = "person" | "product" | "creature" | "place" | "abstract";
export type SceneRegister = "photoreal" | "stylized" | "fantastical";
export type CharacterCount = 0 | 1 | "multiple";

export interface FieldContext {
  subjectRegister: SubjectRegister;
  sceneRegister: SceneRegister;
  characterCount: CharacterCount;
  filledFields: Partial<Record<BuilderFieldKey, string>>;
}

export interface Dimension {
  key: string;
  label: string;
  /** Static seed example values — a starting point, not a completeness claim. */
  examples: string[];
  /** Gates whether this dimension applies given the detected context. Omit for always-applicable dimensions. */
  appliesWhen?: (ctx: FieldContext) => boolean;
}

export interface FieldGuide {
  dimensions: Dimension[];
}

// ─── Context detection — same keyword-substring idiom as tokenConsistency.ts / avoidanceEngine.ts ───

const PERSON_KEYWORDS = ["woman", "man", "person", "model", "boy", "girl", "child", "elderly", "portrait", "character", "figure", "people", "couple", "family", "man,", "woman,"];
const PRODUCT_KEYWORDS = ["bottle", "jar", "box", "packaging", "device", "gadget", "product", "logo", "label", "container", "tube", "can,", "pack"];
const CREATURE_KEYWORDS = ["creature", "dragon", "monster", "beast", "animal", "cat", "dog", "bird", "wolf", "alien"];
const PLACE_KEYWORDS = ["landscape", "cityscape", "skyline", "building", "architecture", "interior of", "empty room"];

const FANTASTICAL_KEYWORDS = ["surreal", "fantasy", "mythical", "magical", "otherworldly", "impossible", "dreamlike", "ethereal", "fantastical", "supernatural"];
const PHOTOREAL_KEYWORDS = ["photograph", "photo of", "editorial", "photorealistic", "documentary", "candid", "natural light", "realistic"];

const MULTI_CHARACTER_KEYWORDS = ["couple", "two people", "group", "family", "friends", "team", "crowd", "duo", "pair", "together", "each other", "and her", "and his"];

function includesAny(lower: string, keywords: string[]): boolean {
  return keywords.some((k) => lower.includes(k));
}

function detectSubjectRegister(text: string): SubjectRegister {
  const lower = text.toLowerCase();
  if (includesAny(lower, PRODUCT_KEYWORDS)) return "product";
  if (includesAny(lower, CREATURE_KEYWORDS)) return "creature";
  if (includesAny(lower, PERSON_KEYWORDS)) return "person";
  if (includesAny(lower, PLACE_KEYWORDS)) return "place";
  return "abstract";
}

function detectSceneRegister(text: string): SceneRegister {
  const lower = text.toLowerCase();
  if (includesAny(lower, FANTASTICAL_KEYWORDS)) return "fantastical";
  if (includesAny(lower, PHOTOREAL_KEYWORDS)) return "photoreal";
  return "stylized";
}

function detectCharacterCount(text: string, subjectRegister: SubjectRegister): CharacterCount {
  const lower = text.toLowerCase();
  if (includesAny(lower, MULTI_CHARACTER_KEYWORDS)) return "multiple";
  if (subjectRegister === "person") return 1;
  return 0;
}

/** Builds context from whatever Builder fields are already filled — the "what's already written elsewhere" input. */
export function buildFieldContext(fields: Partial<Record<BuilderFieldKey, string>>): FieldContext {
  const subjectText = [fields.subject, fields.character].filter(Boolean).join(" ");
  const sceneText = [fields.mood, fields.environment, fields.lighting].filter(Boolean).join(" ");
  const subjectRegister = detectSubjectRegister(subjectText);
  return {
    subjectRegister,
    sceneRegister: detectSceneRegister(sceneText || subjectText),
    characterCount: detectCharacterCount(subjectText, subjectRegister),
    filledFields: fields,
  };
}

// ─── Field guides — the director's checklist per field ───

const FIELD_GUIDES: Partial<Record<BuilderFieldKey, FieldGuide>> = {
  subject: {
    dimensions: [
      { key: "type", label: "Type", examples: ["woman", "man", "product", "vehicle", "animal", "architectural structure"] },
      { key: "amount", label: "Amount", examples: ["solo", "pair", "small group", "crowd"] },
      { key: "age_gender", label: "Age / Gender", examples: ["20s", "elderly", "androgynous", "child"], appliesWhen: (ctx) => ctx.subjectRegister === "person" },
      { key: "material_finish", label: "Material / Finish", examples: ["matte", "glossy", "brushed metal", "frosted glass"], appliesWhen: (ctx) => ctx.subjectRegister === "product" },
      { key: "action", label: "Action", examples: ["walking", "reaching for", "mid-gesture", "at rest", "in motion"] },
      { key: "context", label: "Context", examples: ["in a specific place", "at a specific time", "under a condition", "in a mood"] },
    ],
  },
  character: {
    dimensions: [
      { key: "age_build", label: "Age / Build", examples: ["young adult", "weathered", "athletic", "slight frame"] },
      { key: "expression", label: "Facial Expression", examples: ["soft smile", "furrowed brow", "distant gaze", "laughing"] },
      { key: "outfit", label: "Outfit", examples: ["tailored coat", "worn denim", "formal attire", "period costume"] },
      { key: "pose_action", label: "Pose / Action", examples: ["mid-stride", "leaning against", "hands in pockets", "reaching out"] },
      { key: "distinguishing", label: "Distinguishing Features", examples: ["freckles", "scar", "tattoo", "silver-streaked hair"] },
      { key: "relationship", label: "Relationship", examples: ["romantic", "familial", "adversarial", "professional", "strangers"], appliesWhen: (ctx) => ctx.characterCount === "multiple" },
      { key: "interaction", label: "Interaction", examples: ["embracing", "arguing", "collaborating", "passing each other", "shared glance"], appliesWhen: (ctx) => ctx.characterCount === "multiple" },
    ],
  },
  environment: {
    dimensions: [
      { key: "setting", label: "Setting Type", examples: ["forest", "busy city street", "minimal studio", "coastal cliff"] },
      { key: "weather", label: "Weather", examples: ["raining", "overcast", "clear sky", "fog"] },
      { key: "time_of_day", label: "Time of Day", examples: ["golden hour", "blue hour", "midday", "night"] },
      { key: "indoor_outdoor", label: "Indoor / Outdoor", examples: ["indoor", "outdoor", "liminal (doorway, threshold)"] },
      { key: "atmosphere", label: "Atmosphere", examples: ["quiet and still", "chaotic", "intimate", "vast and empty"] },
    ],
  },
  composition: {
    dimensions: [
      { key: "framing", label: "Framing", examples: ["close-up", "wide shot", "medium shot", "extreme close-up"] },
      { key: "angle", label: "Angle", examples: ["eye level", "low angle", "high angle", "dutch tilt"] },
      { key: "balance", label: "Balance", examples: ["rule of thirds", "centered", "asymmetric", "negative space"] },
      { key: "depth", label: "Depth", examples: ["foreground interest", "layered depth", "flat / graphic"] },
    ],
  },
  camera: {
    dimensions: [
      { key: "lens_feel", label: "Lens Feel", examples: ["35mm wide", "85mm portrait compression", "macro", "fisheye"] },
      { key: "movement", label: "Camera Movement", examples: ["static", "slow dolly in", "handheld", "orbit"] },
      { key: "depth_of_field", label: "Depth of Field", examples: ["shallow, subject isolated", "deep focus", "soft background blur"] },
    ],
  },
  lighting: {
    dimensions: [
      { key: "direction", label: "Direction", examples: ["backlit", "side-lit", "front-lit", "top light"] },
      { key: "quality", label: "Quality", examples: ["hard shadows", "soft diffused", "high contrast", "low contrast"] },
      { key: "color_temp", label: "Color Temperature", examples: ["warm tungsten", "cool daylight", "mixed color temps"] },
      { key: "source", label: "Source", examples: ["natural window light", "practical lamp", "studio softbox", "neon glow"], appliesWhen: (ctx) => ctx.sceneRegister !== "fantastical" },
      { key: "otherworldly_source", label: "Light Source", examples: ["bioluminescent glow", "ethereal rim light", "magical inner light"], appliesWhen: (ctx) => ctx.sceneRegister === "fantastical" },
    ],
  },
  mood: {
    dimensions: [
      { key: "emotional_tone", label: "Emotional Tone", examples: ["serene", "tense", "melancholic", "triumphant"] },
      { key: "color_grade", label: "Color Grade", examples: ["desaturated", "teal and orange", "warm and golden", "cool and muted"] },
      { key: "register", label: "Register", examples: ["grounded and real", "heightened / stylized", "dreamlike and fantastical"] },
    ],
  },
  realism: {
    dimensions: [
      { key: "texture", label: "Texture", examples: ["visible pores", "fabric weave", "film grain", "subtle imperfections"] },
      { key: "believability", label: "Believability", examples: ["natural asymmetry", "authentic wear", "avoid airbrushed perfection"] },
    ],
  },
  direction_notes: {
    dimensions: [
      { key: "vision", label: "Directorial Vision", examples: ["restrained and observational", "bold and graphic", "intimate handheld feel"] },
      { key: "contrast", label: "Contrast Relationship", examples: ["subject vs. background separation", "warm subject / cool environment", "light figure / dark ground"] },
      { key: "continuity", label: "Continuity", examples: ["match established lighting", "keep wardrobe consistent", "maintain camera height across shots"], appliesWhen: (ctx) => ctx.characterCount !== 0 },
    ],
  },
  product_interaction: {
    dimensions: [
      { key: "placement", label: "Placement", examples: ["hero centered", "in-hand", "on surface with props", "floating / levitating"] },
      { key: "interaction", label: "Interaction", examples: ["hand reaching for it", "mid-use", "untouched hero shot"] },
      { key: "psychology", label: "Psychology / Semiotics", examples: ["aspirational", "everyday and relatable", "premium and exclusive", "trustworthy"] },
    ],
  },
  wardrobe_notes: {
    dimensions: [
      { key: "style", label: "Style", examples: ["tailored", "streetwear", "period-accurate", "avant-garde"] },
      { key: "fabric", label: "Fabric", examples: ["raw denim", "silk", "worn leather", "technical fabric"] },
      { key: "accessories", label: "Accessories", examples: ["minimal jewelry", "statement piece", "utilitarian props"] },
    ],
  },
};

/** Dimensions worth considering for a field, filtered to what applies given the current context. */
export function getFieldRecommendations(field: BuilderFieldKey, context: FieldContext): Dimension[] {
  const guide = FIELD_GUIDES[field];
  if (!guide) return [];
  return guide.dimensions.filter((d) => !d.appliesWhen || d.appliesWhen(context));
}
