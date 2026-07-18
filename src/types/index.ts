export type Provider =
  | "midjourney"
  | "dalle"
  | "stable_diffusion"
  | "firefly"
  | "ideogram"
  | "flux"
  | "nano_banana"
  | "gpt_image"
  | "seedance"
  | "kling"
  | "runway"
  | "higgsfield"
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
  parameters?: Record<string, string | boolean | number>;
  tags?: string[];
  rating: number;
  ai_look_risk: number;
  reuse_potential: number;
  is_recipe: boolean;
  recipe_use_count?: number;
  is_winner: boolean;
  is_failed: boolean;
  failure_notes?: string;
  notes?: string;
  best_use?: string;
  risk_notes?: string;
  version: number;
  parent_id?: string;
  source_url?: string;
  thumbnail_data?: string;
  builder_state?: string;
  thumbnail_result_id?: string;
  variant_label?: string;
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
  avg_rating?: number;
  win_appearances?: number;
  is_builtin: boolean;
  is_favorite: boolean;
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
  total_winners: number;
  recent_prompts: Prompt[];
  top_rated: Prompt[];
}

export interface LibraryFilters {
  provider?: Provider;
  category?: Category;
  minRating?: number;
  maxAiRisk?: number;
  isWinner?: boolean;
  isFailed?: boolean;
  isRecipe?: boolean;
}

export type SortOption = "newest" | "oldest" | "rating_desc" | "rating_asc" | "most_used" | "ai_risk_desc" | "ai_risk_asc";

export type ProjectStatus = "draft" | "active" | "review" | "archived" | "delivered";

export type CampaignStatus = "active" | "archived";

export interface Campaign {
  id: string;
  title: string;
  client?: string;
  brief?: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string;
  // Counts populated on query
  project_count?: number;
  winner_count?: number;
}

export interface Project {
  id: string;
  title: string;
  client?: string;
  campaign_client?: string;
  campaign?: string;
  campaign_id?: string;
  status: ProjectStatus;
  project_type?: string;
  intended_output?: string;
  image_needs?: string;
  video_needs?: string;
  aspect_ratios?: string[];
  provider_targets?: string[];
  visual_direction?: string;
  constraints?: string;
  creative_goals?: string;
  /** Creative Director Mode strategy JSON (doc 04 §4, migration 031). */
  creative_strategy?: string;
  brief_text?: string;
  production_goal?: string;
  category?: Category;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
  // Counts populated on query
  prompt_count?: number;
  result_count?: number;
  reference_count?: number;
  winner_count?: number;
}

export interface ProjectFilters {
  status?: ProjectStatus;
  excludeArchived?: boolean;
}

export interface CreativeDirection {
  id: string;
  project_id: string;
  title: string;
  campaign_idea: string;
  rationale: string;
  visual_aesthetic: string;
  brand_connection: string;
  product_message: string;
  tone: string;
  prompt_direction: string;
  is_selected: boolean;
  created_at: string;
  updated_at: string;
}

export interface DirectionStoryboard {
  id: string;
  direction_id: string;
  project_id: string;
  sort_order: number;
  shot_label: string;
  description: string;
  is_approved: boolean;
  prompt_id?: string;
  accent_index: number;
  created_at: string;
  updated_at: string;
}

export type ReferenceKind =
  | "image"
  | "frame"
  | "result"
  | "source"
  | "mood"
  | "product"
  | "style";

export type ReferenceRole =
  | "style"
  | "composition"
  | "lighting"
  | "product"
  | "character"
  | "frame"
  | "failure-example";

