-- Migration: Fix schedule time columns to prevent timezone conversion
-- Date: 2026-02-21
-- Issue: departure_time and arrival_time were TIMESTAMP WITH TIME ZONE
--        causing automatic UTC conversion (15:35 stored as 13:35 in UTC+2 timezone)
-- Solution: Change to TIME WITHOUT TIME ZONE to store only time, no timezone conversion

-- Step 1: Add new TIME columns
ALTER TABLE schedules 
ADD COLUMN departure_time_new TIME WITHOUT TIME ZONE,
ADD COLUMN arrival_time_new TIME WITHOUT TIME ZONE;

-- Step 2: Copy existing time data (extract time part only)
-- This preserves the local time values (15:35 stays 15:35)
UPDATE schedules 
SET 
  departure_time_new = departure_time::TIME,
  arrival_time_new = arrival_time::TIME;

-- Step 3: Drop old TIMESTAMP columns
ALTER TABLE schedules 
DROP COLUMN departure_time,
DROP COLUMN arrival_time;

-- Step 4: Rename new columns to original names
ALTER TABLE schedules 
RENAME COLUMN departure_time_new TO departure_time;

ALTER TABLE schedules 
RENAME COLUMN arrival_time_new TO arrival_time;

-- Step 5: Make columns NOT NULL
ALTER TABLE schedules 
ALTER COLUMN departure_time SET NOT NULL,
ALTER COLUMN arrival_time SET NOT NULL;

-- Verification query (uncomment to test):
-- SELECT 
--   id, 
--   schedule_date, 
--   departure_time, 
--   arrival_time,
--   pg_typeof(departure_time) as departure_type,
--   pg_typeof(arrival_time) as arrival_type
-- FROM schedules 
-- LIMIT 5;

-- Expected result: 
-- departure_type = "time without time zone"
-- arrival_type = "time without time zone"
-- Times should be stored as-is (e.g., 15:35:00, not 13:35:00)
