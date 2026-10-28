-- Additive upgrade for existing PostgreSQL installations. Apply before deploying the new backend.
BEGIN;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_window_start timestamptz;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_window_end timestamptz;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (status IN ('PENDING','IN_TRANSIT','DELAYED','DELIVERED','CANCELLED'));
ALTER TABLE activity_events DROP CONSTRAINT IF EXISTS activity_events_type_check;
ALTER TABLE activity_events ADD CONSTRAINT activity_events_type_check CHECK (type IN ('ORDER_CREATED','DRIVER_ASSIGNED','DELIVERY_STARTED','DELIVERY_DELAYED','DELIVERY_RESUMED','DELIVERY_COMPLETED','ORDER_UPDATED','ORDER_CANCELLED'));
COMMIT;
