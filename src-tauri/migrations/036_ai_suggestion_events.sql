-- Records whether the user accepted or dismissed an AI-generated suggestion
-- (analyzePrompt/analyzeImage/analyzeBrief/comparisonDecision), so acceptance
-- becomes a real, queryable signal instead of being thrown away.
CREATE TABLE IF NOT EXISTS ai_suggestion_events (
  id         TEXT PRIMARY KEY NOT NULL,
  tool       TEXT NOT NULL,
  field      TEXT,
  action     TEXT NOT NULL,
  suggestion TEXT,
  prompt_id  TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  provider   TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_suggestion_events_tool ON ai_suggestion_events(tool);
