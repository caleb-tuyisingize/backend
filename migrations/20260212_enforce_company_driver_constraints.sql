-- Migration: enforce company-driver constraints and indexes
BEGIN;

-- 1) Ensure users.company_id references companies(id)
ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS company_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_company_id_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 2) Add check constraint to ensure company_id is NOT NULL when role = 'driver'
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_driver_company_not_null'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_driver_company_not_null CHECK (role != 'driver' OR company_id IS NOT NULL);
  END IF;
END$$;

-- 3) Add role check constraint (keeps allowed roles consistent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_role_allowed_values'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_role_allowed_values CHECK (role IN ('commuter','company_admin','driver','admin'));
  END IF;
END$$;

-- 4) Ensure buses has driver_id and company_id columns
ALTER TABLE IF EXISTS buses
  ADD COLUMN IF NOT EXISTS driver_id UUID;
ALTER TABLE IF EXISTS buses
  ADD COLUMN IF NOT EXISTS company_id UUID;

-- 5) Add foreign key for buses.driver_id -> users.id (ON DELETE SET NULL)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buses_driver_id_fkey'
  ) THEN
    ALTER TABLE buses
      ADD CONSTRAINT buses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END$$;

-- 6) Add foreign key for buses.company_id -> companies.id (ON DELETE CASCADE)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'buses_company_id_fkey'
  ) THEN
    ALTER TABLE buses
      ADD CONSTRAINT buses_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;
  END IF;
END$$;

-- 7) Prevent one driver being assigned to multiple buses: unique partial index on buses.driver_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'ux_buses_driver_id') THEN
    CREATE UNIQUE INDEX ux_buses_driver_id ON buses(driver_id) WHERE driver_id IS NOT NULL;
  END IF;
END$$;

-- 8) Add trigger to validate driver.company_id matches bus.company_id on insert/update
CREATE OR REPLACE FUNCTION validate_bus_driver_company() RETURNS trigger AS $$
DECLARE
  drv_company UUID;
BEGIN
  IF NEW.driver_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT company_id INTO drv_company FROM users WHERE id = NEW.driver_id;
  IF drv_company IS NULL THEN
    RAISE EXCEPTION 'Driver % has no company_id', NEW.driver_id;
  END IF;
  IF NEW.company_id IS NULL THEN
    RAISE EXCEPTION 'Bus must have company_id set';
  END IF;
  IF drv_company <> NEW.company_id THEN
    RAISE EXCEPTION 'Driver company_id (%) does not match bus company_id (%)', drv_company, NEW.company_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_bus_driver_company') THEN
    CREATE TRIGGER trg_validate_bus_driver_company
      BEFORE INSERT OR UPDATE ON buses
      FOR EACH ROW EXECUTE FUNCTION validate_bus_driver_company();
  END IF;
END$$;

-- 9) Create driver_locations table if not exists and add index
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = 'idx_driver_locations_driver_updated') THEN
    CREATE INDEX idx_driver_locations_driver_updated ON driver_locations (driver_id, updated_at DESC);
  END IF;
END$$;

COMMIT;
