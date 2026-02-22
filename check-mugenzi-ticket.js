require('dotenv').config();
const pool = require('./config/pgPool');

async function checkMugenziTicket() {
  const client = await pool.connect();
  
  try {
    console.log('🔍 Checking MUGENZI Ticket Details\n');
    
    // Find the ticket and its schedule
    const result = await client.query(`
      SELECT 
        t.id as ticket_id,
        t.booking_ref,
        t.seat_number,
        t.status as ticket_status,
        u.full_name as passenger_name,
        t.schedule_id,
        s.status as schedule_status,
        s.schedule_date::TEXT as schedule_date,
        s.departure_time::TEXT as departure_time,
        s.trip_start_time,
        r.origin,
        r.destination
      FROM tickets t
      JOIN users u ON t.passenger_id = u.id
      JOIN schedules s ON t.schedule_id = s.id
      JOIN routes r ON s.route_id = r.id
      WHERE u.full_name ILIKE '%MUGENZI%'
        AND t.seat_number = '1'
      ORDER BY t.created_at DESC
      LIMIT 1;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No ticket found for MUGENZI Seat 1\n');
      return;
    }
    
    const ticket = result.rows[0];
    
    console.log('📋 Ticket Information:');
    console.log(`  Passenger: ${ticket.passenger_name}`);
    console.log(`  Seat: ${ticket.seat_number}`);
    console.log(`  Booking Ref: ${ticket.booking_ref}`);
    console.log(`  Ticket Status: ${ticket.ticket_status}`);
    console.log();
    
    console.log('🚌 Schedule Information:');
    console.log(`  Schedule ID: ${ticket.schedule_id}`);
    console.log(`  Schedule Status: ${ticket.schedule_status} ${ticket.schedule_status === 'in_progress' || ticket.schedule_status === 'ACTIVE' ? '✅' : '❌ NOT ACTIVE!'}`);
    console.log(`  Date: ${ticket.schedule_date}`);
    console.log(`  Departure: ${ticket.departure_time}`);
    console.log(`  Route: ${ticket.origin} → ${ticket.destination}`);
    console.log(`  Trip Started: ${ticket.trip_start_time || '❌ NOT STARTED'}`);
    console.log();
    
    if (ticket.schedule_status !== 'in_progress' && ticket.schedule_status !== 'ACTIVE') {
      console.log('🚨 PROBLEM IDENTIFIED:');
      console.log(`   Schedule status is "${ticket.schedule_status}" but needs to be "in_progress" or "ACTIVE"`);
      console.log();
      console.log('💡 SOLUTION:');
      console.log(`   1. Start the trip first OR`);
      console.log(`   2. Update schedule status to "in_progress"`);
      console.log();
      console.log(`   To update manually:`);
      console.log(`   UPDATE schedules SET status = 'in_progress', trip_start_time = NOW() WHERE id = '${ticket.schedule_id}';`);
    } else {
      console.log('✅ Schedule is active! This should work.');
    }
    
  } finally {
    client.release();
    await pool.end();
  }
}

checkMugenziTicket().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
