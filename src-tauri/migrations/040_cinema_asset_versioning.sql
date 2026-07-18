-- Cinema Studio asset iteration workflow: numbered versions (V1/V2/…) of the
-- same asset, a chosen image-generation provider per version so the AI draft
-- can write provider-appropriate prompts/parameters, a star rating + free-text
-- feedback captured after reviewing a generated image (feeds the next
-- version's prompt revision), and a locked flag marking an asset as the
-- approved one for its folder (surfaced on the Moodboard).
--
-- version_group_id is a plain TEXT column (no FK), same convention as
-- cinema_assets.merged_from — it groups sibling version rows by the root
-- version's id. Deliberately nullable/no backfill: rows created before this
-- migration are treated by the application as their own single-version group
-- (version_group_id IS NULL -> group == id).

ALTER TABLE cinema_assets ADD COLUMN rating INTEGER;
ALTER TABLE cinema_assets ADD COLUMN feedback TEXT;
ALTER TABLE cinema_assets ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
ALTER TABLE cinema_assets ADD COLUMN version_group_id TEXT;
ALTER TABLE cinema_assets ADD COLUMN version_number INTEGER NOT NULL DEFAULT 1;
ALTER TABLE cinema_assets ADD COLUMN provider TEXT;
ALTER TABLE cinema_assets ADD COLUMN prompt_parameters TEXT;
ALTER TABLE cinema_assets ADD COLUMN instruction TEXT;

CREATE INDEX IF NOT EXISTS idx_cinema_assets_version_group ON cinema_assets(version_group_id);
