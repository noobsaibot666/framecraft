export interface ImportLearningSignal {
  tags: string[];
  avoidanceText?: string;
  reusableTokens: string[];
  parameterLabels: string[];
}

const TAG_KEYWORD_MAP: Record<string, string[]> = {
  portrait: ["portrait", "person", "face", "model", "skin", "eyes"],
  product: ["product", "packshot", "still life", "bottle", "cosmetics", "object", "perfume"],
  fashion: ["fashion", "clothing", "outfit", "garment", "luxury wear"],
  advertising: ["ad", "campaign", "brand", "commercial", "hero"],
  automotive: ["car", "vehicle", "automobile", "road", "driving"],
  architecture: ["building", "interior", "architecture", "facade", "room"],
  editorial: ["editorial", "magazine", "lifestyle", "story"],
  cinematic: ["cinematic", "film", "dramatic", "rim light", "scene"],
};

// Broader creative vocabulary used only for the live tag-suggestion strip next
// to the Tags field (suggestPromptTags) — kept separate from TAG_KEYWORD_MAP
// so analyzeImportedPromptLearning's pinned "Learned tags" output never
// changes. Covers the descriptive language that actually shows up in prompts
// but isn't a project Category: lighting, mood/color, composition, style/era,
// environment, material/texture.
const DESCRIPTIVE_KEYWORD_MAP: Record<string, string[]> = {
  "golden hour": ["golden hour"],
  "neon": ["neon"],
  "backlit": ["backlit", "backlighting"],
  "moody": ["moody"],
  "high-key": ["high-key", "high key"],
  "low-key": ["low-key", "low key"],
  "chiaroscuro": ["chiaroscuro"],
  "natural light": ["natural light", "window light"],
  "studio light": ["studio light", "softbox"],
  "silhouette": ["silhouette"],
  "close-up": ["close-up", "close up", "macro"],
  "wide shot": ["wide shot", "wide-angle", "establishing shot"],
  "aerial": ["aerial", "drone", "overhead"],
  "symmetry": ["symmetry", "symmetrical"],
  "minimalist": ["minimalist", "minimal"],
  "surreal": ["surreal", "surrealist"],
  "vintage": ["vintage", "retro"],
  "futuristic": ["futuristic", "sci-fi", "cyberpunk"],
  "hyperrealistic": ["hyperrealistic", "photorealistic"],
  "painterly": ["painterly", "brushstroke"],
  "monochrome": ["monochrome", "black and white"],
  "vibrant": ["vibrant", "saturated"],
  "pastel": ["pastel"],
  "muted tones": ["muted", "desaturated"],
  "high contrast": ["high contrast", "high-contrast"],
  "urban": ["urban", "cityscape", "street"],
  "nature": ["forest", "mountain", "ocean", "wilderness"],
  "studio": ["studio background", "seamless backdrop"],
  "underwater": ["underwater"],
  "metallic": ["metallic", "chrome"],
  "glossy": ["glossy", "glazed"],
  "matte": ["matte"],
  "textured": ["textured", "texture"],
};

