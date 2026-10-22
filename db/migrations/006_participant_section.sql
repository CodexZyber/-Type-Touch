-- Class section for host-created students (e.g. "Section 1 (C 11)"); informational only.
-- Apply to an existing database with:
--   psql "$DATABASE_URL" -f db/migrations/006_participant_section.sql
-- Fresh databases get this from db/init/001_schema.sql already.

ALTER TABLE participants ADD COLUMN IF NOT EXISTS section TEXT;
