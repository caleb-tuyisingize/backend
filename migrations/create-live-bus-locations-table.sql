-- Migration: Create live_bus_locations table for real-time GPS tracking
-- Purpose: Store current location data for active bus schedules
-- Date: 2026-02-13

-- Drop table if exists (for development/testing)
DROP TABLE IF EXISTS live_bus_locations;

-- Create live_bus_locations table
CREATE TABLE live_bus_locations (
    schedule_id UUID PRIMARY KEY REFERENCES schedules(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    speed DECIMAL(5, 2),
    heading DECIMAL(5, 2),
    recorded_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add index for faster queries
CREATE INDEX idx_live_bus_locations_recorded_at ON live_bus_locations(recorded_at);

-- Add comment
COMMENT ON TABLE live_bus_locations IS 'Real-time GPS location data for active bus schedules';
COMMENT ON COLUMN live_bus_locations.schedule_id IS 'Foreign key to schedules table';
COMMENT ON COLUMN live_bus_locations.latitude IS 'Latitude coordinate (degrees, -90 to 90)';
COMMENT ON COLUMN live_bus_locations.longitude IS 'Longitude coordinate (degrees, -180 to 180)';
COMMENT ON COLUMN live_bus_locations.speed IS 'Speed in km/h';
COMMENT ON COLUMN live_bus_locations.heading IS 'Compass heading in degrees (0-360)';
COMMENT ON COLUMN live_bus_locations.recorded_at IS 'Timestamp when location was recorded';

-- Success message
SELECT 'live_bus_locations table created successfully' AS status;