const PARAM_PATTERNS: Array<[RegExp, string]> = [
  [/--ar\s+([\d:]+)/, "--ar"],
  [/--v(?:ersion)?\s+(\S+)/, "--v"],
  [/--s(?:tylize)?\s+(\d+)/, "--s"],
  [/--c(?:haos)?\s+(\d+)/, "--c"],
  [/--w(?:eird)?\s+(\d+)/, "--w"],
  [/--q(?:uality)?\s+(\S+)/, "--q"],
  [/--style\s+(\S+)/, "--style"],
  [/--seed\s+(\d+)/, "--seed"],
  [/--sref(?:\s+([^\s-]\S*))?/, "--sref"],
  // --profile codes can be multiple space-separated tokens — capture everything
  // until the next --param or end of string, same treatment as --no below.
  [/(?:--profile|--p)\s+(.+?)(?=\s--[a-zA-Z]|$)/s, "--profile"],
];

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function stripPromptParams(text: string): string {
  return text
    .replace(/--no\s+.*?(?=\s--[a-zA-Z]|$)/gs, "")
    // --profile codes can be multiple space-separated tokens — strip through to
    // the next --param or end of string, same as --no above, before the generic
    // single-token catch-all below runs (which would otherwise leave the extra
    // tokens dangling as garbage in the stripped text).
    .replace(/(?:--profile|--p)\s+.*?(?=\s--[a-zA-Z]|$)/gs, "")
    .replace(/--[a-zA-Z]+(?:\s+\S+)?/g, "")
    .replace(/-{1,2}exp(?!\w)/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractReusableTokens(text: string): string[] {
  return unique(
    stripPromptParams(text)
      .split(/[,;\n]+/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8 && part.split(/\s+/).length >= 2)
      .slice(0, 8)
  );
}

function extractParameterLabels(text: string): string[] {
  const labels: string[] = [];
  for (const [pattern, flag] of PARAM_PATTERNS) {
    const match = text.match(pattern);
    const value = match?.[1] ?? match?.[2];
    if (match) labels.push(value ? `${flag} ${value}` : flag);
  }

  const no = text.match(/--no\s+(.*?)(?=\s--[a-zA-Z]|$)/s);
  if (no?.[1]?.trim()) labels.push(`--no ${no[1].trim()}`);
  return unique(labels);
}

export function analyzeImportedPromptLearning(text: string): ImportLearningSignal {
  const lower = stripPromptParams(text).toLowerCase();
  const tags = Object.entries(TAG_KEYWORD_MAP)
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([tag]) => tag);
  const no = text.match(/--no\s+(.*?)(?=\s--[a-zA-Z]|$)/s);
  const avoidanceText = no?.[1]?.trim() || undefined;

  return {
    tags: unique(tags),
    avoidanceText,
    reusableTokens: extractReusableTokens(text),
    parameterLabels: extractParameterLabels(text),
  };
}

// Words that shouldn't stand alone as a suggested tag even when they land in
// their own comma-separated clause (rare, but cheap to guard against).
const STOPWORD_PHRASES = new Set([
  "a", "an", "the", "and", "or", "with", "of", "in", "on", "at", "by", "for", "to", "from",
  "no", "not", "very", "extremely", "highly", "super", "ultra",
]);

function extractPhraseCandidates(text: string): string[] {
  return stripPromptParams(text)
    .split(/[,;\n.]+/)
    .map((part) => part.trim().toLowerCase().replace(/^[-–—•]+\s*/, ""))
    .filter((part) => {
      if (!part || STOPWORD_PHRASES.has(part)) return false;
      if (/^\d+(\.\d+)?$/.test(part)) return false;
      const words = part.split(/\s+/).filter(Boolean);
      return words.length > 0 && words.length <= 4 && part.length <= 28;
    });
}

/**
 * Suggests tags for the live "add tags" UI — combines the existing category
 * dictionary, a broader descriptive-vocabulary dictionary (lighting, mood,
 * style, composition, texture), and short phrases pulled directly from the
 * prompt's own comma/period-separated clauses, so suggestions are grounded in
 * the exact words the user wrote rather than a fixed category list. Always
 * excludes tags already added.
 */
export function suggestPromptTags(text: string, existingTags: string[] = [], limit = 12): string[] {
  if (!text.trim()) return [];
  const existing = new Set(existingTags.map((tag) => tag.trim().toLowerCase()));
  const lower = stripPromptParams(text).toLowerCase();

  const dictionaryTags = [
    ...Object.entries(TAG_KEYWORD_MAP),
    ...Object.entries(DESCRIPTIVE_KEYWORD_MAP),
  ]
    .filter(([, keywords]) => keywords.some((keyword) => lower.includes(keyword)))
    .map(([tag]) => tag);

  const phraseTags = extractPhraseCandidates(text);

  return unique([...dictionaryTags, ...phraseTags])
    .filter((tag) => !existing.has(tag))
    .slice(0, limit);
}

const MAX_SUGGESTED_TITLE_LENGTH = 48;

function titleCaseWord(word: string): string {
  if (!word) return word;
  // Leave acronyms/codes as-is ("AI", "3D", "8K") instead of forcing Title-case.
  if (word === word.toUpperCase() && /[A-Z]/.test(word)) return word;
  return word[0].toUpperCase() + word.slice(1);
}

function truncateAtWordBoundary(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 12 ? cut.slice(0, lastSpace) : cut).trim();
}

/**
 * Derives a short, human-scannable title from raw pasted prompt text, so the
 * required Title field can be pre-filled on import instead of forcing the user
 * to hand-type one for every paste. Takes the prompt's leading clause (pulling
 * in a second short clause when the first is too terse to be descriptive on
 * its own), title-cases it, and truncates to a card-friendly length.
 */
export function suggestPromptTitle(text: string): string {
  const stripped = stripPromptParams(text).trim();
  if (!stripped) return "";

  const clauses = stripped
    .split(/[,;\n]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  let lead = clauses[0] ?? "";
  if (lead.length < 12 && clauses[1]) lead = `${lead} ${clauses[1]}`;

  const words = lead.split(/\s+/).filter(Boolean).slice(0, 8).map(titleCaseWord);
  const title = truncateAtWordBoundary(words.join(" "), MAX_SUGGESTED_TITLE_LENGTH);
  return title || truncateAtWordBoundary(stripped, MAX_SUGGESTED_TITLE_LENGTH);
}

export function buildImportLearningNotes(source: string | undefined, learning: ImportLearningSignal): string | undefined {
  const lines = [
    source?.trim() ? `Source: ${source.trim()}` : "",
    learning.tags.length ? `Learned tags: ${learning.tags.join(", ")}` : "",
    learning.reusableTokens.length ? `Reusable tokens: ${learning.reusableTokens.join("; ")}` : "",
    learning.avoidanceText ? `Avoidance: ${learning.avoidanceText}` : "",
    learning.parameterLabels.length ? `Detected parameters: ${learning.parameterLabels.join(", ")}` : "",
  ].filter(Boolean);

  return lines.length ? lines.join("\n") : undefined;
}
