const KEY_PROVIDER = "fc_pref_default_provider";
const KEY_ASPECT_RATIO = "fc_pref_default_aspect_ratio";
const KEY_CATEGORY = "fc_pref_default_category";
const KEY_AUTO_ANALYZE = "fc_pref_auto_analyze";
const KEY_LIBRARY_PAGE_SIZE = "fc_pref_library_page_size";

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

export const PREF_LIBRARY_PAGE_SIZES = [
  { value: 25, label: "25" },
  { value: 50, label: "50" },
  { value: 100, label: "100" },
];

export interface UserPreferences {
  defaultProvider: string;
  defaultAspectRatio: string;
  defaultCategory: string;
  autoAnalyzeDraft: boolean;
  libraryPageSize: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  defaultProvider: "midjourney",
  defaultAspectRatio: "",
  defaultCategory: "",
  autoAnalyzeDraft: false,
  libraryPageSize: 50,
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
  const pageSizeRaw = parseInt(safeGet(KEY_LIBRARY_PAGE_SIZE), 10);
  const validSizes = PREF_LIBRARY_PAGE_SIZES.map((s) => s.value);
  return {
    defaultProvider: safeGet(KEY_PROVIDER) || DEFAULT_PREFERENCES.defaultProvider,
    defaultAspectRatio: safeGet(KEY_ASPECT_RATIO),
    defaultCategory: safeGet(KEY_CATEGORY),
    autoAnalyzeDraft: safeGet(KEY_AUTO_ANALYZE) === "true",
    libraryPageSize: validSizes.includes(pageSizeRaw) ? pageSizeRaw : DEFAULT_PREFERENCES.libraryPageSize,
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

export function setAutoAnalyzeDraft(value: boolean): void {
  safeSet(KEY_AUTO_ANALYZE, value ? "true" : "");
}

export function setLibraryPageSize(value: number): void {
  safeSet(KEY_LIBRARY_PAGE_SIZE, String(value));
}

export function resetPreferences(): void {
  safeSet(KEY_PROVIDER, "");
  safeSet(KEY_ASPECT_RATIO, "");
  safeSet(KEY_CATEGORY, "");
  safeSet(KEY_AUTO_ANALYZE, "");
  safeSet(KEY_LIBRARY_PAGE_SIZE, "");
}
