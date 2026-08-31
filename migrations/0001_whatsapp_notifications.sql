-- 0001: WhatsApp (Twilio) notification integration
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0001_whatsapp_notifications.sql

-- 1. Master opt-in flag for WhatsApp delivery per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS whatsapp_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Delivery tracking on outbound notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS sent_via_whatsapp BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS whatsapp_sent_at TIMESTAMPTZ;

-- 3. Per-type channel preference (in_app | whatsapp) per user
CREATE TABLE IF NOT EXISTS notification_preferences (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'whatsapp')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

-- 4. Fast lookup of pending-delivery notifications
CREATE INDEX IF NOT EXISTS idx_notifications_whatsapp_pending
  ON notifications (created_at)
  WHERE sent_via_whatsapp = false;