-- Additive PostgreSQL upgrade for environments using ddl-auto=validate/none.
-- Development currently uses Hibernate ddl-auto=update and adds these itself.
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS mobile_number varchar(16);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS email varchar(254);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_type varchar(20);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS vehicle_registration varchar(32);
ALTER TABLE drivers ADD COLUMN IF NOT EXISTS notes varchar(1000);
