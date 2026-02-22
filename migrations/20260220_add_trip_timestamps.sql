-- Migration: Add trip_start_time and trip_end_time to schedules table
-- Purpose: Track when trips actually start and end (separate from created_at/updated_at)
-- Date: February 20, 2026

-- Add trip_start_time column (nullable - only set when driver starts trip)
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS trip_start_time TIMESTAMP WITH TIME ZONE NULL;

-- Add trip_end_time column (nullable - only set when driver ends trip)
ALTER TABLE schedules
ADD COLUMN IF NOT EXISTS trip_end_time TIMESTAMP WITH TIME ZONE NULL;

-- Add index for performance when querying active trips
CREATE INDEX IF NOT EXISTS idx_schedules_trip_times 
ON schedules(trip_start_time, trip_end_time) 
WHERE trip_start_time IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN schedules.trip_start_time IS 'Actual time when driver started the trip (not schedule creation time)';
COMMENT ON COLUMN schedules.trip_end_time IS 'Actual time when driver ended/completed the trip';

-- Show results
SELECT 
  column_name, 
  data_type, 
  is_nullable 
FROM information_schema.columns 
WHERE table_name = 'schedules' 
  AND column_name IN ('trip_start_time', 'trip_end_time');

COMMIT;
