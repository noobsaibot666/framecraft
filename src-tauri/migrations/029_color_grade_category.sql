-- Rename the "Color" token category label to "Color Grade" (V2 feedback §8).
-- The internal name stays 'color' so existing tokens, hints, and code keep working.
UPDATE token_categories SET label = 'Color Grade' WHERE name = 'color';
