ALTER TABLE generation_queue ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_generation_queue_pinned ON generation_queue(is_pinned);
