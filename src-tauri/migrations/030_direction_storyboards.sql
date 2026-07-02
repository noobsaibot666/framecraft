CREATE TABLE IF NOT EXISTS direction_storyboards (
  id            TEXT PRIMARY KEY,
  direction_id  TEXT NOT NULL REFERENCES creative_directions(id) ON DELETE CASCADE,
  project_id    TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  shot_label    TEXT NOT NULL,
  description   TEXT NOT NULL,
  is_approved   INTEGER NOT NULL DEFAULT 0,
  prompt_id     TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  accent_index  INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_direction_storyboards_direction
  ON direction_storyboards(direction_id, sort_order);
