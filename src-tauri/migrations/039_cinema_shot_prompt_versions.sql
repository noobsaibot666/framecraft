-- Version history for a Cinema Studio shot's AI-generated director's-brief
-- prompt (cinema_shots.generated_prompt only ever holds the current value).
-- Mirrors cinema_script_versions' shape (migration 038) — explicit
-- user-triggered snapshots, not autosave-every-keystroke.

CREATE TABLE IF NOT EXISTS cinema_shot_prompt_versions (
  id         TEXT PRIMARY KEY NOT NULL,
  shot_id    TEXT NOT NULL REFERENCES cinema_shots(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  label      TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_cinema_shot_prompt_versions_shot ON cinema_shot_prompt_versions(shot_id);
