-- Live Bus Locations Table for GPS Tracking
-- This table stores the current location of active buses
-- Only one row per bus (UPSERT on update)

CREATE TABLE IF NOT EXISTS live_bus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0,
  heading DECIMAL(5, 2),
  is_active BOOLEAN DEFAULT true,
  trip_status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(bus_id)
);

CREATE INDEX IF NOT EXISTS idx_live_locations_bus ON live_bus_locations(bus_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_driver ON live_bus_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_live_locations_active ON live_bus_locations(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_live_locations_updated ON live_bus_locations(updated_at DESC);

CREATE OR REPLACE FUNCTION update_live_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_live_location_timestamp ON live_bus_locations;
CREATE TRIGGER set_live_location_timestamp
  BEFORE UPDATE ON live_bus_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_live_location_timestamp();
