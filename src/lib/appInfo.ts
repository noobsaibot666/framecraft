export const APP_MENU_ITEMS = [
  { id: "preferences", label: "Preferences" },
  { id: "about", label: "About Framecraft" },
] as const;

export type AppMenuItemId = (typeof APP_MENU_ITEMS)[number]["id"];

export const SUPPORTED_CREATIVE_PROVIDERS = [
  "Midjourney",
  "DALL-E",
  "Stable Diffusion",
  "Adobe Firefly",
  "Ideogram",
  "Flux",
  "Nano Banana Pro",
  "GPT Image 2",
  "Seedance",
  "Kling",
  "Runway",
  "Higgsfield",
  "Other",
] as const;

export const SUPPORTED_SYSTEM_PROVIDERS = ["Anthropic", "OpenAI"] as const;
