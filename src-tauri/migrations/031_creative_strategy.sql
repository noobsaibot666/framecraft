-- Creative Director Mode (review doc 04 §4): structured project strategy
-- (campaign idea, concepts, directions, aesthetics, brand connection,
-- product message, audience, execution direction) stored as JSON.
ALTER TABLE projects ADD COLUMN creative_strategy TEXT;
