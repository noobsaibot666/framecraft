-- Token co-occurrence pattern tracking for Production Memory (Phase 06)
-- Populated incrementally after each high-rated result save

CREATE TABLE IF NOT EXISTS token_patterns (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  token_a_id        TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  token_b_id        TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  co_occurrence_count INTEGER DEFAULT 1,
  avg_rating        REAL DEFAULT 0,
  last_updated      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(token_a_id, token_b_id)
);

CREATE INDEX IF NOT EXISTS idx_token_patterns_a ON token_patterns(token_a_id);
CREATE INDEX IF NOT EXISTS idx_token_patterns_b ON token_patterns(token_b_id);
CREATE INDEX IF NOT EXISTS idx_token_patterns_rating ON token_patterns(avg_rating DESC);
