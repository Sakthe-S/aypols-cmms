-- 0007: Optional parts request at ticket creation (REQ-6.1-01)
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0007_ticket_parts_request.sql

-- Requested spare parts captured when a ticket is raised. Stored as a JSON array:
--   [{"partId": 1, "partName": "Main Bearing", "qty": 2, "unit": "pcs", "partCode": "BRG-001"}]
ALTER TABLE maintenance_tickets
  ADD COLUMN IF NOT EXISTS requested_parts JSONB NOT NULL DEFAULT '[]'::jsonb;