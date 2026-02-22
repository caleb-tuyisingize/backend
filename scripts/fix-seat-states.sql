-- ========================================
-- FIX SEAT STATES - Safe SQL Queries
-- ========================================
-- 
-- This fixes the issue where all seats were accidentally set to LOCKED
-- 
-- IMPORTANT: Run each section step by step and verify results before proceeding
--

-- ========================================
-- STEP 1: VERIFY - Check if state column exists
-- ========================================

SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'seats' AND column_name = 'state';

-- If no rows returned, the state column doesn't exist (good - no fix needed)
-- If rows returned, continue with the fix below

-- ========================================
-- STEP 2: INSPECT - Current state distribution
-- ========================================

SELECT state, COUNT(*) as seat_count
FROM seats
WHERE state IS NOT NULL
GROUP BY state
ORDER BY state;

-- This shows how many seats are in each state (AVAILABLE, LOCKED, BOOKED)

-- ========================================
-- STEP 3: PREVIEW - Which seats should be BOOKED?
-- ========================================

-- Preview seats that have confirmed tickets (should be BOOKED)
SELECT 
  s.bus_id,
  b.plate_number,
  s.seat_number,
  s.state as current_state,
  sch.id as schedule_id,
  t.status as ticket_status,
  t.booking_ref
FROM seats s
INNER JOIN buses b ON b.id = s.bus_id
INNER JOIN schedules sch ON sch.bus_id = s.bus_id
INNER JOIN tickets t ON t.schedule_id = sch.id 
                     AND t.seat_number = s.seat_number
WHERE t.status IN ('CONFIRMED', 'CHECKED_IN')
  AND s.state IS NOT NULL
ORDER BY s.bus_id, sch.departure_time, s.seat_number
LIMIT 100;

-- Review this list - these seats will be set to BOOKED

-- ========================================
-- STEP 4: PREVIEW - Which seats should be AVAILABLE?
-- ========================================

-- Preview seats that DON'T have confirmed tickets (should be AVAILABLE)
SELECT 
  s.bus_id,
  b.plate_number,
  COUNT(*) as seat_count,
  s.state as current_state
FROM seats s
LEFT JOIN buses b ON b.id = s.bus_id
WHERE s.state IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 
    FROM tickets t
    INNER JOIN schedules sch ON sch.id = t.schedule_id
    WHERE sch.bus_id = s.bus_id
      AND t.seat_number = s.seat_number
      AND t.status IN ('CONFIRMED', 'CHECKED_IN')
  )
GROUP BY s.bus_id, b.plate_number, s.state
ORDER BY s.bus_id;

-- All these seats will be set to AVAILABLE

-- ========================================
-- STEP 5: BACKUP - Create backup table (OPTIONAL but RECOMMENDED)
-- ========================================

-- Create a backup of seats table before updating
CREATE TABLE seats_backup_20260219 AS 
SELECT * FROM seats WHERE state IS NOT NULL;

-- Verify backup
SELECT COUNT(*) FROM seats_backup_20260219;

-- ========================================
-- STEP 6: FIX - Reset all seats to AVAILABLE
-- ========================================

BEGIN;

-- Reset ALL seats to AVAILABLE first
UPDATE seats
SET state = 'AVAILABLE', 
    updated_at = NOW()
WHERE state IS NOT NULL;

-- Verify the reset (should show all AVAILABLE)
SELECT state, COUNT(*) as count
FROM seats
WHERE state IS NOT NULL
GROUP BY state;

-- If looks good, commit. If not, ROLLBACK.
-- COMMIT;
ROLLBACK; -- Uncomment COMMIT and comment this when ready

-- ========================================
-- STEP 7: FIX - Update confirmed seats to BOOKED
-- ========================================

BEGIN;

-- Set seats with confirmed tickets to BOOKED
-- This query is scoped by schedule_id and seat_number as required
UPDATE seats s
SET state = 'BOOKED', 
    updated_at = NOW()
WHERE s.state IS NOT NULL
  AND EXISTS (
    SELECT 1 
    FROM tickets t
    INNER JOIN schedules sch ON sch.id = t.schedule_id
    WHERE sch.bus_id = s.bus_id
      AND t.seat_number = s.seat_number
      AND t.status IN ('CONFIRMED', 'CHECKED_IN')
  );

-- Check how many rows will be affected (should match preview count)
-- If looks good, commit. If not, ROLLBACK.
-- COMMIT;
ROLLBACK; -- Uncomment COMMIT and comment this when ready

-- ========================================
-- STEP 8: VERIFY - Final state distribution
-- ========================================

-- Overall distribution
SELECT state, COUNT(*) as seat_count
FROM seats
WHERE state IS NOT NULL
GROUP BY state
ORDER BY state;

-- Detailed distribution per bus
SELECT 
  s.bus_id,
  b.plate_number,
  b.capacity,
  COUNT(*) as total_seats,
  SUM(CASE WHEN s.state = 'AVAILABLE' THEN 1 ELSE 0 END) as available,
  SUM(CASE WHEN s.state = 'BOOKED' THEN 1 ELSE 0 END) as booked,
  SUM(CASE WHEN s.state = 'LOCKED' THEN 1 ELSE 0 END) as locked
FROM seats s
LEFT JOIN buses b ON b.id = s.bus_id
WHERE s.state IS NOT NULL
GROUP BY s.bus_id, b.plate_number, b.capacity
ORDER BY s.bus_id;

-- Verify: BOOKED seats should match confirmed tickets count
SELECT 
  'Seats marked BOOKED' as source,
  COUNT(*) as count
FROM seats
WHERE state = 'BOOKED'
UNION ALL
SELECT 
  'Confirmed tickets' as source,
  COUNT(DISTINCT sch.bus_id || '-' || t.seat_number) as count
FROM tickets t
INNER JOIN schedules sch ON sch.id = t.schedule_id
WHERE t.status IN ('CONFIRMED', 'CHECKED_IN');

-- If counts match (or very close), the fix was successful!

-- ========================================
-- STEP 9: RECOMMENDED - Drop state column entirely
-- ========================================

-- ⚠️  IMPORTANT: This is the recommended solution!
-- Seat states should be calculated dynamically, not stored in the database.
-- This prevents synchronization issues.

BEGIN;

-- Drop the state column
ALTER TABLE seats DROP COLUMN IF EXISTS state;

-- Verify column is gone
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'seats' AND column_name = 'state';
-- Should return no rows

-- COMMIT;
ROLLBACK; -- Uncomment COMMIT when ready

-- ========================================
-- STEP 10: CLEANUP - Drop backup table (after confirming fix works)
-- ========================================

-- Only run this after verifying the fix works in production for a few days
-- DROP TABLE IF EXISTS seats_backup_20260219;

-- ========================================
-- NOTES
-- ========================================
-- 
-- The seat booking system calculates states dynamically:
-- 
-- 1. AVAILABLE: No confirmed ticket exists for this seat on any active schedule
-- 2. LOCKED: Seat has an active lock (expires_at > NOW(), status = 'ACTIVE')
-- 3. BOOKED: Seat has a confirmed ticket (status IN ('CONFIRMED', 'CHECKED_IN'))
-- 
-- This is handled in backend/controllers/seatController.js -> getSeatsForSchedule()
-- 
-- The state column should NOT exist in the seats table.
-- If it exists, it causes synchronization issues.
