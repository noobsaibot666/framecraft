-- Reorders token_categories.sort_order to follow the same sequence the
-- matching fields appear in the Prompt Craft builder form, so the Token
-- Library's category tabs read left-to-right in "order of creation" instead
-- of the historical order categories happened to be added in across
-- migrations 002/032/033. Categories that route into the same builder field
-- (per CATEGORY_FIELD_MAP in CraftPrompt.tsx) are grouped together, ordered
-- by that field's position in the form; categories with no field (stay
-- sequence-only: material, color, parameters) sort last.

UPDATE token_categories SET sort_order = 1  WHERE name = 'subject';
UPDATE token_categories SET sort_order = 2  WHERE name = 'action';
UPDATE token_categories SET sort_order = 3  WHERE name = 'casting_style';
UPDATE token_categories SET sort_order = 4  WHERE name = 'character';
UPDATE token_categories SET sort_order = 5  WHERE name = 'acting';
UPDATE token_categories SET sort_order = 6  WHERE name = 'facial_expressions';
UPDATE token_categories SET sort_order = 7  WHERE name = 'body_language';
UPDATE token_categories SET sort_order = 8  WHERE name = 'body_movement';
UPDATE token_categories SET sort_order = 9  WHERE name = 'intentions';
UPDATE token_categories SET sort_order = 10 WHERE name = 'environment';
UPDATE token_categories SET sort_order = 11 WHERE name = 'weather';
UPDATE token_categories SET sort_order = 12 WHERE name = 'time_of_day';
UPDATE token_categories SET sort_order = 13 WHERE name = 'composition';
UPDATE token_categories SET sort_order = 14 WHERE name = 'camera';
UPDATE token_categories SET sort_order = 15 WHERE name = 'lens';
UPDATE token_categories SET sort_order = 16 WHERE name = 'lighting';
UPDATE token_categories SET sort_order = 17 WHERE name = 'mood';
UPDATE token_categories SET sort_order = 18 WHERE name = 'brand_tone';
UPDATE token_categories SET sort_order = 19 WHERE name = 'product_placement';
UPDATE token_categories SET sort_order = 20 WHERE name = 'product_interaction';
UPDATE token_categories SET sort_order = 21 WHERE name = 'products_in_environment';
UPDATE token_categories SET sort_order = 22 WHERE name = 'product_psychology';
UPDATE token_categories SET sort_order = 23 WHERE name = 'product_semiotics';
UPDATE token_categories SET sort_order = 24 WHERE name = 'direction';
UPDATE token_categories SET sort_order = 25 WHERE name = 'directors_vision';
UPDATE token_categories SET sort_order = 26 WHERE name = 'craft';
UPDATE token_categories SET sort_order = 27 WHERE name = 'framing_intention';
UPDATE token_categories SET sort_order = 28 WHERE name = 'contrast_relationship';
UPDATE token_categories SET sort_order = 29 WHERE name = 'chromatic_contrast';
UPDATE token_categories SET sort_order = 30 WHERE name = 'wardrobe';
UPDATE token_categories SET sort_order = 31 WHERE name = 'designer_influence';
UPDATE token_categories SET sort_order = 32 WHERE name = 'accessories';
UPDATE token_categories SET sort_order = 33 WHERE name = 'realism';
UPDATE token_categories SET sort_order = 34 WHERE name = 'avoidance';
UPDATE token_categories SET sort_order = 35 WHERE name = 'storytelling';
UPDATE token_categories SET sort_order = 36 WHERE name = 'motion';
UPDATE token_categories SET sort_order = 37 WHERE name = 'material';
UPDATE token_categories SET sort_order = 38 WHERE name = 'color';
UPDATE token_categories SET sort_order = 39 WHERE name = 'parameters';
