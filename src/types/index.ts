export type Provider =
  | "midjourney"
  | "dalle"
  | "stable_diffusion"
  | "firefly"
  | "ideogram"
  | "flux"
  | "other";

export type Category =
  | "advertising"
  | "editorial"
  | "product"
  | "fashion"
  | "automotive"
  | "architecture"
  | "portrait"
  | "cinematic"
  | "abstract"
  | "other";

export type Severity = "low" | "medium" | "high" | "critical";

export interface Prompt {
  id: string;
  title: string;
  description?: string;
  provider: Provider;
  category?: Category;
  use_case?: string;
  prompt_text: string;
  avoidance_text?: string;
  aspect_ratio?: string;
  model_version?: string;
  camera?: string;
  lens?: string;
  lighting?: string;
  style_ref?: string;
  character_ref?: string;
  image_ref?: string;
  parameters?: Record<string, string>;
  tags?: string[];
  rating: number;
  ai_look_risk: number;
  reuse_potential: number;
  is_recipe: boolean;
  is_winner: boolean;
  is_failed: boolean;
  failure_notes?: string;
  notes?: string;
  version: number;
  parent_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Result {
  id: string;
  prompt_id: string;
  file_path?: string;
  thumbnail_path?: string;
  provider?: Provider;
  score_overall: number;
  score_realism: number;
  score_brand_fit: number;
  score_composition: number;
  score_lighting: number;
  score_ai_risk: number;
  reuse_potential: number;
  is_winner: boolean;
  is_failed: boolean;
  artifacts?: string[];
  notes?: string;
  created_at: string;
}

export interface Recipe {
  id: string;
  title: string;
  description?: string;
  category?: Category;
  provider?: Provider;
  structure: RecipeSlot[];
  example_prompt?: string;
  tags?: string[];
  use_count: number;
  rating: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface RecipeSlot {
  label: string;
  placeholder: string;
  required: boolean;
}

export interface TokenCategory {
  id: string;
  name: string;
  label: string;
  description?: string;
  sort_order: number;
}

export interface Token {
  id: string;
  text: string;
  category_id: string;
  category_name?: string;
  provider?: Provider;
  use_count: number;
  quality_score: number;
  is_builtin: boolean;
}

export interface TokenPill extends Token {
  sort_order: number;
  custom_text?: string;
}

export interface SREF {
  id: string;
  code: string;
  title?: string;
  description?: string;
  provider: Provider;
  category?: Category;
  best_use?: string;
  risk_notes?: string;
  example_path?: string;
  rating: number;
  tags?: string[];
  notes?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  code: string;
  title?: string;
  description?: string;
  provider: Provider;
  best_use?: string;
  risk_notes?: string;
  example_path?: string;
  rating: number;
  tags?: string[];
  notes?: string;
  created_at: string;
}

export interface AvoidancePattern {
  id: string;
  artifact_type: string;
  label: string;
  category: string;
  description?: string;
  correction_prompt?: string;
  severity: Severity;
  provider?: Provider;
  is_builtin: boolean;
}

export interface DetectedRisk {
  pattern: AvoidancePattern;
  triggered_by?: string[];
}

export interface DashboardStats {
  total_prompts: number;
  total_results: number;
  total_recipes: number;
  total_srefs: number;
  winners: number;
  avg_rating: number;
}

export interface LibraryFilters {
  provider?: Provider;
  category?: Category;
  min_rating?: number;
  max_ai_risk?: number;
  is_winner?: boolean;
  is_failed?: boolean;
  is_recipe?: boolean;
  tags?: string[];
}

export type SortOption =
  | "newest"
  | "oldest"
  | "rating_high"
  | "rating_low"
  | "ai_risk_high"
  | "ai_risk_low"
  | "most_used";
