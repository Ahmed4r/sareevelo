-- Apply once before running the production profile against an existing schema.
-- Do not use this script to initialize an empty database.
BEGIN;
ALTER TABLE order_geography ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_coverage_state_driver ON driver_coverage_states(state_code,driver_id);
COMMIT;
