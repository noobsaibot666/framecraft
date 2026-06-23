CREATE TABLE IF NOT EXISTS token_categories (
  id         TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name       TEXT NOT NULL UNIQUE,
  label      TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tokens (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  text          TEXT NOT NULL,
  category_id   TEXT NOT NULL REFERENCES token_categories(id),
  provider      TEXT,
  use_count     INTEGER DEFAULT 0,
  quality_score REAL DEFAULT 0.0,
  tags          TEXT,
  is_builtin    INTEGER DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tokens_category_id   ON tokens(category_id);
CREATE INDEX IF NOT EXISTS idx_tokens_use_count      ON tokens(use_count);
CREATE INDEX IF NOT EXISTS idx_tokens_quality_score  ON tokens(quality_score);

CREATE TABLE IF NOT EXISTS prompt_tokens (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  prompt_id   TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  token_id    TEXT NOT NULL REFERENCES tokens(id),
  sort_order  INTEGER DEFAULT 0,
  custom_text TEXT
);

CREATE INDEX IF NOT EXISTS idx_prompt_tokens_prompt_id ON prompt_tokens(prompt_id);

INSERT OR IGNORE INTO token_categories (name, label, sort_order) VALUES
  ('subject',     'Subject',              1),
  ('action',      'Action',               2),
  ('environment', 'Environment',          3),
  ('camera',      'Camera',               4),
  ('lens',        'Lens',                 5),
  ('composition', 'Composition',          6),
  ('lighting',    'Lighting',             7),
  ('mood',        'Mood',                 8),
  ('material',    'Material',             9),
  ('color',       'Color',               10),
  ('realism',     'Realism',             11),
  ('brand_tone',  'Brand Tone',          12),
  ('motion',      'Motion',              13),
  ('avoidance',   'Avoidance',           14),
  ('parameters',  'Provider Parameters', 15);
