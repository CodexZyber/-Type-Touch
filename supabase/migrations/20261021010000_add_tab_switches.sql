ALTER TABLE attempts
ADD COLUMN IF NOT EXISTS tab_switches INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_attempts_tab_switches
ON attempts(event_id, tab_switches);
