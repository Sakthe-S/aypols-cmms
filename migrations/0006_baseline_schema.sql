-- 0006: Baseline schema — captures the full current database schema so the
-- repository is fully reproducible on a fresh environment without relying on
-- incremental migrations alone.
--
-- Idempotent: safe to run multiple times. Run from the project root:
--   psql -d aypols -f migrations/0006_baseline_schema.sql

-- ---------------------------------------------------------------------------
-- Helper function for updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL,
  trade         TEXT,
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  whatsapp_enabled BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email);

-- ---------------------------------------------------------------------------
-- app_config
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_config (
  id                  SERIAL PRIMARY KEY,
  company_name        TEXT NOT NULL DEFAULT 'Aypols Polymers',
  company_address     TEXT,
  company_phone       TEXT,
  company_email       TEXT,
  currency            TEXT NOT NULL DEFAULT 'INR',
  default_labor_rate  NUMERIC(12,2) NOT NULL DEFAULT 400,
  default_pm_lead_days INTEGER NOT NULL DEFAULT 7,
  low_stock_threshold NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- machines
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS machines (
  id                      SERIAL PRIMARY KEY,
  machine_name            TEXT NOT NULL,
  serial_number           TEXT,
  department              TEXT,
  location                TEXT,
  installation_date       TIMESTAMP(3) WITHOUT TIME ZONE,
  manufacturer            TEXT,
  model                   TEXT,
  photo_url               TEXT,
  current_status          TEXT NOT NULL DEFAULT 'operational',
  lifetime_maintenance_cost DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_service_date       TIMESTAMP(3) WITHOUT TIME ZONE,
  next_pm_date            TIMESTAMP(3) WITHOUT TIME ZONE,
  created_at              TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- maintenance_tickets
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS maintenance_ticket_num_seq AS integer;

CREATE TABLE IF NOT EXISTS maintenance_tickets (
  id                   SERIAL PRIMARY KEY,
  ticket_number        TEXT NOT NULL,
  machine_id           INTEGER NOT NULL REFERENCES machines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  reported_by_id       INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  reported_date        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  priority             TEXT NOT NULL DEFAULT 'medium',
  category             TEXT,
  issue_description    TEXT NOT NULL,
  photo_urls           TEXT,
  status               TEXT NOT NULL DEFAULT 'open',
  assigned_to_id       INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  allocated_date       TIMESTAMP(3) WITHOUT TIME ZONE,
  start_time           TIMESTAMP(3) WITHOUT TIME ZONE,
  end_time             TIMESTAMP(3) WITHOUT TIME ZONE,
  downtime_minutes     INTEGER,
  diagnosis            TEXT,
  rootcause            TEXT,
  actions_taken        TEXT,
  labor_hours          DOUBLE PRECISION,
  labor_rate_per_hour  DOUBLE PRECISION,
  labor_cost           DOUBLE PRECISION,
  contractor_charges   DOUBLE PRECISION,
  other_costs          DOUBLE PRECISION,
  total_repair_cost    DOUBLE PRECISION,
  parts_cost           DOUBLE PRECISION,
  closure_outcome      TEXT,
  closure_verified_by_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  closure_date         TIMESTAMP(3) WITHOUT TIME ZONE,
  created_at           TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at           TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expected_completion_date TIMESTAMP WITH TIME ZONE,
  photo_paths          TEXT[] NOT NULL DEFAULT '{}'
);
CREATE UNIQUE INDEX IF NOT EXISTS maintenance_tickets_ticket_number_key ON maintenance_tickets (ticket_number);

-- ---------------------------------------------------------------------------
-- notification_preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notification_preferences (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  channel    TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'whatsapp')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

-- ---------------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title             TEXT NOT NULL,
  message           TEXT NOT NULL,
  type              TEXT NOT NULL,
  link_url          TEXT,
  is_read           BOOLEAN NOT NULL DEFAULT false,
  sent_via_whatsapp BOOLEAN NOT NULL DEFAULT false,
  whatsapp_sent_at  TIMESTAMP(3) WITHOUT TIME ZONE,
  created_at        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_notifications_whatsapp_pending
  ON notifications (created_at) WHERE sent_via_whatsapp = false;

-- ---------------------------------------------------------------------------
-- spare_parts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS spare_parts (
  id             SERIAL PRIMARY KEY,
  part_code      TEXT NOT NULL,
  part_name      TEXT NOT NULL,
  category       TEXT,
  unit           TEXT NOT NULL,
  purchase_rate  DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_qty    DOUBLE PRECISION NOT NULL DEFAULT 0,
  min_threshold  DOUBLE PRECISION NOT NULL DEFAULT 0,
  reorder_qty    DOUBLE PRECISION NOT NULL DEFAULT 0,
  storage_room   TEXT,
  rack_bin       TEXT,
  supplier       TEXT,
  photo_url      TEXT,
  notes          TEXT,
  created_at     TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  hsn_sac        TEXT,
  sale_rate      NUMERIC(12,2) NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS spare_parts_part_code_key ON spare_parts (part_code);

-- ---------------------------------------------------------------------------
-- stock_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stock_transactions (
  id                  SERIAL PRIMARY KEY,
  part_id             INTEGER NOT NULL REFERENCES spare_parts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  transaction_type    TEXT NOT NULL,
  quantity            DOUBLE PRECISION NOT NULL,
  reference_ticket_id INTEGER,
  reference_po        TEXT,
  reason              TEXT,
  receiver            TEXT,
  from_location       TEXT,
  to_location         TEXT,
  user_id             INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  created_at          TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- ticket_spare_parts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_spare_parts (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES maintenance_tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  part_id     INTEGER NOT NULL REFERENCES spare_parts(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  qty         DOUBLE PRECISION NOT NULL,
  unit_price  DOUBLE PRECISION NOT NULL,
  total_cost  DOUBLE PRECISION NOT NULL,
  user_id     INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  created_at  TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- ticket_progress_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ticket_progress_logs (
  id          SERIAL PRIMARY KEY,
  ticket_id   INTEGER NOT NULL REFERENCES maintenance_tickets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  notes       TEXT NOT NULL,
  log_type    TEXT NOT NULL DEFAULT 'note',
  created_at  TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- pm_schedules
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pm_schedules (
  id               SERIAL PRIMARY KEY,
  machine_id       INTEGER NOT NULL REFERENCES machines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  task_name        TEXT NOT NULL,
  frequency        TEXT NOT NULL,
  description      TEXT,
  checklist_items  TEXT,
  lead_days        INTEGER NOT NULL DEFAULT 7,
  is_active        BOOLEAN NOT NULL DEFAULT true,
  next_due_date    TIMESTAMP(3) WITHOUT TIME ZONE,
  last_completed_at TIMESTAMP(3) WITHOUT TIME ZONE,
  created_at       TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- pm_logs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pm_logs (
  id              SERIAL PRIMARY KEY,
  schedule_id     INTEGER NOT NULL REFERENCES pm_schedules(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ticket_id       INTEGER REFERENCES maintenance_tickets(id) ON UPDATE CASCADE ON DELETE SET NULL,
  completed_at    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_by_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'completed',
  next_due_date   TIMESTAMP(3) WITHOUT TIME ZONE
);

-- ---------------------------------------------------------------------------
-- amc_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS amc_records (
  id                SERIAL PRIMARY KEY,
  machine_id        INTEGER NOT NULL REFERENCES machines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  contract_number   TEXT,
  vendor_name       TEXT NOT NULL,
  start_date        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,
  end_date          TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL,
  frequency         TEXT,
  cost              DOUBLE PRECISION,
  description       TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  next_service_date TIMESTAMP(3) WITHOUT TIME ZONE,
  lead_days         INTEGER NOT NULL DEFAULT 14,
  created_at        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- calibration_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS calibration_records (
  id                 SERIAL PRIMARY KEY,
  machine_id         INTEGER NOT NULL REFERENCES machines(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  instrument_name    TEXT NOT NULL,
  calibration_type   TEXT NOT NULL,
  frequency          TEXT NOT NULL,
  last_calibration   TIMESTAMP(3) WITHOUT TIME ZONE,
  next_due_date      TIMESTAMP(3) WITHOUT TIME ZONE,
  certificate        TEXT,
  lab_name           TEXT,
  cost               DOUBLE PRECISION,
  lead_days          INTEGER NOT NULL DEFAULT 30,
  is_active          BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- safety_checklists
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_checklists (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  job_type        TEXT NOT NULL,
  checklist_items TEXT NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- safety_checklist_completions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS safety_checklist_completions (
  id             SERIAL PRIMARY KEY,
  checklist_id   INTEGER NOT NULL REFERENCES safety_checklists(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  ticket_id      INTEGER,
  completed_by_id INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  supervisor_id  INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  is_approved    BOOLEAN NOT NULL DEFAULT false,
  override_by_id INTEGER REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  override_reason TEXT,
  responses      TEXT NOT NULL,
  completed_at   TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  approved_at    TIMESTAMP(3) WITHOUT TIME ZONE
);

-- ---------------------------------------------------------------------------
-- compliance_override_history
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS compliance_override_history (
  id                SERIAL PRIMARY KEY,
  record_type       TEXT NOT NULL,
  record_id         INTEGER NOT NULL,
  ticket_id         INTEGER,
  overridden_by_id  INTEGER NOT NULL REFERENCES users(id),
  old_date          TIMESTAMPTZ,
  new_date          TIMESTAMPTZ,
  reason            TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- training_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_records (
  id                SERIAL PRIMARY KEY,
  training_name     TEXT NOT NULL,
  training_type     TEXT NOT NULL,
  description       TEXT,
  frequency         TEXT NOT NULL,
  next_due_date     TIMESTAMP(3) WITHOUT TIME ZONE,
  lead_days         INTEGER NOT NULL DEFAULT 30,
  assigned_to_ids   TEXT NOT NULL DEFAULT '[]',
  document_url      TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT true,
  created_at        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- training_completions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_completions (
  id             SERIAL PRIMARY KEY,
  training_id    INTEGER NOT NULL REFERENCES training_records(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  completed_at   TIMESTAMP(3) WITHOUT TIME ZONE,
  proof_document TEXT,
  status         TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- health_compliance_records
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS health_compliance_records (
  id            SERIAL PRIMARY KEY,
  record_name   TEXT NOT NULL,
  record_type   TEXT NOT NULL,
  description   TEXT,
  frequency     TEXT NOT NULL,
  next_due_date TIMESTAMP(3) WITHOUT TIME ZONE,
  lead_days     INTEGER NOT NULL DEFAULT 30,
  document_url  TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP(3) WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users', 'app_config', 'machines', 'maintenance_tickets',
    'spare_parts', 'pm_schedules', 'amc_records', 'calibration_records',
    'safety_checklists', 'training_records', 'health_compliance_records'
  ])
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger
      WHERE tgname = 'trg_' || t || '_updated_at'
        AND tgrelid = ('public.' || t)::regclass
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
        t, t
      );
    END IF;
  END LOOP;
END $$;