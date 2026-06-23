CREATE TABLE IF NOT EXISTS prompts (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title           TEXT NOT NULL,
  description     TEXT,
  provider        TEXT NOT NULL DEFAULT 'midjourney',
  category        TEXT,
  use_case        TEXT,
  prompt_text     TEXT NOT NULL,
  avoidance_text  TEXT,
  aspect_ratio    TEXT,
  model_version   TEXT,
  camera          TEXT,
  lens            TEXT,
  lighting        TEXT,
  style_ref       TEXT,
  character_ref   TEXT,
  image_ref       TEXT,
  parameters      TEXT,
  tags            TEXT,
  rating          INTEGER DEFAULT 0,
  ai_look_risk    INTEGER DEFAULT 0,
  reuse_potential INTEGER DEFAULT 0,
  is_recipe       INTEGER DEFAULT 0,
  is_winner       INTEGER DEFAULT 0,
  is_failed       INTEGER DEFAULT 0,
  failure_notes   TEXT,
  notes           TEXT,
  version         INTEGER DEFAULT 1,
  parent_id       TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_prompts_provider   ON prompts(provider);
CREATE INDEX IF NOT EXISTS idx_prompts_category   ON prompts(category);
CREATE INDEX IF NOT EXISTS idx_prompts_rating     ON prompts(rating);
CREATE INDEX IF NOT EXISTS idx_prompts_created_at ON prompts(created_at);
CREATE INDEX IF NOT EXISTS idx_prompts_is_recipe  ON prompts(is_recipe);

CREATE TABLE IF NOT EXISTS results (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id         TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  file_path         TEXT,
  thumbnail_path    TEXT,
  provider          TEXT,
  score_overall     INTEGER DEFAULT 0,
  score_realism     INTEGER DEFAULT 0,
  score_brand_fit   INTEGER DEFAULT 0,
  score_composition INTEGER DEFAULT 0,
  score_lighting    INTEGER DEFAULT 0,
  score_ai_risk     INTEGER DEFAULT 0,
  reuse_potential   INTEGER DEFAULT 0,
  is_winner         INTEGER DEFAULT 0,
  is_failed         INTEGER DEFAULT 0,
  artifacts         TEXT,
  notes             TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_results_prompt_id    ON results(prompt_id);
CREATE INDEX IF NOT EXISTS idx_results_score_overall ON results(score_overall);

CREATE TABLE IF NOT EXISTS recipes (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title         TEXT NOT NULL,
  description   TEXT,
  category      TEXT,
  provider      TEXT,
  structure     TEXT,
  example_prompt TEXT,
  tags          TEXT,
  use_count     INTEGER DEFAULT 0,
  rating        INTEGER DEFAULT 0,
  notes         TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category);

CREATE TABLE IF NOT EXISTS srefs (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code        TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  provider    TEXT NOT NULL DEFAULT 'midjourney',
  category    TEXT,
  best_use    TEXT,
  risk_notes  TEXT,
  example_path TEXT,
  rating      INTEGER DEFAULT 0,
  tags        TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_srefs_provider ON srefs(provider);
CREATE INDEX IF NOT EXISTS idx_srefs_rating   ON srefs(rating);

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  code        TEXT NOT NULL,
  title       TEXT,
  description TEXT,
  provider    TEXT NOT NULL DEFAULT 'midjourney',
  best_use    TEXT,
  risk_notes  TEXT,
  example_path TEXT,
  rating      INTEGER DEFAULT 0,
  tags        TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS "references" (
  id             TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title          TEXT,
  description    TEXT,
  file_path      TEXT NOT NULL,
  thumbnail_path TEXT,
  category       TEXT,
  tags           TEXT,
  source         TEXT,
  notes          TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS prompt_references (
  prompt_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  PRIMARY KEY (prompt_id, reference_id)
);

CREATE TABLE IF NOT EXISTS avoidance_patterns (
  id               TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  artifact_type    TEXT NOT NULL,
  label            TEXT NOT NULL,
  category         TEXT NOT NULL,
  description      TEXT,
  correction_prompt TEXT,
  severity         TEXT DEFAULT 'medium',
  provider         TEXT,
  is_builtin       INTEGER DEFAULT 1,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
