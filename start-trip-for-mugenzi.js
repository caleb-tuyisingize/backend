require('dotenv').config();
const pool = require('./config/pgPool');

async function startTrip() {
  const client = await pool.connect();
  
  try {
    const scheduleId = '2e826710-b02f-43b6-9243-bd9b639b555f';
    
    console.log('🚀 Starting Trip for MUGENZI Ticket...\n');
    console.log(`Schedule ID: ${scheduleId}\n`);
    
    // Update schedule status to in_progress
    const result = await client.query(`
      UPDATE schedules 
      SET 
        status = 'in_progress',
        trip_start_time = NOW()
      WHERE id = $1
      RETURNING 
        id,
        status,
        trip_start_time,
        schedule_date::TEXT as date,
        departure_time::TEXT as departure;
    `, [scheduleId]);
    
    if (result.rowCount === 0) {
      console.log('❌ Schedule not found!');
      return;
    }
    
    const schedule = result.rows[0];
    
    console.log('✅ Trip Started Successfully!\n');
    console.log('📋 Schedule Details:');
    console.log(`  Status: ${schedule.status}`);
    console.log(`  Trip Started: ${schedule.trip_start_time}`);
    console.log(`  Date: ${schedule.date}`);
    console.log(`  Departure: ${schedule.departure}`);
    console.log();
    
    // Count tickets
    const ticketCount = await client.query(`
      SELECT COUNT(*) as count
      FROM tickets
      WHERE schedule_id = $1
        AND status = 'CONFIRMED';
    `, [scheduleId]);
    
    console.log(`📊 Ready to Scan:`);
    console.log(`  ${ticketCount.rows[0].count} CONFIRMED ticket(s) on this schedule`);
    console.log();
    console.log('✅ You can now scan tickets!');
    
  } finally {
    client.release();
    await pool.end();
  }
}

startTrip().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
