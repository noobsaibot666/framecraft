-- Align project_deliverables to Phase 18 spec.
-- Safe to drop: no deliverable data exists before Phase 18 ships.

DROP TABLE IF EXISTS project_deliverables;

CREATE TABLE IF NOT EXISTS project_deliverables (
  id              TEXT PRIMARY KEY,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'planned'
                    CHECK(status IN ('planned','prompting','generating','review','selected','final')),
  target_format   TEXT,
  aspect_ratio    TEXT,
  linked_prompt_id  TEXT REFERENCES prompts(id) ON DELETE SET NULL,
  linked_result_id  TEXT REFERENCES results(id) ON DELETE SET NULL,
  notes           TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliverable_references (
  deliverable_id  TEXT NOT NULL REFERENCES project_deliverables(id) ON DELETE CASCADE,
  reference_id    TEXT NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  PRIMARY KEY (deliverable_id, reference_id)
);
