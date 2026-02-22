-- ========================================
-- QUICK FIX: Reset LOCKED Seats to Proper States
-- ========================================
-- Run these queries in your database client (pgAdmin, DBeaver, psql, etc.)

-- STEP 1: Check if state column exists
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'seats' AND column_name = 'state';
-- If no rows: Good! No fix needed. 
-- If rows returned: Continue below.

-- STEP 2: See current problem (all LOCKED)
SELECT state, COUNT(*) as count FROM seats GROUP BY state;

-- STEP 3: Reset ALL seats to AVAILABLE
UPDATE seats SET state = 'AVAILABLE', updated_at = NOW();

-- STEP 4: Update seats with confirmed tickets to BOOKED
UPDATE seats s
SET state = 'BOOKED', updated_at = NOW()
WHERE EXISTS (
  SELECT 1 FROM tickets t
  INNER JOIN schedules sch ON sch.id = t.schedule_id
  WHERE sch.bus_id = s.bus_id
    AND t.seat_number = s.seat_number
    AND t.status IN ('CONFIRMED', 'CHECKED_IN')
);

-- STEP 5: Verify fix worked
SELECT state, COUNT(*) as count FROM seats GROUP BY state;
-- Should show mostly AVAILABLE with some BOOKED

-- STEP 6: (RECOMMENDED) Drop state column entirely
ALTER TABLE seats DROP COLUMN IF EXISTS state;
