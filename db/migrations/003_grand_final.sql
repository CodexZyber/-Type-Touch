-- Grand Final round + per-round attempts (live leaderboard work).
-- Apply to an existing database with:
--   psql "$DATABASE_URL" -f db/migrations/003_grand_final.sql
-- Fresh databases get all of this from db/init/001_schema.sql already.

ALTER TABLE events
    ADD COLUMN IF NOT EXISTS final_status TEXT NOT NULL DEFAULT 'NOT_STARTED',
    ADD COLUMN IF NOT EXISTS final_start_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS final_end_time TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS final_duration INTEGER NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS finalist_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'events_final_status_check') THEN
        ALTER TABLE events ADD CONSTRAINT events_final_status_check
            CHECK (final_status IN ('NOT_STARTED', 'LIVE', 'ENDED'));
    END IF;
END $$;

ALTER TABLE attempts
    ADD COLUMN IF NOT EXISTS round TEXT NOT NULL DEFAULT 'QUALIFIER';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'attempts_round_check') THEN
        ALTER TABLE attempts ADD CONSTRAINT attempts_round_check
            CHECK (round IN ('QUALIFIER', 'FINAL'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attempts_event_round ON attempts(event_id, round);

-- Ranks participants by their best qualifying attempt in a round.
--   p_round = 'QUALIFIER' (default): attempts made during the main event window
--   p_round = 'FINAL': final-round attempts by the frozen finalists, inside the final window
DROP FUNCTION IF EXISTS get_event_leaderboard(UUID);
CREATE OR REPLACE FUNCTION get_event_leaderboard(p_event_id UUID, p_round TEXT DEFAULT 'QUALIFIER')
RETURNS TABLE (
    rank BIGINT,
    participant_id UUID,
    name TEXT,
    student_id TEXT,
    best_wpm INTEGER,
    best_wpm_precise NUMERIC(6, 2),
    best_accuracy NUMERIC(5, 2),
    attempts_count BIGINT,
    last_attempt_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
AS $$
    WITH participant_best AS (
        SELECT
            p.id AS participant_id,
            p.name,
            p.student_id,
            a.wpm_display AS best_wpm,
            a.wpm AS best_wpm_precise,
            a.accuracy AS best_accuracy,
            a.completed_at AS best_attempt_time,
            (SELECT COUNT(*) FROM attempts c
              WHERE c.participant_id = p.id AND c.event_id = p_event_id AND c.round = p_round) AS attempts_count,
            ROW_NUMBER() OVER (
                PARTITION BY p.id
                ORDER BY a.wpm DESC, a.accuracy DESC, a.completed_at ASC
            ) AS rn
        FROM participants p
        JOIN attempts a ON a.participant_id = p.id AND a.event_id = p_event_id AND a.qualified = TRUE
        JOIN events e ON e.id = p_event_id
        WHERE p.event_id = p_event_id
          AND p.disqualified = FALSE
          AND a.round = p_round
          AND (p_round <> 'FINAL' OR e.finalist_ids ? p.id::text)
          -- Only attempts made during the round's official window
          AND CASE WHEN p_round = 'FINAL'
                THEN (e.final_start_time IS NULL OR a.started_at >= e.final_start_time)
                 AND (e.final_end_time IS NULL OR a.completed_at <= (e.final_end_time + INTERVAL '5 seconds'))
                ELSE (e.start_time IS NULL OR a.started_at >= e.start_time)
                 AND (e.end_time IS NULL OR a.completed_at <= (e.end_time + INTERVAL '5 seconds'))
              END
    )
    SELECT
        DENSE_RANK() OVER (ORDER BY best_wpm_precise DESC, best_accuracy DESC, best_attempt_time ASC) AS rank,
        participant_id,
        name,
        student_id,
        best_wpm,
        best_wpm_precise,
        best_accuracy,
        attempts_count,
        best_attempt_time AS last_attempt_at
    FROM participant_best
    WHERE rn = 1
    ORDER BY rank ASC;
$$;
