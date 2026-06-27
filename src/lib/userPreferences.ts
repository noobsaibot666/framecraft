const KEY_PROVIDER = "fc_pref_default_provider";
const KEY_ASPECT_RATIO = "fc_pref_default_aspect_ratio";
const KEY_CATEGORY = "fc_pref_default_category";

export const PREF_ASPECT_RATIOS = [
  { value: "", label: "No default" },
  { value: "1:1", label: "1:1 — Square" },
  { value: "16:9", label: "16:9 — Landscape" },
  { value: "9:16", label: "9:16 — Portrait" },
  { value: "4:3", label: "4:3 — Standard" },
  { value: "3:2", label: "3:2 — Photo" },
  { value: "2:3", label: "2:3 — Vertical" },
  { value: "21:9", label: "21:9 — Ultra-wide" },
  { value: "4:5", label: "4:5 — Instagram" },
];

export const PREF_CATEGORIES = [
  { value: "", label: "No default" },
  { value: "advertising", label: "Advertising" },
  { value: "editorial", label: "Editorial" },
  { value: "product", label: "Product" },
  { value: "fashion", label: "Fashion" },
  { value: "automotive", label: "Automotive" },
  { value: "architecture", label: "Architecture" },
  { value: "portrait", label: "Portrait" },
  { value: "cinematic", label: "Cinematic" },
  { value: "abstract", label: "Abstract" },
  { value: "other", label: "Other" },
];

export interface UserPreferences {
  defaultProvider: string;
  defaultAspectRatio: string;
  defaultCategory: string;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultProvider: "midjourney",
  defaultAspectRatio: "",
  defaultCategory: "",
};

function safeGet(key: string): string {
  try { return localStorage.getItem(key) ?? ""; } catch { return ""; }
}

function safeSet(key: string, value: string): void {
  try {
    if (value) localStorage.setItem(key, value);
    else localStorage.removeItem(key);
  } catch { /* silent */ }
}

export function getPreferences(): UserPreferences {
  return {
    defaultProvider: safeGet(KEY_PROVIDER) || DEFAULT_PREFERENCES.defaultProvider,
    defaultAspectRatio: safeGet(KEY_ASPECT_RATIO),
    defaultCategory: safeGet(KEY_CATEGORY),
  };
}

export function setDefaultProvider(value: string): void {
  safeSet(KEY_PROVIDER, value === DEFAULT_PREFERENCES.defaultProvider ? "" : value);
}

export function setDefaultAspectRatio(value: string): void {
  safeSet(KEY_ASPECT_RATIO, value);
}

export function setDefaultCategory(value: string): void {
  safeSet(KEY_CATEGORY, value);
}

export function resetPreferences(): void {
  safeSet(KEY_PROVIDER, "");
  safeSet(KEY_ASPECT_RATIO, "");
  safeSet(KEY_CATEGORY, "");
}
