-- Cinema Studio: independent video-production subsystem (script, folder-organized
-- assets, moodboard, scene/shot direction). Deliberately separate from
-- projects/prompts, which serve the unrelated image-ad workflow (Direction
-- Studio, Storytelling, shot_sequence) — see project docs for the rationale.

CREATE TABLE IF NOT EXISTS cinema_projects (
  id                    TEXT PRIMARY KEY NOT NULL,
  title                 TEXT NOT NULL,
  status                TEXT NOT NULL DEFAULT 'draft',
  script_model          TEXT,
  image_provider        TEXT,
  video_provider        TEXT,
  script_content        TEXT,
  script_idea           TEXT,
  script_runtime_target TEXT,
  script_setting        TEXT,
  script_tone           TEXT,
  script_status         TEXT NOT NULL DEFAULT 'draft',
  notes                 TEXT,
  thumbnail_data        TEXT,
  created_at            TEXT NOT NULL,
  updated_at            TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_projects_status ON cinema_projects(status);

CREATE TABLE IF NOT EXISTS cinema_script_versions (
  id         TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  label      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_script_versions_project ON cinema_script_versions(project_id);

CREATE TABLE IF NOT EXISTS cinema_folders (
  id           TEXT PRIMARY KEY NOT NULL,
  project_id   TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  parent_id    TEXT REFERENCES cinema_folders(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  kind         TEXT NOT NULL DEFAULT 'other',
  description  TEXT,
  accent_color TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_folders_project ON cinema_folders(project_id);
CREATE INDEX IF NOT EXISTS idx_cinema_folders_parent ON cinema_folders(parent_id);

CREATE TABLE IF NOT EXISTS cinema_assets (
  id             TEXT PRIMARY KEY NOT NULL,
  project_id     TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  folder_id      TEXT NOT NULL REFERENCES cinema_folders(id) ON DELETE CASCADE,
  tag            TEXT NOT NULL,
  title          TEXT NOT NULL,
  asset_type     TEXT NOT NULL DEFAULT 'other',
  prompt_text    TEXT,
  prompt_id      TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  file_data      TEXT,
  thumbnail_data TEXT,
  is_primary     INTEGER NOT NULL DEFAULT 0,
  merged_from    TEXT,
  canvas_x       REAL NOT NULL DEFAULT 0,
  canvas_y       REAL NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE(project_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_cinema_assets_project ON cinema_assets(project_id);
CREATE INDEX IF NOT EXISTS idx_cinema_assets_folder ON cinema_assets(folder_id);

CREATE TABLE IF NOT EXISTS cinema_scenes (
  id             TEXT PRIMARY KEY NOT NULL,
  project_id     TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  title          TEXT NOT NULL,
  script_excerpt TEXT,
  summary        TEXT,
  mood           TEXT,
  accent_index   INTEGER NOT NULL DEFAULT 0,
  status         TEXT NOT NULL DEFAULT 'draft',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_scenes_project ON cinema_scenes(project_id);

CREATE TABLE IF NOT EXISTS cinema_shots (
  id               TEXT PRIMARY KEY NOT NULL,
  scene_id         TEXT NOT NULL REFERENCES cinema_scenes(id) ON DELETE CASCADE,
  project_id       TEXT NOT NULL REFERENCES cinema_projects(id) ON DELETE CASCADE,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  label            TEXT NOT NULL,
  shot_type        TEXT NOT NULL DEFAULT 'hero',
  description      TEXT,
  director_notes   TEXT,
  dop_notes        TEXT,
  camera_notes     TEXT,
  lighting_notes   TEXT,
  sound_notes      TEXT,
  linked_asset_ids TEXT,
  transition_in    TEXT,
  transition_out   TEXT,
  generated_prompt TEXT,
  prompt_id        TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  is_broll         INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'draft',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_shots_scene ON cinema_shots(scene_id);
CREATE INDEX IF NOT EXISTS idx_cinema_shots_project ON cinema_shots(project_id);
