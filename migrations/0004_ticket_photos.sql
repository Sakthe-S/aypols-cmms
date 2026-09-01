-- 0004: Ticket photo attachments
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0004_ticket_photos.sql

ALTER TABLE maintenance_tickets ADD COLUMN IF NOT EXISTS photo_paths TEXT[] DEFAULT '{}';
