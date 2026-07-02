-- Named "Create Variation" records are distinguished from plain "New Version"
-- forks by having a non-null variant_label (both still use parent_id/version).
ALTER TABLE prompts ADD COLUMN variant_label TEXT;
