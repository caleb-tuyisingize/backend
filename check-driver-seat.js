// Check driver seat configuration
require('dotenv').config();
const pool = require('./config/pgPool');

async function checkDriverSeat() {
  try {
    // Get bus ID for this schedule
    const scheduleQuery = `SELECT bus_id FROM schedules WHERE id = $1`;
    const scheduleResult = await pool.query(scheduleQuery, ['dfde9f36-3fbc-44ea-a633-140faeaadc5e']);
    
    if (scheduleResult.rows.length === 0) {
      console.log('Schedule not found');
      return;
    }
    
    const busId = scheduleResult.rows[0].bus_id;
    console.log(`Bus ID: ${busId}`);
    
    // Check seats configuration
    const seatsQuery = `
      SELECT seat_number, is_driver
      FROM seats
      WHERE bus_id = $1
      ORDER BY CAST(seat_number AS INTEGER)
    `;
    
    const seatsResult = await pool.query(seatsQuery, [busId]);
    
    console.log(`\nSeats configuration:`);
    seatsResult.rows.forEach(row => {
      console.log(`  Seat ${row.seat_number}: ${row.is_driver ? 'DRIVER' : 'PASSENGER'}`);
    });
    
    // Check ticket for seat 1
    const ticketQuery = `
      SELECT * FROM tickets
      WHERE schedule_id = $1 AND seat_number = '1'
    `;
    
    const ticketResult = await pool.query(ticketQuery, ['dfde9f36-3fbc-44ea-a633-140faeaadc5e']);
    
    console.log(`\nTicket for seat 1:`);
    if (ticketResult.rows.length > 0) {
      console.log(JSON.stringify(ticketResult.rows[0], null, 2));
    } else {
      console.log('  No ticket found');
    }
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkDriverSeat();
