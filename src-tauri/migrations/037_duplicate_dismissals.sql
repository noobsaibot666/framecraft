-- Persists which suggested near-duplicate prompt the user dismissed, keyed by
-- the pair (source prompt being edited, candidate it was compared against),
-- so a dismissal survives reopening the same saved prompt later instead of
-- resetting on every debounced recompute (findSimilarPrompts, memoryEngine.ts).
CREATE TABLE IF NOT EXISTS duplicate_dismissals (
  id                  TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  source_prompt_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  candidate_prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  created_at          TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_prompt_id, candidate_prompt_id)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_dismissals_source ON duplicate_dismissals(source_prompt_id);
