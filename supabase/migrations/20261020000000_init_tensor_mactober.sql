-- ============================================================================
-- Tensor MacTober Typing Championship Database Schema
-- Supabase / PostgreSQL Migration
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. EVENTS TABLE
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL DEFAULT 'Tensor MacTober Typing Championship',
    subtitle TEXT DEFAULT '60 seconds. One hour. Type your way to the top.',
    organization_name TEXT DEFAULT 'TENSOR',
    status TEXT NOT NULL CHECK (status IN ('NOT_STARTED', 'LIVE', 'ENDED')) DEFAULT 'NOT_STARTED',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    test_duration INTEGER NOT NULL DEFAULT 60, -- in seconds
    event_duration INTEGER NOT NULL DEFAULT 60, -- in minutes
    minimum_accuracy NUMERIC(5, 2) NOT NULL DEFAULT 85.0,
    max_attempts INTEGER, -- NULL means unlimited
    finalists_count INTEGER NOT NULL DEFAULT 2,
    passage TEXT NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    student_id TEXT NOT NULL,
    email TEXT,
    session_id TEXT NOT NULL,
    disqualified BOOLEAN NOT NULL DEFAULT FALSE,
    disqualification_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_event_student UNIQUE (event_id, student_id)
);

-- 4. ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id UUID NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    elapsed_seconds NUMERIC(6, 2) NOT NULL DEFAULT 60.00,
    wpm NUMERIC(6, 2) NOT NULL,
    wpm_display INTEGER NOT NULL,
    accuracy NUMERIC(5, 2) NOT NULL,
    correct_characters INTEGER NOT NULL,
    incorrect_characters INTEGER NOT NULL,
    total_characters INTEGER NOT NULL,
    qualified BOOLEAN NOT NULL DEFAULT FALSE,
    is_demo BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. INDEXES FOR ULTRA-FAST CONCURRENT LEADERBOARD QUERIES (180+ USERS)
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_participants_event_disqualified ON participants(event_id, disqualified);
CREATE INDEX IF NOT EXISTS idx_participants_student_id ON participants(student_id);
CREATE INDEX IF NOT EXISTS idx_participants_session_id ON participants(session_id);
CREATE INDEX IF NOT EXISTS idx_attempts_event_qualified ON attempts(event_id, qualified);
CREATE INDEX IF NOT EXISTS idx_attempts_participant_wpm ON attempts(participant_id, qualified, wpm DESC, accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_event_completed ON attempts(event_id, completed_at);

-- 6. RPC: GET SERVER TIME (Server-Authoritative Timing)
CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT clock_timestamp();
$$;

-- 7. RPC: GET LEADERBOARD FUNCTION
-- Calculates personal best per participant within event window, with tie breakers:
-- Higher WPM first, then higher Accuracy, then earlier completion timestamp
CREATE OR REPLACE FUNCTION get_event_leaderboard(p_event_id UUID)
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
            COUNT(all_a.id) OVER (PARTITION BY p.id) AS attempts_count,
            ROW_NUMBER() OVER (
                PARTITION BY p.id 
                ORDER BY a.wpm DESC, a.accuracy DESC, a.completed_at ASC
            ) AS rn
        FROM participants p
        JOIN attempts a ON a.participant_id = p.id AND a.event_id = p_event_id AND a.qualified = TRUE
        JOIN events e ON e.id = p_event_id
        LEFT JOIN attempts all_a ON all_a.participant_id = p.id AND all_a.event_id = p_event_id
        WHERE p.event_id = p_event_id 
          AND p.disqualified = FALSE
          -- Ensure attempt occurred during official event window
          AND (e.start_time IS NULL OR a.started_at >= e.start_time)
          AND (e.end_time IS NULL OR a.completed_at <= (e.end_time + INTERVAL '5 seconds'))
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

-- 8. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;

-- Events Policies:
CREATE POLICY "Public read events" ON events FOR SELECT USING (true);
CREATE POLICY "Service role manages events" ON events FOR ALL USING (auth.role() = 'service_role');

-- Participants Policies:
CREATE POLICY "Public read participants" ON participants FOR SELECT USING (true);
CREATE POLICY "Public insert participants" ON participants FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role manages participants" ON participants FOR ALL USING (auth.role() = 'service_role');

-- Attempts Policies:
CREATE POLICY "Public read attempts" ON attempts FOR SELECT USING (true);
CREATE POLICY "Public insert attempts" ON attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Service role manages attempts" ON attempts FOR ALL USING (auth.role() = 'service_role');

-- 9. ENABLE REALTIME PUBLICATION
ALTER PUBLICATION supabase_realtime ADD TABLE events;
ALTER PUBLICATION supabase_realtime ADD TABLE participants;
ALTER PUBLICATION supabase_realtime ADD TABLE attempts;

-- 10. DEFAULT SEED EVENT
INSERT INTO events (
    id,
    name,
    status,
    start_time,
    end_time,
    test_duration,
    event_duration,
    minimum_accuracy,
    max_attempts,
    finalists_count,
    passage,
    is_demo
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Tensor MacTober Typing Championship',
    'NOT_STARTED',
    NULL,
    NULL,
    60,
    60,
    85.00,
    NULL,
    2,
    'Silicon precision meets human agility on the keys of the future. Deep learning architectures transform simple vectors into complex thoughts, training neural networks across millions of gradient steps. As artificial intelligence reshapes human potential, mastery over fundamental tools remains paramount. Every keystroke is a signal, an instruction executed with absolute clarity and unmatched velocity. In this championship, focus and discipline separate the ordinary from the extraordinary. Push through the cognitive barrier, maintain composure under intense pressure, and calibrate your rhythm to perfection.',
    FALSE
) ON CONFLICT (id) DO NOTHING;
