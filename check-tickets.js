// Quick script to check tickets database
require('dotenv').config();
const pool = require('./config/pgPool');

async function checkTickets() {
  try {
    console.log('\n🔍 Checking Tickets Database...\n');
    
    // Get some sample schedules
    const schedulesQuery = `
      SELECT id, schedule_date, departure_time, available_seats
      FROM schedules 
      ORDER BY schedule_date DESC 
      LIMIT 5
    `;
    const schedules = await pool.query(schedulesQuery);
    
    console.log('📅 Sample Schedules:');
    schedules.rows.forEach((s, i) => {
      console.log(`${i + 1}. Schedule ${s.id}`);
      console.log(`   Date: ${s.schedule_date}`);
      console.log(`   Available: ${s.available_seats} seats\n`);
    });
    
    // Get all tickets grouped by status
    const ticketsQuery = `
      SELECT 
        status,
        COUNT(*) as count,
        array_agg(DISTINCT schedule_id) as schedule_ids
      FROM tickets
      GROUP BY status
    `;
    const tickets = await pool.query(ticketsQuery);
    
    console.log('\n🎫 Tickets by Status:');
    tickets.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count} tickets`);
    });
    
    // Get sample tickets for first schedule
    if (schedules.rows.length > 0) {
      const firstScheduleId = schedules.rows[0].id;
      const scheduleTicketsQuery = `
        SELECT 
          id,
          seat_number,
          status,
          created_at
        FROM tickets
        WHERE schedule_id = $1
        ORDER BY seat_number
      `;
      const scheduleTickets = await pool.query(scheduleTicketsQuery, [firstScheduleId]);
      
      console.log(`\n📋 Tickets for Schedule ${firstScheduleId}:`);
      if (scheduleTickets.rows.length === 0) {
        console.log('  No tickets found ✅');
      } else {
        scheduleTickets.rows.forEach(t => {
          console.log(`  Seat ${t.seat_number}: ${t.status}`);
        });
      }
    }
    
    // Check for PENDING or unusual statuses
    const suspectQuery = `
      SELECT 
        schedule_id,
        seat_number,
        status,
        created_at
      FROM tickets
      WHERE status NOT IN ('CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'PENDING_PAYMENT')
      LIMIT 10
    `;
    const suspect = await pool.query(suspectQuery);
    
    if (suspect.rows.length > 0) {
      console.log('\n⚠️  Tickets with unusual status:');
      suspect.rows.forEach(t => {
        console.log(`  Schedule: ${t.schedule_id}, Seat: ${t.seat_number}, Status: ${t.status}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkTickets();
