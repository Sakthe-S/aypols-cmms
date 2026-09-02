-- 0005: Code-review fixes - spare parts HSN/SAC & sale rate fields
-- Idempotent; safe to run multiple times.
-- Run from the project root:
--   psql -d aypols -f migrations/0005_spare_parts_hsn_sale.sql

ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS hsn_sac TEXT;
ALTER TABLE spare_parts ADD COLUMN IF NOT EXISTS sale_rate NUMERIC(12,2) NOT NULL DEFAULT 0;