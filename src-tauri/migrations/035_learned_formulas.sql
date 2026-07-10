-- Per-provider prompt success formulas learned from imports (promptFormula.ts).
-- Previously lived in browser localStorage, outside the portable-library
-- backup/sync path — moved here so learned formulas travel with the library.
CREATE TABLE IF NOT EXISTS learned_formulas (
  provider   TEXT PRIMARY KEY NOT NULL,
  steps      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
