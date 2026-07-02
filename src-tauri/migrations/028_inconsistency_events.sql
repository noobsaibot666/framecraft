-- Records each time the rule-based inconsistency detector fires and what the
-- user did about it, so recurring conflicts can feed back into app
-- intelligence (e.g. surfaced as avoidance recommendations).
CREATE TABLE IF NOT EXISTS inconsistency_events (
  id         TEXT PRIMARY KEY NOT NULL,
  rule_id    TEXT NOT NULL,
  rule_label TEXT NOT NULL,
  suggestion TEXT,
  prompt_id  TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  provider   TEXT,
  action     TEXT NOT NULL DEFAULT 'warned',
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inconsistency_events_rule ON inconsistency_events(rule_id);
