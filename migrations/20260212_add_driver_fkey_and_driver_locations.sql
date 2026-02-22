-- Migration: add foreign key from buses.driver_id -> users.id (ON DELETE SET NULL)
-- and create driver_locations table

BEGIN;

-- add driver_id column if missing
ALTER TABLE IF EXISTS buses ADD COLUMN IF NOT EXISTS driver_id UUID;

-- add foreign key constraint (set null on delete)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'buses_driver_id_fkey'
    ) THEN
        ALTER TABLE buses
        ADD CONSTRAINT buses_driver_id_fkey FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL;
    END IF;
END$$;

-- create driver_locations table
CREATE TABLE IF NOT EXISTS driver_locations (
  id UUID PRIMARY KEY,
  driver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;
