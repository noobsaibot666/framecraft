-- Phase 64: Campaign Layer

CREATE TABLE IF NOT EXISTS campaigns (
  id          TEXT PRIMARY KEY NOT NULL,
  title       TEXT NOT NULL,
  client      TEXT,
  brief       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- Nullable FK so existing projects are unaffected
ALTER TABLE projects ADD COLUMN campaign_id TEXT REFERENCES campaigns(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_campaigns_status  ON campaigns(status);
CREATE INDEX IF NOT EXISTS idx_projects_campaign ON projects(campaign_id);
