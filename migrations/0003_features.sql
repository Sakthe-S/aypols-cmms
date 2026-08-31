-- 0003: Feature additions - expected completion date, EHS override history
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0003_features.sql

-- 1. Expected completion date on maintenance tickets
ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS expected_completion_date TIMESTAMPTZ;

-- 2. Compliance override history for EHS scheduling
CREATE TABLE IF NOT EXISTS compliance_override_history (
  id SERIAL PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_id INTEGER NOT NULL,
  ticket_id INTEGER,
  overridden_by_id INTEGER NOT NULL REFERENCES users(id),
  old_date TIMESTAMPTZ,
  new_date TIMESTAMPTZ,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
