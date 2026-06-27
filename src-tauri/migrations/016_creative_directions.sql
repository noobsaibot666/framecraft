CREATE TABLE IF NOT EXISTS creative_directions (
  id               TEXT PRIMARY KEY,
  project_id       TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  campaign_idea    TEXT NOT NULL DEFAULT '',
  rationale        TEXT NOT NULL DEFAULT '',
  visual_aesthetic TEXT NOT NULL DEFAULT '',
  brand_connection TEXT NOT NULL DEFAULT '',
  product_message  TEXT NOT NULL DEFAULT '',
  tone             TEXT NOT NULL DEFAULT '',
  prompt_direction TEXT NOT NULL DEFAULT '',
  is_selected      INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_creative_directions_project
  ON creative_directions(project_id, updated_at DESC);

