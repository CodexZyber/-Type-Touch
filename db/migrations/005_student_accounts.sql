-- Student logins: only students the host has created can enter the contest.
-- Apply to an existing database with:
--   psql "$DATABASE_URL" -f db/migrations/005_student_accounts.sql
-- Fresh databases get this from db/init/001_schema.sql already.
-- Kept apart from participants so no participant query can ever return a password hash.

CREATE TABLE IF NOT EXISTS student_accounts (
    participant_id UUID PRIMARY KEY REFERENCES participants(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,   -- scrypt$N=16384,r=8,p=1$<saltHex>$<keyHex>
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_accounts_username ON student_accounts (lower(username));
