CREATE TABLE IF NOT EXISTS shot_sequence (
  id TEXT PRIMARY KEY NOT NULL,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  shot_type TEXT NOT NULL DEFAULT 'hero',
  label TEXT NOT NULL DEFAULT '',
  prompt_id TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  result_id TEXT REFERENCES results(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_shot_sequence_project ON shot_sequence(project_id, sort_order);
