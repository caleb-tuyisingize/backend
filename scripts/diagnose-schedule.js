/**
 * Check Schedule and Bus Configuration
 * 
 * Diagnoses why a schedule has no seats
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const pool = require('../config/pgPool');

const scheduleId = process.argv[2] || 'dfde9f36-3fbc-44ea-a633-140faeaadc5e';

async function diagnose() {
  const client = await pool.connect();
  try {
    console.log(`\n🔍 Diagnosing Schedule: ${scheduleId}\n`);
    
    // Get schedule details
    const scheduleResult = await client.query(`
      SELECT s.*, b.plate_number, b.capacity, b.company_id
      FROM schedules s
      LEFT JOIN buses b ON s.bus_id = b.id
      WHERE s.id = $1
    `, [scheduleId]);
    
    if (scheduleResult.rows.length === 0) {
      console.log('❌ Schedule not found!');
      return;
    }
    
    const schedule = scheduleResult.rows[0];
    console.log('📋 Schedule Details:');
    console.table(schedule);
    
    // Get seat count for this bus
    const seatResult = await client.query(`
      SELECT COUNT(*) as seat_count
      FROM seats
      WHERE bus_id = $1
    `, [schedule.bus_id]);
    
    const seatCount = parseInt(seatResult.rows[0].seat_count);
    console.log(`\n🪑 Seats configured for bus ${schedule.plate_number}: ${seatCount}`);
    
    if (seatCount === 0) {
      console.log('\n⚠️  BUS HAS NO SEATS! This is the problem.\n');
      console.log('Solutions:');
      console.log('1. Add seats to this bus using the bus configuration');
      console.log('2. Assign a different bus to this schedule');
      console.log(`3. Run: node scripts/add-seats-to-bus.js ${schedule.bus_id} ${schedule.capacity || 29}`);
    } else {
      // Show some seats
      const seatsResult = await client.query(`
        SELECT * FROM seats
        WHERE bus_id = $1
        ORDER BY seat_number
        LIMIT 10
      `, [schedule.bus_id]);
      
      console.log('\n🪑 Sample Seats:');
      console.table(seatsResult.rows);
    }
    
    // Get ticket count
    const ticketResult = await client.query(`
      SELECT COUNT(*) as ticket_count, status
      FROM tickets
      WHERE schedule_id = $1
      GROUP BY status
    `, [scheduleId]);
    
    console.log('\n🎫 Tickets for this schedule:');
    console.table(ticketResult.rows);
    
  } finally {
    client.release();
    await pool.end();
  }
}

diagnose();
