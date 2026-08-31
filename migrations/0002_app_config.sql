-- 0002: Company / general settings configuration
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0002_app_config.sql

CREATE TABLE IF NOT EXISTS app_config (
  id                      SERIAL PRIMARY KEY,
  company_name            TEXT NOT NULL DEFAULT 'Aypols Polymers',
  company_address         TEXT,
  company_phone           TEXT,
  company_email           TEXT,
  currency                TEXT NOT NULL DEFAULT 'INR',
  default_labor_rate      NUMERIC(12,2) NOT NULL DEFAULT 400,
  default_pm_lead_days    INT NOT NULL DEFAULT 7,
  low_stock_threshold     NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed a single default row if none exists
INSERT INTO app_config (company_name, company_address, company_phone, company_email, currency, default_labor_rate, default_pm_lead_days, low_stock_threshold)
SELECT 'Aypols Polymers', 'Perundurai, Erode District, Tamil Nadu', '9876543210', 'admin@aypols.com', 'INR', 400, 7, 0
WHERE NOT EXISTS (SELECT 1 FROM app_config);
