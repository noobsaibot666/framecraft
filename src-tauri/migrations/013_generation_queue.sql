CREATE TABLE IF NOT EXISTS generation_queue (
  id          TEXT PRIMARY KEY,
  prompt_id   TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK(status IN ('pending', 'sent', 'done', 'failed', 'skipped')),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  result_path TEXT,
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  UNIQUE(prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_generation_queue_project ON generation_queue(project_id);
CREATE INDEX IF NOT EXISTS idx_generation_queue_status ON generation_queue(status);
CREATE INDEX IF NOT EXISTS idx_generation_queue_sort ON generation_queue(sort_order);
