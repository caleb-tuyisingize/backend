-- Live Bus Locations Table for GPS Tracking
-- This table stores the current location of active buses
-- Only one row per bus (UPSERT on update)

CREATE TABLE IF NOT EXISTS live_bus_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id UUID NOT NULL REFERENCES buses(id) ON DELETE CASCADE,
  driver_id UUID NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  speed DECIMAL(5, 2) DEFAULT 0, -- km/h
  heading DECIMAL(5, 2), -- degrees (0-360)
  is_active BOOLEAN DEFAULT true,
  trip_status VARCHAR(20) DEFAULT 'active', -- active, ended, paused
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  -- Ensure only one active location per bus
  UNIQUE(bus_id)
);

-- Index for fast queries
CREATE INDEX idx_live_locations_bus ON live_bus_locations(bus_id);
CREATE INDEX idx_live_locations_driver ON live_bus_locations(driver_id);
CREATE INDEX idx_live_locations_active ON live_bus_locations(is_active) WHERE is_active = true;
CREATE INDEX idx_live_locations_updated ON live_bus_locations(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE live_bus_locations ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Company can see their own buses
CREATE POLICY "Company can view own bus locations" ON live_bus_locations
  FOR SELECT
  USING (
    bus_id IN (
      SELECT id FROM buses WHERE company_id IN (
        SELECT company_id FROM users WHERE id = auth.uid()
      )
    )
  );

-- Driver can update their own bus location
CREATE POLICY "Driver can update own location" ON live_bus_locations
  FOR ALL
  USING (driver_id = auth.uid());

-- Function to auto-update timestamp
CREATE OR REPLACE FUNCTION update_live_location_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for auto-updating timestamp
CREATE TRIGGER set_live_location_timestamp
  BEFORE UPDATE ON live_bus_locations
  FOR EACH ROW
  EXECUTE FUNCTION update_live_location_timestamp();

-- Enable Realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE live_bus_locations;

COMMENT ON TABLE live_bus_locations IS 'Stores real-time GPS locations of active buses';
