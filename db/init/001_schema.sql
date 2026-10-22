-- ============================================================================
-- Tensor MacTober Typing Championship — PostgreSQL schema
-- Runs automatically on first start of the `db` container
-- (mounted into /docker-entrypoint-initdb.d). To apply manually:
--   psql "$DATABASE_URL" -f db/init/001_schema.sql
-- ============================================================================

-- 1. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Tensor School Typing Championship',
    subtitle TEXT DEFAULT 'Type fast. Type clean. Climb the leaderboard.',
    organization_name TEXT DEFAULT 'TENSOR',
    status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'LIVE', 'ENDED')) DEFAULT 'NOT_STARTED',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    test_duration INTEGER NOT NULL DEFAULT 60, -- in seconds
    event_duration INTEGER NOT NULL DEFAULT 60, -- in minutes
    minimum_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 85.0,
    max_attempts INTEGER, -- NULL means unlimited
    finalists_count INTEGER NOT NULL DEFAULT 2,
    passage TEXT NOT NULL,                              -- qualifier-round passage
    passage_mode TEXT NOT NULL CHECK (passage_mode IN ('random', 'custom')) DEFAULT 'random',
    final_passage TEXT,                                 -- Grand Final passage (set when the final starts)
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    -- Grand Final round: runs after the qualifier round has ENDED
    final_status TEXT NOT NULL CHECK (final_status IN ('NOT_STARTED', 'LIVE', 'ENDED')) DEFAULT 'NOT_STARTED',
    final_start_time TIMESTAMPTZ,
    final_end_time TIMESTAMPTZ,
    final_duration INTEGER NOT NULL DEFAULT 10, -- in minutes
    finalist_ids JSONB NOT NULL DEFAULT '[]'::jsonb, -- participant ids frozen when the final starts
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    email TEXT,
    section TEXT,                  -- class section for host-created students; informational
    session_id TEXT NOT NULL,
    disqualified BOOLEAN NOT NULL DEFAULT FALSE,
    disqualification_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_student UNIQUE (event_id, student_id)
);

-- 2b. STUDENT ACCOUNTS (only host-created students can sign in; see scripts/students-add.mjs)
-- Kept apart from participants so no participant query can ever return a password hash.
CREATE TABLE IF NOT EXISTS student_accounts (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,   -- scrypt$N=16384,r=8,p=1$<saltHex>$<keyHex>
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_student_accounts_username ON student_accounts (lower(username));

-- 3. ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    tab_switches INTEGER NOT NULL DEFAULT 0,
    round TEXT NOT NULL CHECK (round IN ('QUALIFIER', 'FINAL')) DEFAULT 'QUALIFIER',
    elapsed_seconds NUMERIC(6, 2) NOT NULL DEFAULT 60.00,
    wpm NUMERIC(6, 2) NOT NULL,                      -- net WPM: (correct chars / 5) / minutes
    wpm_display INTEGER NOT NULL,
    raw_wpm NUMERIC(6, 2) NOT NULL DEFAULT 0,        -- all typed chars / 5 / minutes
    accuracy NUMERIC(5, 2) NOT NULL,                 -- keystroke accuracy: (keystrokes - mistypes) / keystrokes
    correct_characters INTEGER NOT NULL,             -- correct chars in the final text
    incorrect_characters INTEGER NOT NULL,           -- uncorrected typos left in the final text
    total_characters INTEGER NOT NULL,               -- length of the final text
    total_keystrokes INTEGER NOT NULL DEFAULT 0,     -- character-producing keypresses (no backspace)
    incorrect_keystrokes INTEGER NOT NULL DEFAULT 0, -- mistypes, corrected or not
    corrections INTEGER NOT NULL DEFAULT 0,          -- characters removed with backspace
    consistency NUMERIC(5, 2) NOT NULL DEFAULT 0,    -- evenness of per-second raw speed, 0-100
    timeline JSONB NOT NULL DEFAULT '[]'::jsonb,     -- [{t, wpm, raw, errors}] one point per second
    qualified BOOLEAN NOT NULL DEFAULT FALSE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_participants_event_disqualified ON participants(event_id, disqualified);
CREATE INDEX IF NOT EXISTS idx_participants_student_id ON participants(student_id);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_event_qualified ON attempts(event_id, qualified);
CREATE INDEX IF NOT EXISTS idx_attempts_participant_wpm ON attempts(participant_id, qualified, wpm DESC, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_event_completed ON attempts(event_id, completed_at);
CREATE INDEX IF NOT EXISTS idx_attempts_tab_switches ON attempts(event_id, tab_switches);
CREATE INDEX IF NOT EXISTS idx_attempts_event_round ON attempts(event_id, round);

-- 5. SERVER TIME
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT clock_timestamp();
$$;

-- 6. LEADERBOARD
-- Personal best per participant within the event window, with tie breakers:
-- higher WPM, then higher accuracy, then earlier completion.
-- Must stay in sync with the in-memory ranking in EventService.getLeaderboard.
-- Ranks participants by their best qualifying attempt in a round.
--   p_round = 'QUALIFIER' (default): attempts made during the main event window
--   p_round = 'FINAL': final-round attempts by the frozen finalists, inside the final window
DROP FUNCTION IF EXISTS get_event_leaderboard(UUID);
DROP FUNCTION IF EXISTS get_event_leaderboard(UUID, TEXT);
CREATE OR REPLACE FUNCTION get_event_leaderboard(p_event_id UUID, p_round TEXT DEFAULT 'QUALIFIER')
RETURNS TABLE (
    rank BIGINT,
    participant_id UUID,
    name TEXT,
    student_id TEXT,
    best_wpm INTEGER,
    best_wpm_precise NUMERIC(6, 2),
    best_accuracy NUMERIC(5, 2),
    best_raw_wpm NUMERIC(6, 2),
    best_consistency NUMERIC(5, 2),
    best_attempt_id UUID,
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
            a.id AS attempt_id,
            a.wpm_display AS best_wpm,
            a.wpm AS best_wpm_precise,
            a.accuracy AS best_accuracy,
            a.raw_wpm AS best_raw_wpm,
            a.consistency AS best_consistency,
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
        best_raw_wpm,
        best_consistency,
        attempt_id AS best_attempt_id,
        attempts_count,
        best_attempt_time AS last_attempt_at
    FROM participant_best
    WHERE rn = 1
    ORDER BY rank ASC;
$$;

-- 7. DEFAULT SEED EVENT
INSERT INTO events (
    id, name, status, test_duration, event_duration, minimum_accuracy,
    max_attempts, finalists_count, passage, is_demo
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Tensor School Typing Championship',
    'NOT_STARTED',
    60,
    60,
    85.00,
    NULL,
    2,
    'Silicon precision meets human agility on the keys of the future. Deep learning architectures transform simple vectors into complex thoughts, training neural networks across millions of gradient steps. As artificial intelligence reshapes human potential, mastery over fundamental tools remains paramount. Every keystroke is a signal, an instruction executed with absolute clarity and unmatched velocity. In this championship, focus and discipline separate the ordinary from the extraordinary. Push through the cognitive barrier, maintain composure under intense pressure, and calibrate your rhythm to perfection.',
    FALSE
) ON CONFLICT (id) DO NOTHING;
