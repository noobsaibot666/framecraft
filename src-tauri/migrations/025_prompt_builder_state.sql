-- Persist builder state (mode, token sequence, token overrides) so editing
-- a prompt restores the exact builder configuration used when it was saved.
ALTER TABLE prompts ADD COLUMN builder_state TEXT;
