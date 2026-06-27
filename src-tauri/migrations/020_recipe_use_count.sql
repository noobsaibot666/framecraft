ALTER TABLE prompts ADD COLUMN recipe_use_count INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_prompts_recipe_use ON prompts(recipe_use_count) WHERE is_recipe = 1;
