-- 0008: EHS ticket-based tracking & EHS Officer verification (REQ-6.10-03)
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0008_ehs_ticket_tracking.sql

-- ---------------------------------------------------------------------------
-- 1. EHS Officer verification on training completions
--    Gives the EHS Officer role an explicit approval action (currently the role
--    has none). A completion is only "verified" once an EHS Officer approves it.
-- ---------------------------------------------------------------------------
ALTER TABLE training_completions
  ADD COLUMN IF NOT EXISTS verified_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP(3) WITHOUT TIME ZONE;

-- ---------------------------------------------------------------------------
-- 2. Link EHS records (training / health compliance) to an EHS ticket so EHS
--    matters can be tracked through the ticket system.
-- ---------------------------------------------------------------------------
ALTER TABLE training_completions
  ADD COLUMN IF NOT EXISTS linked_ticket_id INTEGER REFERENCES maintenance_tickets(id) ON DELETE SET NULL;
ALTER TABLE health_compliance_records
  ADD COLUMN IF NOT EXISTS linked_ticket_id INTEGER REFERENCES maintenance_tickets(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 3. Mark a maintenance ticket as an EHS ticket, so EHS matters raised through
--    the ticket system are separately identifiable.
-- ---------------------------------------------------------------------------
ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS is_ehs BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_maintenance_tickets_is_ehs
  ON maintenance_tickets (is_ehs);
CREATE INDEX IF NOT EXISTS idx_training_completions_verified
  ON training_completions (verified_at) WHERE verified_at IS NULL;