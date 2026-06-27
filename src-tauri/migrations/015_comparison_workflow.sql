ALTER TABLE comparison_sessions ADD COLUMN comparison_type TEXT NOT NULL DEFAULT 'result_result';
ALTER TABLE comparison_sessions ADD COLUMN outcome_summary TEXT;
ALTER TABLE comparison_items ADD COLUMN source_role TEXT NOT NULL DEFAULT 'result';

