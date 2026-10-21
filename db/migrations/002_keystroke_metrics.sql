-- Keystroke-based scoring (TypeSprint / Monkeytype convention).
-- Apply to an existing database with:
--   psql "$DATABASE_URL" -f db/migrations/002_keystroke_metrics.sql
-- Fresh databases get these columns from db/init/001_schema.sql already.

ALTER TABLE attempts
    ADD COLUMN IF NOT EXISTS raw_wpm NUMERIC(6, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_keystrokes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS incorrect_keystrokes INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS corrections INTEGER NOT NULL DEFAULT 0;

-- Back-fill old rows from what they recorded: no keystroke log exists, so
-- treat every typed character as one keystroke and every typo as one mistype.
UPDATE attempts
SET raw_wpm = CASE WHEN elapsed_seconds > 0
                   THEN ROUND((total_characters / 5.0) / (elapsed_seconds / 60.0), 2)
                   ELSE 0 END,
    total_keystrokes = total_characters,
    incorrect_keystrokes = incorrect_characters,
    corrections = 0
WHERE total_keystrokes = 0 AND total_characters > 0;
