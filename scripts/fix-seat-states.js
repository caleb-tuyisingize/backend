/**
 * Fix Seat States - Reset LOCKED seats to proper states
 * 
 * This script safely:
 * 1. Checks if seats table has a 'state' column
 * 2. If yes, resets all seats to AVAILABLE
 * 3. Then updates seats with confirmed tickets to BOOKED
 * 4. Provides option to drop the state column (recommended)
 * 
 * Usage: node scripts/fix-seat-states.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/pgPool');

async function checkStateColumnExists() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'seats' AND column_name = 'state'
    `);
    return result.rows.length > 0;
  } finally {
    client.release();
  }
}

async function getCurrentStateDistribution() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT state, COUNT(*) as count
      FROM seats
      WHERE state IS NOT NULL
      GROUP BY state
      ORDER BY state
    `);
    return result.rows;
  } catch (error) {
    console.log('Column "state" might not exist:', error.message);
    return [];
  } finally {
    client.release();
  }
}

async function previewSeatsToUpdate() {
  const client = await pool.connect();
  try {
    // Preview which seats have confirmed tickets
    const result = await client.query(`
      SELECT DISTINCT 
        s.bus_id,
        b.plate_number,
        s.seat_number,
        sch.id as schedule_id,
        sch.departure_time,
        t.status as ticket_status,
        t.passenger_id
      FROM seats s
      INNER JOIN buses b ON b.id = s.bus_id
      INNER JOIN schedules sch ON sch.bus_id = s.bus_id
      INNER JOIN tickets t ON t.schedule_id = sch.id 
                           AND t.seat_number = s.seat_number
      WHERE t.status IN ('CONFIRMED', 'CHECKED_IN')
        AND s.state IS NOT NULL
      ORDER BY s.bus_id, sch.departure_time, s.seat_number
      LIMIT 50
    `);
    return result.rows;
  } catch (error) {
    console.log('Preview query error:', error.message);
    return [];
  } finally {
    client.release();
  }
}

async function resetAllSeatsToAvailable() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const result = await client.query(`
      UPDATE seats
      SET state = 'AVAILABLE', updated_at = NOW()
      WHERE state IS NOT NULL
      RETURNING id, bus_id, seat_number, state
    `);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function updateConfirmedSeatsToBooked() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Update seats that have confirmed tickets to BOOKED
    // Scoped by schedule_id and seat_number as required
    const result = await client.query(`
      UPDATE seats s
      SET state = 'BOOKED', updated_at = NOW()
      WHERE s.state IS NOT NULL
        AND EXISTS (
          SELECT 1 
          FROM tickets t
          INNER JOIN schedules sch ON sch.id = t.schedule_id
          WHERE sch.bus_id = s.bus_id
            AND t.seat_number = s.seat_number
            AND t.status IN ('CONFIRMED', 'CHECKED_IN')
        )
      RETURNING id, bus_id, seat_number, state
    `);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function getFinalStateDistribution() {
  const client = await pool.connect();
  try {
    const result = await client.query(`
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
      ORDER BY s.bus_id
    `);
    return result.rows;
  } catch (error) {
    console.log('Final query error:', error.message);
    return [];
  } finally {
    client.release();
  }
}

async function dropStateColumn() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query(`
      ALTER TABLE seats DROP COLUMN IF EXISTS state
    `);
    
    await client.query('COMMIT');
    console.log('✅ State column dropped successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  console.log('\n🔍 STEP 1: Checking if seats table has state column...\n');
  
  const hasStateColumn = await checkStateColumnExists();
  
  if (!hasStateColumn) {
    console.log('✅ Good news! Seats table does NOT have a state column.');
    console.log('   Seat states are calculated dynamically (correct behavior).');
    console.log('   No fix needed.\n');
    process.exit(0);
  }
  
  console.log('⚠️  Found state column in seats table (should be removed).\n');
  
  console.log('📊 STEP 2: Current state distribution:\n');
  const currentStates = await getCurrentStateDistribution();
  console.table(currentStates);
  
  console.log('\n👀 STEP 3: Preview - Seats with confirmed tickets (first 50):\n');
  const preview = await previewSeatsToUpdate();
  if (preview.length > 0) {
    console.table(preview.slice(0, 10));
    console.log(`   (Showing first 10 of ${preview.length} seats with confirmed tickets)\n`);
  } else {
    console.log('   No seats with confirmed tickets found.\n');
  }
  
  // Ask user for confirmation
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const answer = await new Promise((resolve) => {
    readline.question('🔧 Proceed with fix? (yes/no): ', (ans) => {
      readline.close();
      resolve(ans.toLowerCase());
    });
  });
  
  if (answer !== 'yes' && answer !== 'y') {
    console.log('❌ Fix cancelled by user.\n');
    process.exit(0);
  }
  
  console.log('\n🔄 STEP 4: Resetting all seats to AVAILABLE...\n');
  const resetCount = await resetAllSeatsToAvailable();
  console.log(`   ✅ Reset ${resetCount} seats to AVAILABLE\n`);
  
  console.log('🎯 STEP 5: Updating seats with confirmed tickets to BOOKED...\n');
  const bookedCount = await updateConfirmedSeatsToBooked();
  console.log(`   ✅ Updated ${bookedCount} seats to BOOKED\n`);
  
  console.log('📊 STEP 6: Final state distribution:\n');
  const finalStates = await getFinalStateDistribution();
  console.table(finalStates);
  
  console.log('\n💡 RECOMMENDATION: Drop the state column entirely\n');
  console.log('   Seat states should be calculated dynamically from tickets table.');
  console.log('   This prevents sync issues and is how the system was designed.\n');
  
  const dropAnswer = await new Promise((resolve) => {
    const rl = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question('🗑️  Drop state column? (yes/no): ', (ans) => {
      rl.close();
      resolve(ans.toLowerCase());
    });
  });
  
  if (dropAnswer === 'yes' || dropAnswer === 'y') {
    console.log('\n🗑️  Dropping state column...\n');
    await dropStateColumn();
    console.log('✅ State column removed. States will now be calculated dynamically.\n');
  } else {
    console.log('\n⚠️  State column kept. Remember to remove it later!\n');
  }
  
  console.log('✅ Fix completed successfully!\n');
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  console.error(error);
  process.exit(1);
});
