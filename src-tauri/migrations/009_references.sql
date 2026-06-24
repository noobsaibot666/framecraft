-- Phase 13: Reference Library

CREATE TABLE IF NOT EXISTS references (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  kind          TEXT NOT NULL DEFAULT 'image',
  file_data     TEXT,
  thumbnail_data TEXT,
  provider      TEXT,
  category      TEXT,
  source_url    TEXT,
  tags          TEXT,
  rating        INTEGER NOT NULL DEFAULT 0,
  best_use      TEXT,
  risk_notes    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_references (
  prompt_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES references(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'style',
  PRIMARY KEY (prompt_id, reference_id)
);

CREATE TABLE IF NOT EXISTS result_references (
  result_id    TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES references(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'style',
  PRIMARY KEY (result_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_references_kind    ON references(kind);
CREATE INDEX IF NOT EXISTS idx_references_rating  ON references(rating);
CREATE INDEX IF NOT EXISTS idx_references_created ON references(created_at);
