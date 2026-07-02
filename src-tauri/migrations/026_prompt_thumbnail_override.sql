-- Manual thumbnail override: when set, this result is used as the prompt's
-- thumbnail regardless of rating/recency. NULL falls back to auto-selection
-- (best-rated result, then most recent).
ALTER TABLE prompts ADD COLUMN thumbnail_result_id TEXT REFERENCES results(id) ON DELETE SET NULL;
