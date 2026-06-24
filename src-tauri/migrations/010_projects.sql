-- Phase 14: Project / Campaign Workspace

CREATE TABLE IF NOT EXISTS projects (
  id               TEXT PRIMARY KEY,
  title            TEXT NOT NULL,
  client           TEXT,
  campaign         TEXT,
  status           TEXT NOT NULL DEFAULT 'draft',
  brief_text       TEXT,
  production_goal  TEXT,
  category         TEXT,
  tags             TEXT,
  notes            TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_prompts (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  prompt_id  TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, prompt_id)
);

CREATE TABLE IF NOT EXISTS project_results (
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  result_id  TEXT NOT NULL,
  PRIMARY KEY (project_id, result_id)
);

CREATE TABLE IF NOT EXISTS project_references (
  project_id   TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES references(id) ON DELETE CASCADE,
  PRIMARY KEY (project_id, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_projects_status  ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_created ON projects(created_at);
