-- V4 workflow tables

CREATE TABLE IF NOT EXISTS comparison_sessions (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  project_id  TEXT REFERENCES projects(id) ON DELETE SET NULL,
  notes       TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS comparison_items (
  id          TEXT PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES comparison_sessions(id) ON DELETE CASCADE,
  result_id   TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  position    INTEGER NOT NULL DEFAULT 0,
  is_winner   INTEGER NOT NULL DEFAULT 0,
  is_rejected INTEGER NOT NULL DEFAULT 0,
  notes       TEXT,
  created_at  TEXT NOT NULL,
  UNIQUE(session_id, result_id)
);

CREATE TABLE IF NOT EXISTS project_deliverables (
  id           TEXT PRIMARY KEY,
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'todo'
                 CHECK(status IN ('todo','in_progress','review','done','cancelled')),
  position     INTEGER NOT NULL DEFAULT 0,
  prompt_id    TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  result_id    TEXT REFERENCES results(id) ON DELETE SET NULL,
  reference_id TEXT REFERENCES "references"(id) ON DELETE SET NULL,
  notes        TEXT,
  due_date     TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_threads (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS assistant_messages (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES assistant_threads(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK(role IN ('user','assistant')),
  content    TEXT NOT NULL,
  citations  TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_presets (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  format     TEXT NOT NULL CHECK(format IN ('markdown','json','html')),
  options    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