export interface Reference {
  id: string;
  title: string;
  description?: string;
  kind: ReferenceKind;
  file_data?: string;
  thumbnail_data?: string;
  provider?: Provider;
  category?: Category;
  source_url?: string;
  tags?: string[];
  rating: number;
  best_use?: string;
  risk_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PromptReference {
  prompt_id: string;
  reference_id: string;
  role: ReferenceRole;
}

export interface ResultReference {
  result_id: string;
  reference_id: string;
  role: ReferenceRole;
}

export interface ReferenceFilters {
  kind?: ReferenceKind;
  category?: Category;
  provider?: Provider;
  minRating?: number;
}

// ─── V4: Comparison Lab ───────────────────────────────────────

export type ComparisonType =
  | "result_result"
  | "reference_result"
  | "provider_provider"
  | "prompt_version"
  | "direction_result"
  | "sref_sref"
  | "ai_risk";

export type ComparisonSourceRole =
  | "result"
  | "reference"
  | "provider_a"
  | "provider_b"
  | "provider_c"
  | "provider_d"
  | "version_a"
  | "version_b"
  | "version_c"
  | "version_d"
  | "sref_a"
  | "sref_b"
  | "sref_c"
  | "sref_d";

export interface ComparisonSession {
  id: string;
  title: string;
  project_id?: string;
  notes?: string;
  comparison_type: ComparisonType;
  outcome_summary?: string;
  item_count: number;
  winner_count: number;
  created_at: string;
  updated_at: string;
}

export interface ComparisonItem {
  id: string;
  session_id: string;
  result_id: string;
  position: number;
  is_winner: boolean;
  is_rejected: boolean;
  notes?: string;
  source_role: ComparisonSourceRole;
  created_at: string;
}

/** Enriched result data used in comparison slots. */
export interface ComparisonResult {
  result_id: string;
  prompt_id: string;
  prompt_title: string;
  prompt_provider: Provider;
  prompt_version: number;
  /** Prompt's style reference code — labels slots in SREF vs SREF mode. */
  prompt_style_ref?: string;
  thumbnail_path?: string;
  file_path?: string;
  score_overall: number;
  score_realism: number;
  score_brand_fit: number;
  score_composition: number;
  score_lighting: number;
  score_ai_risk: number;
  is_winner: boolean;
  is_failed: boolean;
  artifacts?: string[];
  created_at: string;
}

// ─── V4: Guided Assistant ────────────────────────────────────

export interface AssistantThread {
  id: string;
  project_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessage {
  id: string;
  thread_id: string;
  role: "user" | "assistant";
  content: string;
  citations?: string[];
  created_at: string;
}

export type SuggestionKind =
  | "next_action"
  | "avoidance_improvement"
  | "reference_gap"
  | "winner_interpretation"
  | "proven_token"
  | "recurring_avoidance"
  | "impact_reference";

export interface AssistantSuggestion {
  kind: SuggestionKind;
  label: string;
  body: string;
  action?: {
    label: string;
    type: "craft_prompt" | "navigate" | "save_note";
    payload?: string;
  };
}

export interface ProjectContextPack {
  project: {
    id: string;
    title: string;
    brief_text?: string;
    production_goal?: string;
    category?: string;
    status: string;
    client?: string;
    notes?: string;
    /** Creative Director Mode strategy JSON (doc 04 §4). */
    creative_strategy?: string;
  };
  prompts: {
    total: number;
    winners: number;
    failed: number;
    avgRating: number;
    top: { id: string; title: string; rating: number; is_winner: boolean; is_failed: boolean }[];
    /** Distinct generation providers used by this project's prompts — drives formula context (doc 03). */
    providers: Provider[];
  };
  results: {
    total: number;
    winners: number;
    failed: number;
    avgScore: number;
  };
  references: {
    total: number;
    kinds: string[];
  };
  deliverables: {
    total: number;
    byStatus: Partial<Record<string, number>>;
    missingResults: number;
  };
  comparisons: {
    total: number;
    decided: number;
    pending: number;
    recentOutcomes: string[];
  };
  /** Signals pulled from the app's learned-scoring layer (recommendations.ts, referenceImpact.ts) — see CLAUDE.md's Application intelligence section. */
  learned: {
    provenTokens: { token: Token; reason: string; score: number }[];
    avoidance: { label: string; correction?: string; reason: string; severity: "critical" | "high" | "medium" | "low" }[];
    highImpactReferences: {
      id: string; title: string; kind: string; thumbnail_data?: string;
      project_count: number; project_winner_count: number;
      result_appearances: number; result_win_count: number;
      impact_score: number;
    }[];
  };
}

// ─── V4: Deliverable Board ────────────────────────────────────

export type DeliverableStatus =
  | "planned"
  | "prompting"
  | "generating"
  | "review"
  | "selected"
  | "final";

export interface Deliverable {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  status: DeliverableStatus;
  target_format?: string;
  aspect_ratio?: string;
  linked_prompt_id?: string;
  linked_result_id?: string;
  notes?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type ShotType =
  | "establishing"
  | "wide"
  | "medium"
  | "close_up"
  | "detail"
  | "cutaway"
  | "hero"
  | "product";

export interface Shot {
  id: string;
  project_id: string;
  sort_order: number;
  shot_type: ShotType;
  label: string;
  prompt_id?: string;
  result_id?: string;
  notes?: string;
  created_at: string;
}

export interface CreateShotInput {
  project_id: string;
  sort_order: number;
  shot_type: ShotType;
  label: string;
  prompt_id?: string;
  result_id?: string;
  notes?: string;
}

export interface UpdateShotInput {
  shot_type?: ShotType;
  label?: string;
  prompt_id?: string | null;
  result_id?: string | null;
  notes?: string | null;
  sort_order?: number;
}

// ─── Cinema Studio (Sprint 13) ─────────────────────────────────
// Independent video-production subsystem: script → folder-organized assets
// (moodboard) → scene/shot direction. Deliberately separate from Project/
// Prompt/shot_sequence, which serve the unrelated image-ad workflow.

export type CinemaProjectStatus = "draft" | "scripting" | "assets" | "scenes" | "complete" | "archived";
export type CinemaScriptStatus = "draft" | "approved";
// "product" is distinct from "prop": the product is the advertised item an ad
// exists to sell — the hero of the piece — vs. an incidental environment prop.
export type CinemaFolderKind = "character" | "location" | "prop" | "product" | "other";
export type CinemaAssetType = "character_sheet" | "location" | "prop" | "product" | "other";
export type CinemaShotType = ShotType | "b_roll";
export type CinemaSceneStatus = "draft" | "directing" | "ready" | "exported";
export type CinemaShotStatus = "draft" | "ready" | "exported";

export interface CinemaProject {
  id: string;
  title: string;
  status: CinemaProjectStatus;
  script_model?: string;
  image_provider?: Provider;
  video_provider?: Provider;
  script_content?: string;
  script_idea?: string;
  script_runtime_target?: string;
  script_setting?: string;
  script_tone?: string;
  script_status: CinemaScriptStatus;
  notes?: string;
  thumbnail_data?: string;
  created_at: string;
  updated_at: string;
  // Counts populated on query
  folder_count?: number;
  asset_count?: number;
  scene_count?: number;
  shot_count?: number;
}

export interface CreateCinemaProjectInput {
  title: string;
  script_model?: string;
  image_provider?: Provider;
  video_provider?: Provider;
  notes?: string;
}

export interface UpdateCinemaProjectInput {
  title?: string;
  status?: CinemaProjectStatus;
  script_model?: string;
  image_provider?: Provider;
  video_provider?: Provider;
  script_content?: string;
  script_idea?: string;
  script_runtime_target?: string;
  script_setting?: string;
  script_tone?: string;
  script_status?: CinemaScriptStatus;
  notes?: string;
  thumbnail_data?: string;
}

export interface CinemaScriptVersion {
  id: string;
  project_id: string;
  content: string;
  label?: string;
  created_at: string;
}

export interface CinemaShotPromptVersion {
  id: string;
  shot_id: string;
  content: string;
  label?: string;
  created_at: string;
}

export interface CinemaFolder {
  id: string;
  project_id: string;
  parent_id?: string;
  name: string;
  kind: CinemaFolderKind;
  description?: string;
  accent_color?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCinemaFolderInput {
  project_id: string;
  parent_id?: string;
  name: string;
  kind?: CinemaFolderKind;
  description?: string;
  accent_color?: string;
  sort_order?: number;
}

export interface UpdateCinemaFolderInput {
  name?: string;
  kind?: CinemaFolderKind;
  description?: string | null;
  accent_color?: string | null;
  parent_id?: string | null;
  sort_order?: number;
}

export interface CinemaAsset {
  id: string;
  project_id: string;
  folder_id: string;
  tag: string;
  title: string;
  asset_type: CinemaAssetType;
  prompt_text?: string;
  prompt_id?: string;
  file_data?: string;
  thumbnail_data?: string;
  is_primary: boolean;
  merged_from?: string[];
  canvas_x: number;
  canvas_y: number;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCinemaAssetInput {
  project_id: string;
  folder_id: string;
  tag: string;
  title: string;
  asset_type?: CinemaAssetType;
  prompt_text?: string;
  prompt_id?: string;
  file_data?: string;
  thumbnail_data?: string;
  is_primary?: boolean;
  merged_from?: string[];
  canvas_x?: number;
  canvas_y?: number;
  sort_order?: number;
}

export interface UpdateCinemaAssetInput {
  folder_id?: string;
  tag?: string;
  title?: string;
  asset_type?: CinemaAssetType;
  prompt_text?: string | null;
  prompt_id?: string | null;
  file_data?: string | null;
  thumbnail_data?: string | null;
  is_primary?: boolean;
  merged_from?: string[] | null;
  canvas_x?: number;
  canvas_y?: number;
  sort_order?: number;
}

export interface CinemaScene {
  id: string;
  project_id: string;
  sort_order: number;
  title: string;
  script_excerpt?: string;
  summary?: string;
  mood?: string;
  accent_index: number;
  status: CinemaSceneStatus;
  created_at: string;
  updated_at: string;
  // Count populated on query
  shot_count?: number;
}

export interface CreateCinemaSceneInput {
  project_id: string;
  sort_order?: number;
  title: string;
  script_excerpt?: string;
  summary?: string;
  mood?: string;
  accent_index?: number;
}

export interface UpdateCinemaSceneInput {
  sort_order?: number;
  title?: string;
  script_excerpt?: string | null;
  summary?: string | null;
  mood?: string | null;
  accent_index?: number;
  status?: CinemaSceneStatus;
}

export interface CinemaShot {
  id: string;
  scene_id: string;
  project_id: string;
  sort_order: number;
  label: string;
  shot_type: CinemaShotType;
  description?: string;
  director_notes?: string;
  dop_notes?: string;
  camera_notes?: string;
  lighting_notes?: string;
  sound_notes?: string;
  linked_asset_ids?: string[];
  transition_in?: string;
  transition_out?: string;
  generated_prompt?: string;
  prompt_id?: string;
  is_broll: boolean;
  status: CinemaShotStatus;
  created_at: string;
  updated_at: string;
}

export interface CreateCinemaShotInput {
  scene_id: string;
  project_id: string;
  sort_order?: number;
  label: string;
  shot_type?: CinemaShotType;
  description?: string;
  director_notes?: string;
  dop_notes?: string;
  camera_notes?: string;
  lighting_notes?: string;
  sound_notes?: string;
  linked_asset_ids?: string[];
  is_broll?: boolean;
}

export interface UpdateCinemaShotInput {
  sort_order?: number;
  label?: string;
  shot_type?: CinemaShotType;
  description?: string | null;
  director_notes?: string | null;
  dop_notes?: string | null;
  camera_notes?: string | null;
  lighting_notes?: string | null;
  sound_notes?: string | null;
  linked_asset_ids?: string[] | null;
  transition_in?: string | null;
  transition_out?: string | null;
  generated_prompt?: string | null;
  prompt_id?: string | null;
  is_broll?: boolean;
  status?: CinemaShotStatus;
}
