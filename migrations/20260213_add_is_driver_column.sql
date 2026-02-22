-- Migration: Add is_driver column to seats table
-- Date: 2026-02-13
-- Purpose: Distinguish driver seats from passenger seats

-- Add is_driver column (defaults to false for existing seats)
ALTER TABLE seats 
ADD COLUMN IF NOT EXISTS is_driver BOOLEAN DEFAULT false;

-- Create index for faster queries filtering driver seats
CREATE INDEX IF NOT EXISTS idx_seats_is_driver ON seats(is_driver);

-- Mark seat #1 as driver seat for all buses
-- (This assumes seat #1 is the driver position - adjust if your buses have different layouts)
UPDATE seats 
SET is_driver = true 
WHERE seat_number = '1';

-- Verify the changes
SELECT 
  bus_id, 
  seat_number, 
  is_driver,
  row,
  col,
  side
FROM seats 
WHERE is_driver = true
ORDER BY bus_id, seat_number;
