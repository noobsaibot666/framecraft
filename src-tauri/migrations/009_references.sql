-- Phase 13: Reference Library (V3)
-- Migration 001 created a basic placeholder references table that is always empty
-- at this migration point (the feature was not built until V3). Drop and recreate
-- with the full schema. prompt_references and result_references use CREATE IF NOT EXISTS
-- safely because migration 001's version is schema-identical.

DROP INDEX IF EXISTS idx_references_created;
DROP TABLE IF EXISTS result_references;
DROP TABLE IF EXISTS prompt_references;
DROP TABLE IF EXISTS "references";

CREATE TABLE "references" (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  description   TEXT,
  kind          TEXT NOT NULL DEFAULT 'image',
  file_data     TEXT,
  thumbnail_data TEXT,
  provider      TEXT,
  category      TEXT,
  source_url    TEXT,
  tags          TEXT,
  rating        INTEGER NOT NULL DEFAULT 0,
  best_use      TEXT,
  risk_notes    TEXT,
  notes         TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prompt_references (
  prompt_id    TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'style',
  PRIMARY KEY (prompt_id, reference_id)
);

CREATE TABLE IF NOT EXISTS result_references (
  result_id    TEXT NOT NULL REFERENCES results(id) ON DELETE CASCADE,
  reference_id TEXT NOT NULL REFERENCES "references"(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'style',
  PRIMARY KEY (result_id, reference_id)
);

CREATE INDEX idx_references_kind    ON "references"(kind);
CREATE INDEX idx_references_rating  ON "references"(rating);
CREATE INDEX idx_references_created ON "references"(created_at);
